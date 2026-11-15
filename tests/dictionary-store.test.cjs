const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DictionaryStore } = require("../src/dictionary-store.cjs");
const { replaceText } = require("../src/processing.cjs");
const { filesFixture } = require("./fixtures/storage.cjs");
const authorize = async () => {};
async function fixture() {
  const storage = filesFixture(),
    store = new DictionaryStore(storage.files);
  await store.reload();
  return { ...storage, store };
}

test("switching scope while an edit is authorized rejects the stale save", async () => {
  const f = await fixture();
  const before = f.store.snapshot;
  await assert.rejects(
    f.store.replaceUser("語,読み", before.revision, () =>
      f.switchScope("device"),
    ),
    { code: "CONFLICT" },
  );
  assert.equal(f.data.size, 0);
  assert.equal(f.store.snapshot, before);
  await f.store.reload();
  assert.equal(f.store.snapshot.scope, "device");
});
test("CSV sources merge by user-first and source order, survive restart and keep bodies out of metadata", async () => {
  const f = await fixture(),
    s = f.store;
  await s.importSource(
    "共通,第一\n固有,ひとつ",
    "辞書A",
    undefined,
    s.snapshot.revision,
    authorize,
  );
  await s.importSource(
    "共通,第二\n別語,ふたつ",
    "辞書B",
    undefined,
    s.snapshot.revision,
    authorize,
  );
  assert.equal(
    replaceText("共通 固有 別語", s.snapshot.index).text,
    "第一 ひとつ ふたつ",
  );
  await s.replaceUser("\ufeff共通,個人\r\n", s.snapshot.revision, authorize);
  assert.equal(f.data.get("shared/user.csv"), "\ufeff共通,個人\r\n");
  assert.equal(
    replaceText("共通 固有 別語", s.snapshot.index).text,
    "個人 ひとつ ふたつ",
  );
  await s.updateSources(
    (entries) => entries.reverse(),
    s.snapshot.revision,
    authorize,
  );
  assert.equal(replaceText("共通", s.snapshot.index).text, "個人");
  await s.replaceUser("", s.snapshot.revision, authorize);
  assert.equal(replaceText("共通", s.snapshot.index).text, "第二");
  await s.updateSources(
    (entries) => {
      entries[0].enabled = false;
      return entries;
    },
    s.snapshot.revision,
    authorize,
  );
  assert.equal(replaceText("共通", s.snapshot.index).text, "第一");
  assert(!f.data.get("shared/catalog.json").includes("共通"));
  assert(!f.data.get("shared/catalog.json").includes("replacement"));
  const restarted = new DictionaryStore(f.files);
  await restarted.reload();
  assert.equal(
    replaceText("共通 固有", restarted.snapshot.index).text,
    "第一 ひとつ",
  );
});
test("renaming and repeated identical saves retain the index; no read or rebuild occurs during use", async () => {
  const f = await fixture(),
    s = f.store;
  await s.importSource(
    "AppDock,アップドック",
    "A",
    undefined,
    s.snapshot.revision,
    authorize,
  );
  const index = s.snapshot.index,
    generation = s.generation;
  await s.updateSources(
    (entries) => {
      entries[0].name = "名前変更";
      return entries;
    },
    s.snapshot.revision,
    authorize,
  );
  assert.equal(s.snapshot.index, index);
  assert.equal(s.generation, generation);
  const reads = f.reads.length;
  for (let i = 0; i < 30; i++)
    assert.equal(
      replaceText("AppDockを", s.current("shared").index).text,
      "アップドックを",
    );
  assert.equal(f.reads.length, reads);
  assert.equal(s.generation, generation);
  await s.replaceUser("AI,エーアイ", s.snapshot.revision, authorize);
  const same = s.snapshot.index;
  await s.replaceUser("AI,エーアイ", s.snapshot.revision, authorize);
  assert.equal(s.snapshot.index, same);
});
test("invalid CSV, failed saves, stale edits and failed reload preserve the last good index and stored data", async () => {
  const f = await fixture(),
    s = f.store;
  const old = s.snapshot.revision;
  await s.replaceUser("用語,よみ", old, authorize);
  const index = s.snapshot.index;
  assert.throws(() =>
    s.replaceUser("bad,too,many", s.snapshot.revision, authorize),
  );
  await assert.rejects(s.replaceUser("用語,古い", old, authorize), {
    code: "CONFLICT",
  });
  f.files.failWrite = (name) => name === "user.csv";
  await assert.rejects(
    s.replaceUser("用語,失敗", s.snapshot.revision, authorize),
  );
  assert.equal(s.snapshot.index, index);
  assert.equal(f.data.get("shared/user.csv"), "用語,よみ");
  f.files.failWrite = (name) => name === "catalog.json";
  await assert.rejects(
    s.importSource(
      "追加,ついか",
      "A",
      undefined,
      s.snapshot.revision,
      authorize,
    ),
  );
  assert.equal(s.snapshot.index, index);
  assert.deepEqual([...f.data.keys()], ["shared/user.csv"]);
  f.files.failWrite = undefined;
  f.data.set("shared/user.csv", "broken,csv,record");
  assert.equal(await s.reload(), false);
  assert.equal(s.snapshot.index, index);
  assert.equal(f.data.get("shared/user.csv"), "broken,csv,record");
  assert(s.error);
});
test("shared and PC scopes are independent and re-import retains dictionary identity, order and state", async () => {
  const f = await fixture(),
    s = f.store;
  await s.importSource(
    "単語,初回",
    "A",
    undefined,
    s.snapshot.revision,
    authorize,
  );
  const id = s.snapshot.entries[0].id,
    oldFile = s.snapshot.entries[0].file;
  await s.importSource("単語,更新", "A", id, s.snapshot.revision, authorize);
  assert.equal(s.snapshot.entries[0].id, id);
  assert(!f.data.has("shared/" + oldFile));
  assert.equal(replaceText("単語", s.snapshot.index).text, "更新");
  await f.switchScope("device");
  await s.reload();
  assert.equal(s.snapshot.entries.length, 0);
  assert.throws(() => s.current("shared"));
  await s.replaceUser("単語,端末", s.snapshot.revision, authorize);
  await f.switchScope("shared");
  await s.reload();
  assert.equal(replaceText("単語", s.snapshot.index).text, "更新");
  assert.equal(f.data.get("device/user.csv"), "単語,端末");
});
test("cleanup failure reports the retained copy after removing registration without deleting a newer file", async () => {
  const f = await fixture(),
    s = f.store;
  await s.importSource(
    "単語,よみ",
    "A",
    undefined,
    s.snapshot.revision,
    authorize,
  );
  const file = s.snapshot.entries[0].file;
  f.data.set("shared/" + file, "単語,外部変更");
  const warning = await s.updateSources(
    () => [],
    s.snapshot.revision,
    authorize,
  );
  assert(warning.includes(file));
  assert.equal(s.snapshot.entries.length, 0);
  assert.equal(f.data.get("shared/" + file), "単語,外部変更");
});

