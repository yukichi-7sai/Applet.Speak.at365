const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const hostRoot = path.resolve(root, "../AppDock.at365");
const fromHost = (file) => require(path.join(hostRoot, file));
const hostRequire = require("node:module").createRequire(
  path.join(hostRoot, "package.json"),
);
const { Client } = hostRequire("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = hostRequire(
  "@modelcontextprotocol/sdk/client/streamableHttp.js",
);
const { isolatedHost, until } = fromHost("scripts/data-settings-host.cjs");
const { settingsPage } = fromHost("scripts/settings-host-helper.cjs");
const { settleSettings } = fromHost("scripts/settings-immediate-helper.cjs");
const { inspectTtsWave } = fromHost("out/main/main/core/tts-wave");
const { wave } = fromHost("scripts/audio-fixture.cjs");
const artifacts = path.join(root, ".artifacts");
fs.mkdirSync(artifacts, { recursive: true });
const profile = fs.mkdtempSync(path.join(artifacts, "recording-ui-"));
const applet = path.resolve(process.argv[3] || root);
const install = path.join(profile, "extensions/at365.speak");
const shipped = [
  "extension.json",
  "index.cjs",
  ...fs
    .readdirSync(path.join(applet, "src"))
    .filter((name) => name.endsWith(".cjs"))
    .map((name) => "src/" + name),
];
fs.mkdirSync(path.join(install, "src"), { recursive: true });
for (const name of shipped)
  fs.copyFileSync(path.join(applet, name), path.join(install, name));
const manifest = require(path.join(install, "extension.json"));
const host = isolatedHost(
  profile,
  process.argv[2] === "--source" ? undefined : path.resolve(process.argv[2]),
  artifacts,
);
const space = path.join(profile, "data/space");
const chosen = path.join(space, "読み上げ");
fs.mkdirSync(chosen, { recursive: true });
const waves = [],
  inputs = [];
