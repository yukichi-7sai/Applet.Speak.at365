const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createExtension } = require("../index.cjs");
const manifest = require("../extension.json");
function fixture() {
  const extension = createExtension(),
    calls = [],
    saved = [];
  let value = {},
    revision = 1;
  const context = {
    settings: {
      get: (key, fallback) => value[key] ?? fallback,
      replaceList: async (key, next, before) => {
        if (JSON.stringify(value[key] ?? []) !== JSON.stringify(before))
          throw Error("Conflict");
        value[key] = next;
        saved.push(next);
      },
    },
    providers: {
      settings: async () => ({ revision: String(revision), value: {} }),
      authorize: async () => ({ kind: "host" }),
    },
    appdock: {
      call: async (...args) => {
        calls.push(args);
        return { completion: "accepted" };
      },
    },
    ui: {},
  };
  const request = (method, values) => ({
    method,
    params: { providerId: "helpers", values },
    actor: { kind: "host", external: false },
    authorization: "host",
  });
  return {
    extension,
    calls,
    saved,
    context,
    request,
    set(v) {
      value = v;
      revision++;
    },
    async start() {
      await extension.activate(context);
    },
  };
}
test("one MCP tool accepts four public fields and sends only a prepared host sequence", async () => {
  const f = fixture();
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
  const input = {
    text: "AppDockです。",
    connectionId: "id",
    connectionName: "name",
    instructions: "静かに",
  };
  assert.deepEqual(
    await f.extension.onMcpTool(
      {
        moduleId: "at365.speak.read-aloud",
        name: tool[0].name,
        input,
        settings: {
          revision: "snapshot",
          value: {
            splitEnabled: false,
            dictionary: [
              { id: "row", source: "AppDock", replacement: "アップドック" },
            ],
          },
        },
      },
      new AbortController().signal,
    ),
    { accepted: true },
  );
  assert.deepEqual(f.calls, [
    [
      "tts.sequences.speak",
      {
        segments: ["アップドックです。"],
        startPolicy: { mode: "first" },
        connectionId: "id",
        connectionName: "name",
        instructions: "静かに",
      },
    ],
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
        settings: { revision: "a", value: {} },
      },
      new AbortController().signal,
    )
    .then((r) => {
      returned = true;
      return r;
    });
  await new Promise((r) => setImmediate(r));
  assert.equal(returned, false);
  accept({ completion: "accepted" });
  assert.deepEqual(await pending, { accepted: true });
});
test("preview has no save, network, generation or playback and import is previewed then atomic", async () => {
  const f = fixture();
  await f.start();
  const signal = new AbortController().signal;
  const view = await f.extension.onProviderRequest(
    f.request("snapshot", {}),
    signal,
  );
  assert.deepEqual(
    view.tabs.map((tab) => tab.id),
    ["settings", "user-dictionary"],
  );
  assert.deepEqual(
    view.tabs[0].toolbar.map((action) => action.id),
    ["text.open"],
  );
  assert.deepEqual(
    view.tabs[1].toolbar[0].items.map((action) => action.id),
    ["csv.open", "csv.paste"],
  );
  assert.equal(view.tabs[1].toolbar[1].id, "csv.export");
  assert(view.tabs.every((tab) => tab.panels.length === 0));
  const preview = await f.extension.onProviderRequest(
    f.request("text.preview", { text: "プレビューです。" }),
    signal,
  );
  assert.equal(preview.dialog.values.replaced, "プレビューです。");
  assert.equal(f.calls.length, 0);
  assert.equal(f.saved.length, 0);
  const invalid = await f.extension.onProviderRequest(
    f.request("csv.preview", { csv: "a,b,c", before: [] }),
    signal,
  );
  assert.equal(invalid.issue.kind, "validation");
  assert.equal(f.saved.length, 0);
  const imported = await f.extension.onProviderRequest(
    f.request("csv.preview", { csv: "AppDock,アップドック", before: [] }),
    signal,
  );
  assert.equal(f.saved.length, 0);
  const reply = await f.extension.onProviderRequest(
    f.request("csv.apply", {
      ...imported.dialog.values,
      ...imported.dialog.submit.values,
    }),
    signal,
  );
  assert.ok(reply.feedback);
  assert.equal(f.saved.length, 1);
  await assert.rejects(
    f.extension.onProviderRequest(
      f.request("csv.apply", { csv: "MCP,エムシーピー", before: [] }),
      signal,
    ),
    /Conflict/,
  );
  assert.equal(f.saved.length, 1);
  await assert.rejects(
    f.extension.onProviderRequest(
      { ...f.request("csv.apply", {}), actor: { kind: "mcp", external: true } },
      signal,
    ),
  );
});