test("disabled sources release their rows and protect externally changed copies even after restart", async () => {
  const f = await fixture();
  await f.store.importSource(
    "語,元の読み",
    "A",
    undefined,
    f.store.snapshot.revision,
    authorize,
  );
  const file = f.store.snapshot.entries[0].file;
  await f.store.updateSources(
    (entries) => {
      entries[0].enabled = false;
      return entries;
    },
    f.store.snapshot.revision,
    authorize,
  );
  assert.equal(f.store.snapshot.sources.size, 0);
  const restarted = new DictionaryStore(f.files);
  const reads = f.reads.length;
  assert.equal(await restarted.reload(), true);
  assert(!f.reads.slice(reads).some(([, name]) => name === file));
  f.data.set("shared/" + file, "語,新しい外部変更");
  const warning = await restarted.updateSources(
    () => [],
    restarted.snapshot.revision,
    authorize,
  );
  assert(warning.includes(file));
  assert.equal(f.data.get("shared/" + file), "語,新しい外部変更");
});

test("duplicate CSV rows retain their original bytes while first occurrences survive import, reload and re-import", async () => {
  const f = await fixture(),
    s = f.store;
  const sourceCsv =
    "\ufeff共通,配布の先頭\r\n独自,固有の読み\r\n共通,配布の後続\r\n独自,固有の読み\r\n";
  await s.importSource(
    sourceCsv,
    "配布辞書",
    undefined,
    s.snapshot.revision,
    authorize,
  );
  const original = s.snapshot.entries[0];
  assert.equal(original.count, 2);
  assert.equal(f.data.get("shared/" + original.file), sourceCsv);
  assert.equal(
    replaceText("共通 独自", s.snapshot.index).text,
    "配布の先頭 固有の読み",
  );
  const userCsv = "共通,個人の先頭\n共通,個人の後続";
  await s.replaceUser(userCsv, s.snapshot.revision, authorize);
  assert.equal(s.snapshot.userRows.length, 1);
  assert.equal(f.data.get("shared/user.csv"), userCsv);
  const restarted = new DictionaryStore(f.files);
  assert.equal(await restarted.reload(), true);
  assert.equal(
    replaceText("共通 独自", restarted.snapshot.index).text,
    "個人の先頭 固有の読み",
  );
  await restarted.replaceUser("", restarted.snapshot.revision, authorize);
  assert.equal(
    replaceText("共通", restarted.snapshot.index).text,
    "配布の先頭",
  );
  await restarted.importSource(
    "共通,更新の先頭\n共通,更新の後続",
    "配布辞書",
    original.id,
    restarted.snapshot.revision,
    authorize,
  );
  assert.equal(restarted.snapshot.entries[0].count, 1);
  assert.equal(restarted.snapshot.entries[0].id, original.id);
  assert.equal(
    replaceText("共通", restarted.snapshot.index).text,
    "更新の先頭",
  );
});