const server = http.createServer(async (req, res) => {
  if (req.url !== "/v1/audio/speech" || req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }
  let data = "";
  for await (const chunk of req) data += chunk;
  inputs.push(JSON.parse(data).input);
  const bytes = wave(100, inputs.length);
  waves.push(bytes);
  res.writeHead(200, { "content-type": "audio/wav" }).end(bytes);
});
const evidence = {
  version: manifest.version,
  hostSha256: host.executableHash,
  checks: [],
};
let page;
(async () => {
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const settings = fromHost(
      "out/main/shared/settings-schema",
    ).createDefaultSettings();
    settings.extensions[manifest.id] = {
      enabled: true,
      settings: { targetCharacters: 2 },
    };
    settings.keybindings = [];
    settings.gestures.enabled = settings.touchpadGestures.enabled = false;
    settings.host.hardwareAcceleration = false;
    settings.host.soundEnabled = true;
    settings.updates.checkHostOnStartup =
      settings.updates.checkAppletsOnStartup = false;
    settings.tts = {
      connections: [
        {
          ...fromHost("out/main/shared/tts").newTtsServer("fixture"),
          name: "音声サーバー",
          baseUrl: "http://127.0.0.1:" + server.address().port + "/v1",
          authentication: "none",
          model: "fixture",
          defaultVoice: "fixture",
        },
      ],
      defaultConnectionId: "fixture",
    };
    fromHost("scripts/test-settings.cjs").write(profile, settings);
    const open = async () => {
      page = await host.start();
      await page.evaluate(() =>
        window.dock.executeCommand("appdock.settings.open"),
      );
      await settingsPage(page);
      await page.getByRole("button", { name: "Speak", exact: true }).click();
      await page
        .getByRole("switch", { name: "読み上げた音声を自動保存" })
        .waitFor();
    };
    await open();
    const toggle = (name) => page.getByRole("switch", { name, exact: true });
    const button = (name) => page.getByRole("button", { name, exact: true });
    const directory = () =>
      page.getByRole("textbox", { name: "WAVの保存先", exact: true });
    assert.equal(await directory().count(), 0);
    await toggle("読み上げた音声を自動保存").click();
    await settleSettings(page);
    assert.equal(await directory().getAttribute("placeholder"), "スペース");
    await host.evaluate((electron, target) => {
      globalThis.recordingPicker = [];
      electron.dialog.showOpenDialog = async (_owner, options) => {
        const calls = globalThis.recordingPicker;
        calls.push(options);
        return calls.length === 2
          ? { canceled: false, filePaths: [target] }
          : { canceled: true, filePaths: [] };
      };
    }, chosen);
    const choose = () => button("WAVの保存先を選ぶ").click();
    await choose();
    assert.equal(await directory().inputValue(), "");
    await choose();
    await until(
      async () => (await directory().inputValue()) === chosen,
      "selected path shown",
    );
    await settleSettings(page);
    await choose();
    const calls = await host.evaluate(() => globalThis.recordingPicker);
    assert.deepEqual(
      calls.map((c) => c.defaultPath),
      [space, space, chosen],
    );
    assert(calls.every((c) => c.properties.includes("openDirectory")));
    evidence.checks.push(
      "Windows directory dialog starts in Space, cancellation and chosen folder",
    );
    const audition = async () => {
      const before = waves.length;
      await button("試聴").click();
      const dialog = page.getByRole("dialog", { name: "読み上げの試聴" });
      await dialog
        .getByRole("textbox", { name: "読み上げる文章" })
        .fill("一。二。");
      await dialog.getByRole("button", { name: "試聴する" }).click();
      await until(
        () => waves.length === before + 2,
        "fixture generated both parts",
      );
      await dialog.press("Escape");
    };
    await audition();
    const folder = path.join(chosen, "音声サーバー");
    await until(
      () => fs.existsSync(folder) && fs.readdirSync(folder).length === 2,
      "two original WAV files",
    );
    const split = fs.readdirSync(folder).sort();
    split.forEach((name, i) =>
      assert.deepEqual(fs.readFileSync(path.join(folder, name)), waves[i]),
    );
    evidence.checks.push(
      "one original WAV per spoken part in the resolved server folder",
    );
    await toggle("分割した音声を1本のWAVにまとめる").click();
    await settleSettings(page);
    await toggle("サーバー名ごとにフォルダーを分ける").click();
    await settleSettings(page);
    await host.close();
    await open();
    assert.equal(await directory().inputValue(), chosen);
    assert.equal(
      await toggle("分割した音声を1本のWAVにまとめる").getAttribute(
        "aria-checked",
      ),
      "true",
    );
    await audition();
    const outputs = () =>
      fs.readdirSync(chosen).filter((name) => name.endsWith(".wav"));
    await until(() => outputs().length === 1, "one combined WAV");
    const joined = inspectTtsWave(
      fs.readFileSync(path.join(chosen, outputs()[0])),
    );
    assert.deepEqual(
      Buffer.concat(joined.chunks),
      Buffer.concat(waves.slice(2).map((b) => b.subarray(44))),
    );
    assert.deepEqual(inputs, ["一。", "二。", "一。", "二。"]);
    evidence.checks.push(
      "saved preferences survive restart; joined samples match playback in order",
    );
    await page.evaluate(() =>
      window.dock.executeCommand("appdock.settings.tts.open"),
    );
    await button("音声サーバーを複製").click();
    const editor = page.getByRole("dialog");
    const name = editor.getByRole("textbox", { name: "登録名", exact: true });
    await name.fill("音声サーバー");
    await editor.getByRole("button", { name: "OK", exact: true }).click();
    await editor
      .getByText(
        "同じ登録名の音声サーバーがあります。別の名前を入力してください。",
        { exact: true },
      )
      .first()
      .waitFor();
    await name.fill("音声サーバー2");
    await editor.getByRole("button", { name: "OK", exact: true }).click();
    await editor.waitFor({ state: "hidden" });
    await button("音声サーバー2の設定").waitFor();
    evidence.checks.push(
      "duplicate server name rejected; a distinct name registers from the same dialog",
    );
    const endpoint = await page.evaluate(async () => {
      await window.dock.automation({
        kind: "setModule",
        moduleId: "at365.speak.read-aloud",
        enabled: true,
      });
      await window.dock.automation({
        kind: "setAuthentication",
        authentication: "none",
      });
      const started = await window.dock.automation({
        kind: "configure",
        enabled: true,
        port: 0,
      });
      return started.state.endpoint;
    });
    const client = new Client({
      name: "Speak recording fixture",
      version: "1",
    });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(endpoint)),
      );
      const earlier = outputs();
      const result = await client.callTool({
        name: "appdock_speech_speak",
        arguments: { text: "三。四。", connectionName: "音声サーバー2" },
      });
      assert.deepEqual(result.structuredContent, { accepted: true });
      const name = await until(
        () => outputs().find((file) => !earlier.includes(file)),
        "WAV from MCP speech",
      );
      const audio = inspectTtsWave(fs.readFileSync(path.join(chosen, name)));
      assert.deepEqual(inputs.slice(4), ["三。", "四。"]);
      assert.deepEqual(
        Buffer.concat(audio.chunks),
        Buffer.concat(waves.slice(4).map((b) => b.subarray(44))),
      );
      evidence.checks.push(
        "ordinary MCP Speak saves both played parts in a single WAV",
      );
    } finally {
      await client.close();
    }
    evidence.ok = true;
  } catch (error) {
    evidence.error = String(error);
    await page
      ?.screenshot({ path: path.join(profile, "failure.png") })
      .catch(() => {});
    throw error;
  } finally {
    await host.close();
    server.close();
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(evidence, null, 2),
    );
    console.log(profile, evidence);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
