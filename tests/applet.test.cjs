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
        if (args[0] === "tts.connections.list")
          return {
            connections: [{ id: "alice", name: "ALICE" }],
            defaultConnectionId: "alice",
          };
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
test("background Applet handler waits for internal host acceptance while its MCP module opts into receive-only responses", async () => {
  assert.equal(manifest.mcpToolModules[0].responseMode, "accepted");
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

test("configured additions share the preview and MCP pipeline and can be cleared without dictionary reads", async () => {
  const f = fixture();
  f.storage.data.set(
    "shared/user.csv",
    "hello,ハロー\npython,パイソン\nenglish,イングリッシュ",
  );
  await f.start();
  for (const key of ["prefixText", "suffixText"]) {
    assert.equal(
      manifest.settings.find((setting) => setting.key === key).default,
      "",
    );
    assert(manifest.mcpToolModules[0].settingsKeys.includes(key));
  }
  for (const key of ["prefixNewline", "suffixNewline"]) {
    assert.equal(
      manifest.settings.find((setting) => setting.key === key).default,
      true,
    );
    assert(manifest.mcpToolModules[0].settingsKeys.includes(key));
  }
  assert.deepEqual(
    manifest.settingSections.find((section) => section.id === "text-additions")
      .settings,
    [
      "additionTiming",
      "prefixText",
      "prefixNewline",
      "suffixText",
      "suffixNewline",
    ],
  );
  const reads = f.storage.reads.length;
  for (const [revision, [additions, expected]] of [
    [{}, "ハロー!\nイングリッシュ\n!パイソン"],
    [{ prefixNewline: false }, "ハロー!イングリッシュ\n!パイソン"],
    [{ suffixNewline: false }, "ハロー!\nイングリッシュ!パイソン"],
    [
      { prefixNewline: false, suffixNewline: false },
      "ハロー!イングリッシュ!パイソン",
    ],
    [{ prefixText: "", suffixText: "" }, "イングリッシュ"],
  ].entries()) {
    const value = {
      prefixText: "Hello!",
      suffixText: "!Python",
      splitEnabled: false,
      ...additions,
    };
    f.set(value);
    const preview = await f.invoke("text.preview", { text: "English" });
    assert.equal(preview.dialog.values.text, "English");
    assert.equal(preview.dialog.values.replaced, expected);
    assert.equal(
      (await f.invoke("text.preview", preview.dialog.values)).dialog.values
        .replaced,
      expected,
    );
    assert.equal(f.calls.length, revision);
    const input = { text: "English", instructions: "quiet" };
    await f.extension.onMcpTool(
      {
        moduleId: "at365.speak.read-aloud",
        name: "appdock_speech_speak",
        input,
        settings: { revision: String(revision), storageScope: "shared", value },
      },
      f.signal,
    );
    assert.deepEqual(f.calls.at(-1), [
      "tts.sequences.speak",
      {
        segments: [expected],
        startPolicy: { mode: "first" },
        instructions: "quiet",
      },
    ]);
    assert.deepEqual(input, { text: "English", instructions: "quiet" });
  }
  assert.equal(f.storage.reads.length, reads);
});

test("after-split additions agree across preview, MCP and audition without reloading the dictionary", async () => {
  assert.equal(
    manifest.settings.find((setting) => setting.key === "additionTiming")
      .default,
    "before-split",
  );
  assert(manifest.mcpToolModules[0].settingsKeys.includes("additionTiming"));
  const f = fixture();
  f.storage.data.set("shared/user.csv", "hello,ハロー\npython,パイソン");
  await f.start();
  const value = {
    additionTiming: "after-split",
    prefixText: "Hello!",
    suffixText: "!Python",
    prefixNewline: false,
    suffixNewline: false,
    targetCharacters: 2,
  };
  f.set(value);
  const reads = f.storage.reads.length;
  const input = { text: "一。二。三。", instructions: "quiet" };
  const expected = [
    "ハロー!一。!パイソン",
    "ハロー!二。!パイソン",
    "ハロー!三。!パイソン",
  ];
  const preview = await f.invoke("text.preview", { text: input.text });
  assert.equal(preview.dialog.values.text, input.text);
  assert.equal(preview.dialog.values.replaced, expected.join(""));
  assert.equal(
    preview.dialog.values.segments,
    expected.map((part, i) => `${i + 1}. ${part}`).join("\n\n"),
  );
  assert.equal(
    (await f.invoke("text.preview", preview.dialog.values)).dialog.values
      .replaced,
    expected.join(""),
  );
  await f.extension.onMcpTool(
    {
      moduleId: "at365.speak.read-aloud",
      name: "appdock_speech_speak",
      input,
      settings: { revision: "after-split", storageScope: "shared", value },
    },
    f.signal,
  );
  assert.deepEqual(f.calls.at(-1), [
    "tts.sequences.speak",
    {
      segments: expected,
      startPolicy: { mode: "first" },
      instructions: "quiet",
    },
  ]);
  await f.invoke("audition.speak", { text: input.text, connectionId: "alice" });
  assert.deepEqual(f.calls.at(-1), [
    "tts.sequences.speak",
    {
      segments: expected,
      startPolicy: { mode: "first" },
      connectionId: "alice",
    },
  ]);
  assert.deepEqual(input, { text: "一。二。三。", instructions: "quiet" });
  assert.equal(f.storage.reads.length, reads);
});
test("configured split boundaries agree across preview, MCP snapshots and audition after settings change", async () => {
  const f = fixture();
  await f.start();
  const reads = f.storage.reads.length;
  for (const key of [
    "splitMode",
    "splitCharacters",
    "splitOnNewline",
    "splitOnSpace",
  ])
    assert(manifest.mcpToolModules[0].settingsKeys.includes(key));
  const text = "一、二。\n三 四|五";
  const cases = [
    [{}, ["一、二。", "\n三 四|五"]],
    [
      { splitCharacters: "、|", splitOnNewline: false },
      ["一、", "二。\n三 四|", "五"],
    ],
    [
      { splitCharacters: "", splitOnNewline: false, splitOnSpace: true },
      ["一、二。\n三 ", "四|五"],
    ],
    [{ splitCharacters: "", splitOnNewline: false }, [text]],
    [
      { splitMode: "sentences", splitCharacters: "、|", splitOnSpace: true },
      ["一、二。\n", "三 四|五"],
    ],
  ];
  for (const [revision, [patch, expected]] of cases.entries()) {
    const value = { targetCharacters: 3, ...patch };
    f.set(value);
    const preview = await f.invoke("text.preview", { text });
    assert.equal(preview.dialog.values.replaced, text);
    assert.equal(
      preview.dialog.values.segments,
      expected.map((part, i) => `${i + 1}. ${part}`).join("\n\n"),
    );
    await f.extension.onMcpTool(
      {
        moduleId: "at365.speak.read-aloud",
        name: "appdock_speech_speak",
        input: { text },
        settings: {
          revision: "split-" + revision,
          storageScope: "shared",
          value,
        },
      },
      f.signal,
    );
    assert.deepEqual(f.calls.at(-1)[1].segments, expected);
    await f.invoke("audition.speak", { text, connectionId: "alice" });
    assert.deepEqual(f.calls.at(-1)[1].segments, expected);
  }
  assert.equal(f.storage.reads.length, reads);
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
    ["text.open", "audition.open"],
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
test("audition opens without audio and submits the current Speak plan to the selected connection", async () => {
  const f = fixture();
  f.storage.data.set(
    "shared/user.csv",
    "hello,ハロー\nenglish,イングリッシュ\npython,パイソン",
  );
  await f.start();
  f.set({
    prefixText: "Hello!",
    suffixText: "!Python",
    prefixNewline: false,
    suffixNewline: false,
    targetCharacters: 8,
    startMode: "count",
    startCount: 2,
  });
  const reads = f.storage.reads.length;
  const opened = await f.invoke("audition.open");
  assert.equal(opened.dialog.submit.id, "audition.speak");
  assert.equal(opened.dialog.values.connectionId, "");
  assert.deepEqual(
    opened.dialog.fields.find((field) => field.key === "connectionId").options,
    [
      { value: "", label: "既定の接続" },
      { value: "alice", label: "ALICE" },
    ],
  );
  assert.deepEqual(
    f.calls.map(([method]) => method),
    ["tts.connections.list"],
  );
  const values = { text: "English。次です。", connectionId: "alice" };
  const preview = await f.invoke("text.preview", values);
  const originalCall = f.context.appdock.call;
  let accept;
  f.context.appdock.call = async (method, params) => {
    if (method !== "tts.sequences.speak") return originalCall(method, params);
    f.calls.push([method, params]);
    return new Promise((resolve) => {
      accept = resolve;
    });
  };
  let returned = false;
  const pending = f.invoke("audition.speak", values).then((result) => {
    returned = true;
    return result;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(returned, false);
  const sent = f.calls.at(-1);
  assert.equal(sent[0], "tts.sequences.speak");
  assert.equal(sent[1].segments.join(""), preview.dialog.values.replaced);
  assert.equal(
    sent[1].segments.join(""),
    "ハロー!イングリッシュ。次です。!パイソン",
  );
  assert(sent[1].segments.length > 1);
  assert.equal(sent[1].connectionId, "alice");
  assert(!Object.hasOwn(sent[1], "instructions"));
  assert.deepEqual(sent[1].startPolicy, { mode: "count", count: 2 });
  accept({ sequenceId: "fixture", completion: "accepted" });
  const reply = await pending;
  assert(reply.feedback);
  assert.deepEqual(reply.dialog.values, values);
  f.context.appdock.call = originalCall;
  f.set({ prefixText: "前。", splitEnabled: false });
  await f.invoke("audition.speak", { text: "Hello!", connectionId: "" });
  assert.deepEqual(f.calls.at(-1), [
    "tts.sequences.speak",
    { segments: ["前。\nハロー!"], startPolicy: { mode: "first" } },
  ]);
  assert.equal(f.storage.reads.length, reads);
  assert.equal(f.storage.writes.length, 0);
});

test("audition validates text and connections and never retries a failed host acceptance", async () => {
  const f = fixture();
  await f.start();
  for (const values of [
    { text: " \n " },
    { text: "試聴", connectionId: "missing" },
    { text: "試聴", connectionId: 3 },
  ])
    assert.equal(
      (await f.invoke("audition.speak", values)).issue.kind,
      "validation",
    );
  assert.equal(
    f.calls.filter(([method]) => method === "tts.sequences.speak").length,
    0,
  );
  f.context.appdock.call = async (method, params) => {
    f.calls.push([method, params]);
    if (method === "tts.connections.list") return { connections: [] };
    throw Error("must not synthesize");
  };
  const opened = await f.invoke("audition.open");
  assert.equal(opened.dialog.submit.disabled, true);
  assert.match(opened.dialog.fields[1].description, /音声生成AI/);
  assert.equal(
    (await f.invoke("audition.speak", { text: "試聴" })).issue.kind,
    "validation",
  );
  f.context.appdock.call = async (method, params) => {
    f.calls.push([method, params]);
    if (method === "tts.connections.list")
      return { connections: [{ id: "alice", name: "ALICE" }] };
    throw Object.assign(Error("connection removed before acceptance"), {
      code: "NOT_FOUND",
    });
  };
  await assert.rejects(
    f.invoke("audition.speak", { text: "試聴", connectionId: "alice" }),
    { code: "NOT_FOUND" },
  );
  assert.equal(
    f.calls.filter(([method]) => method === "tts.sequences.speak").length,
    1,
  );
  assert.equal(f.storage.writes.length, 0);
});

test("audition rechecks authorization and cancellation after connection lookup", async () => {
  const f = fixture();
  await f.start();
  f.context.providers.authorize = async () => {
    throw Object.assign(Error("revoked"), { code: "CANCELLED" });
  };
  await assert.rejects(f.invoke("audition.speak", { text: "試聴" }), {
    code: "CANCELLED",
  });
  assert.equal(
    f.calls.filter(([method]) => method === "tts.sequences.speak").length,
    0,
  );
  const controller = new AbortController();
  let finishLookup;
  f.context.appdock.call = (method) => {
    assert.equal(method, "tts.connections.list");
    return new Promise((resolve) => {
      finishLookup = resolve;
    });
  };
  const pending = f.extension.onProviderRequest(
    f.request("audition.speak", { text: "試聴" }),
    controller.signal,
  );
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  finishLookup({ connections: [{ id: "alice", name: "ALICE" }] });
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(
    f.extension.onProviderRequest(
      {
        ...f.request("audition.speak", { text: "試聴" }),
        actor: { kind: "mcp", external: true },
      },
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
  const row = (await f.view()).tabs[1].panels[0].rows[0];
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
test("word views contain the full table without pagination or redundant panels and preserve PC scope", async () => {
  const f = fixture();
  f.set({
    dictionary: [{ id: "old", source: "旧辞書", replacement: "移行しない" }],
  });
  f.storage.data.set(
    "shared/user.csv",
    Array.from({ length: 250 }, (_, i) => `Word${i},ワード${i}`).join("\n"),
  );
  await f.start();
  assert.equal((await f.view()).tabs[1].panels.length, 1);
  assert.equal((await f.view()).tabs[2].panels.length, 1);
  assert.equal((await f.view()).tabs[1].panels[0].rows.length, 250);
  assert.equal(
    (await f.view()).tabs[1].panels[0].rows[249].values.source,
    "Word249",
  );
  await f.storage.switchScope("device");
  assert.equal((await f.view()).tabs[1].panels[0].rows.length, 0);
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
  assert.equal((await f.view()).tabs[1].panels[0].rows.length, 250);
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
