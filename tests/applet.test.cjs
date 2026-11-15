const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createExtension } = require("../index.cjs");
const manifest = require("../extension.json");
const { filesFixture } = require("./fixtures/storage.cjs");
function fixture() {
  const extension = createExtension(),
    calls = [],
    storage = filesFixture();
  let value = {},
    revision = 1;
  const context = {
    storage: { files: storage.files },
    settings: {
      get: (key, fallback) => value[key] ?? fallback,
      replaceList: async () => {
        throw Error("CSV body must not enter Settings");
      },
    },
    providers: {
      settings: async () => ({ revision: String(revision), value: {} }),
      authorize: async () => ({ kind: "host" }),
      changed: async () => {},
    },
    appdock: {
      call: async (...args) => {
        calls.push(args);
        return { completion: "accepted" };
      },
    },
    ui: {},
  };
  const signal = new AbortController().signal;
  const request = (method, values = {}, params = {}) => ({
    method,
    params: { providerId: "helpers", values, ...params },
    actor: { kind: "host", external: false },
    authorization: "host",
  });
  const view = () => extension.onProviderRequest(request("snapshot"), signal);
  return {
    extension,
    calls,
    storage,
    context,
    signal,
    request,
    view,
    set(v) {
      value = v;
      revision++;
    },
    async start() {
      await extension.activate(context);
    },
    async invoke(method, values = {}, params = {}) {
      return extension.onProviderRequest(
        request(method, values, {
          expectedRevision: (await view()).revision,
          ...params,
        }),
        signal,
      );
    },
  };
}
test("one MCP tool accepts four public fields and uses the resident CSV dictionary", async () => {
  const f = fixture();
  f.storage.data.set("shared/user.csv", "AppDock,アップドック");
  await f.start();
  const tool = manifest.mcpToolModules[0].tools;
  assert.equal(tool.length, 1);
  assert.equal(tool[0].name, "appdock_speech_speak");
  assert.deepEqual(Object.keys(tool[0].inputSchema.properties).sort(), [
    "connectionId",
    "connectionName",
    "instructions",
    "text",
  ]);
  assert(!manifest.settings.some((setting) => setting.key === "dictionary"));
  assert(!manifest.mcpToolModules[0].settingsKeys.includes("dictionary"));
  const input = {
    text: "AppDockです。",
    connectionId: "id",
    connectionName: "name",
    instructions: "静かに",
  };
  const reads = f.storage.reads.length;
  for (let i = 0; i < 10; i++)
    assert.deepEqual(
      await f.extension.onMcpTool(
        {
          moduleId: "at365.speak.read-aloud",
          name: tool[0].name,
          input,
          settings: {
            revision: String(i),
            storageScope: "shared",
            value: { splitEnabled: false },
          },
        },
        f.signal,
      ),
      { accepted: true },
    );
  assert.equal(
    f.storage.reads.length,
    reads,
    "speech and unrelated settings revisions never read CSV",
  );
  assert.deepEqual(f.calls[0], [
    "tts.sequences.speak",
    {
      segments: ["アップドックです。"],
      startPolicy: { mode: "first" },
      connectionId: "id",
      connectionName: "name",
      instructions: "静かに",
    },
  ]);
});
test("MCP receipt waits for host acceptance without waiting for generation", async () => {
  const f = fixture();
  await f.start();
  let accept;
  f.context.appdock.call = () =>
    new Promise((resolve) => {
      accept = resolve;
    });
  let returned = false;
  const pending = f.extension
    .onMcpTool(
      {
        moduleId: "at365.speak.read-aloud",
        name: "appdock_speech_speak",
        input: { text: "hello" },
        settings: { revision: "a", storageScope: "shared", value: {} },
      },
      f.signal,
    )
    .then((result) => {
      returned = true;
      return result;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(returned, false);
  accept({ completion: "accepted" });
  assert.deepEqual(await pending, { accepted: true });
});

test("dictionary conversion exposes a default-on case setting shared by preview and MCP without reloading files", async () => {
  const f = fixture();
  f.storage.data.set(
    "shared/user.csv",
    "hello,ハロー\npython,パイソン\nkey,キー\nboard,ボード",
  );
  await f.start();
  assert.equal(
    manifest.settingSections.find((section) => section.id === "dictionary")
      .title,
    "辞書変換",
  );
  assert.equal(
    manifest.settings.find((setting) => setting.key === "dictionaryIgnoreCase")
      .default,
    true,
  );
  assert(
    manifest.mcpToolModules[0].settingsKeys.includes("dictionaryIgnoreCase"),
  );
  const reads = f.storage.reads.length,
    text = "Hello PYTHON keyboard key board";
  for (const [revision, flag] of [undefined, false, true, false].entries()) {
    const value = {
      splitEnabled: false,
      ...(flag === undefined ? {} : { dictionaryIgnoreCase: flag }),
    };
    const expected =
      flag === false
        ? "Hello PYTHON keyboard キー ボード"
        : "ハロー パイソン keyboard キー ボード";
    f.set(value);
    assert.equal(
      (await f.invoke("text.preview", { text })).dialog.values.replaced,
      expected,
    );
    await f.extension.onMcpTool(
      {
        moduleId: "at365.speak.read-aloud",
        name: "appdock_speech_speak",
        input: { text },
        settings: { revision: String(revision), storageScope: "shared", value },
      },
      f.signal,
    );
    assert.deepEqual(f.calls.at(-1)[1].segments, [expected]);
  }
  assert.equal(f.storage.reads.length, reads);
});
test("preview is read-only, CSV import is previewed, and stale/external requests cannot save", async () => {
  const f = fixture();
  await f.start();
  const view = await f.view();
  assert.deepEqual(
    view.tabs.map((tab) => tab.id),
    ["settings", "user-dictionary", "source-dictionaries"],
  );
  assert.deepEqual(
    view.tabs[0].toolbar.map((action) => action.id),
    ["text.open"],
  );
  assert.deepEqual(
    view.tabs[1].toolbar[0].items.map((action) => action.id),
    ["csv.open", "csv.paste"],
  );
  const preview = await f.invoke("text.preview", { text: "プレビューです。" });
  assert.equal(preview.dialog.values.replaced, "プレビューです。");
  assert.equal(f.calls.length, 0);
  assert.equal(f.storage.writes.length, 0);
  assert.equal(
    (await f.invoke("csv.preview", { csv: "a,b,c" })).issue.kind,
    "validation",
  );
  const imported = await f.invoke("csv.preview", {
    csv: "AppDock,アップドック",
  });
  assert.equal(f.storage.writes.length, 0);
  assert.ok((await f.invoke("csv.apply", imported.dialog.values)).feedback);
  assert.equal(f.storage.data.get("shared/user.csv"), "AppDock,アップドック");
  await assert.rejects(
    f.invoke(
      "csv.apply",
      { csv: "MCP,エムシーピー", target: "user" },
      { expectedRevision: view.revision },
    ),
    { code: "CONFLICT" },
  );
  assert.equal(f.storage.writes.length, 1);
  await assert.rejects(
    f.extension.onProviderRequest(
      { ...f.request("csv.apply"), actor: { kind: "mcp", external: true } },
      f.signal,
    ),
  );
});
test("word editing, distributed dictionary priority and toggles use the same CSV-backed data", async () => {
  const f = fixture();
  await f.start();
  await f.invoke("csv.apply", {
    csv: "用語,配布A",
    target: "source",
    name: "辞書A",
  });
  await f.invoke("csv.apply", {
    csv: "用語,配布B",
    target: "source",
    name: "辞書B",
  });
  let sourceRows = (await f.view()).tabs[2].panels.find(
    (panel) => panel.id === "source-dictionaries",
  ).rows;
  assert.equal(
    (await f.invoke("text.preview", { text: "用語" })).dialog.values.replaced,
    "配布A",
  );
  await f.invoke("source.order", {
    ids: sourceRows.map((row) => row.id).reverse(),
  });
  assert.equal(
    (await f.invoke("text.preview", { text: "用語" })).dialog.values.replaced,
    "配布B",
  );
  await f.invoke("user.save", { source: "用語", replacement: "個人" });
  assert.equal(
    (await f.invoke("text.preview", { text: "用語" })).dialog.values.replaced,
    "個人",
  );
  const row = (await f.view()).tabs[1].panels[1].rows[0];
  const edit = await f.invoke("user.edit", row.values, { rowId: row.id });
  assert.equal(edit.dialog.values.replacement, "個人");
  await f.invoke("user.delete", row.values, { rowId: row.id });
  sourceRows = (await f.view()).tabs[2].panels.find(
    (panel) => panel.id === "source-dictionaries",
  ).rows;
  await f.invoke("source.toggle", sourceRows[0].values, {
    rowId: sourceRows[0].id,
  });
  assert.equal(
    (await f.invoke("text.preview", { text: "用語" })).dialog.values.replaced,
    "配布A",
  );
  const invalid = await f.invoke("source.order", { ids: [] });
  assert.equal(invalid.issue.kind, "validation");
  assert(f.storage.data.get("shared/catalog.json").includes("辞書A"));
  assert(!f.storage.data.get("shared/catalog.json").includes("用語"));
});
test("old Settings dictionaries are ignored, large word views page, and PC switch changes the prepared dictionary", async () => {
  const f = fixture();
  f.set({
    dictionary: [{ id: "old", source: "旧辞書", replacement: "移行しない" }],
  });
  f.storage.data.set(
    "shared/user.csv",
    Array.from({ length: 250 }, (_, i) => `Word${i},ワード${i}`).join("\n"),
  );
  await f.start();
  assert.equal((await f.view()).tabs[1].panels[1].rows.length, 100);
  await f.invoke("user.next");
  assert.equal(
    (await f.view()).tabs[1].panels[1].rows[0].values.source,
    "Word100",
  );
  await f.storage.switchScope("device");
  assert.equal((await f.view()).tabs[1].panels[1].rows.length, 0);
  await f.invoke("user.save", { source: "端末", replacement: "このPC" });
  await assert.rejects(
    f.extension.onMcpTool(
      {
        moduleId: "at365.speak.read-aloud",
        name: "appdock_speech_speak",
        input: { text: "Word0" },
        settings: {
          revision: "stale-scope",
          storageScope: "shared",
          value: {},
        },
      },
      f.signal,
    ),
  );
  assert.equal(f.calls.length, 0);
  await f.storage.switchScope("shared");
  assert.equal((await f.view()).tabs[1].panels[1].rows.length, 100);
  assert(!f.storage.data.get("shared/user.csv").includes("旧辞書"));
  assert.equal(f.storage.data.get("device/user.csv"), "端末,このPC");
});

test("CSV preview and saved lookup agree on first duplicate while manual duplicate words remain a validation error", async () => {
  const f = fixture();
  await f.start();
  const csv = "共通,最初の読み\n別語,べつ\n共通,後の読み";
  const preview = await f.invoke("csv.preview", { csv });
  assert.equal(preview.issue, undefined);
  assert.equal(preview.dialog.title, "辞書の取り込み: 2件");
  assert.equal(preview.dialog.values.preview, "共通 → 最初の読み\n別語 → べつ");
  assert.ok((await f.invoke("csv.apply", preview.dialog.values)).feedback);
  assert.equal(f.storage.data.get("shared/user.csv"), csv);
  assert.equal(
    (await f.invoke("text.preview", { text: "共通 別語" })).dialog.values
      .replaced,
    "最初の読み べつ",
  );
  const duplicateEdit = await f.invoke("user.save", {
    source: "共通",
    replacement: "重複する追加",
  });
  assert.equal(duplicateEdit.issue.kind, "validation");
  assert.equal(f.storage.data.get("shared/user.csv"), csv);
});
