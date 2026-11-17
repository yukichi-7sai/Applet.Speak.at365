const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const hostRoot = path.resolve(root, "../AppDock.at365");
const { isolatedHost, until } = require(
  path.join(hostRoot, "scripts/data-settings-host.cjs"),
);
const settingsFiles = require(path.join(hostRoot, "scripts/test-settings.cjs"));
const { settingsPage } = require(
  path.join(hostRoot, "scripts/settings-host-helper.cjs"),
);
const { settleSettings } = require(
  path.join(hostRoot, "scripts/settings-immediate-helper.cjs"),
);
const artifacts = path.join(root, ".artifacts");
const profile = path.join(artifacts, `dictionary-ui-${Date.now()}`);
const applet = path.resolve(process.argv[3] || root);
const manifest = JSON.parse(
  fs.readFileSync(path.join(applet, "extension.json"), "utf8"),
);
const shipped = [
  "extension.json",
  "index.cjs",
  ...fs
    .readdirSync(path.join(applet, "src"))
    .filter((name) => name.endsWith(".cjs"))
    .map((name) => "src/" + name),
];
const installed = path.join(profile, "extensions/at365.speak");
fs.mkdirSync(path.join(installed, "src"), { recursive: true });
for (const name of shipped)
  fs.copyFileSync(path.join(applet, name), path.join(installed, name));
const settings = require(
  path.join(hostRoot, "out/main/shared/settings-schema"),
).createDefaultSettings();
settings.keybindings = [];
settings.gestures.enabled = false;
settings.host.hardwareAcceleration = false;
settings.updates.checkHostOnStartup =
  settings.updates.checkAppletsOnStartup = false;
settings.extensions["at365.speak"] = { enabled: true, settings: {} };
fs.writeFileSync(settingsFiles.file(profile), JSON.stringify(settings));
const shared = path.join(profile, "data/storage/at365.speak/shared/files");
const device = path.join(
  profile,
  "data/storage/at365.speak/devices",
  os.hostname(),
  "files",
);
const catalog = () =>
  JSON.parse(fs.readFileSync(path.join(shared, "catalog.json"), "utf8"))
    .dictionaries;
const readUser = () => fs.readFileSync(path.join(shared, "user.csv"), "utf8");
const userCsv =
  "\ufeff個人優先,個人\r\n共通,個人共通\r\n" +
  Array.from({ length: 248 }, (_, i) => `ユーザー${i},読み${i}`).join("\r\n") +
  "\r\n共通,後の重複\r\nhello,ハロー\r\npython,パイソン\r\njavascript,ジャヴァスクリプト\r\nenglish,イングリッシュ\r\nkey,キー\r\nboard,ボード";
const sourceCsv = (tag) =>
  `共通,${tag}\n個人優先,配布\n` +
  Array.from({ length: 50000 }, (_, i) => `固有${tag}${i},読み${tag}${i}`).join(
    "\n",
  ) +
  `\n共通,後の重複${tag}\n固有${tag}49999,後の重複する読み`;
const input = (name, csv) => {
  const file = path.join(profile, name + ".csv");
  fs.writeFileSync(file, csv);
  return file;
};
const userInput = input("user-input", userCsv),
  sourceA = input("source-A", sourceCsv("A")),
  sourceB = input("source-B", sourceCsv("B"));
const host = isolatedHost(
  profile,
  process.argv[2] === "--source" ? undefined : path.resolve(process.argv[2]),
  artifacts,
);
const checks = [];
const measurements = [];
let page;
const button = (name) => page.getByRole("button", { name, exact: true });
const tab = (id) => page.getByTestId("provider-settings-tab:" + id).click();
const reload = () =>
  page
    .getByTestId("settings-page-tools")
    .getByRole("button", { name: "再読み込み", exact: true })
    .click();
async function open() {
  page = await host.start();
  await page.evaluate(() =>
    window.dock.executeCommand("appdock.settings.open"),
  );
  await settingsPage(page);
  await button(manifest.displayName).click();
  await page
    .getByRole("switch", { name: "辞書で置き換える", exact: true })
    .waitFor();
}
async function selectFile(file, save = false) {
  await host.evaluate(
    (electron, value) => {
      if (value.save)
        electron.dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: value.file,
        });
      else
        electron.dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [value.file],
        });
    },
    { file, save },
  );
}
async function importFile(file, name, row) {
  await selectFile(file);
  if (name) {
    await tab("source-dictionaries");
    if (row)
      await page
        .getByRole("row")
        .filter({ hasText: row })
        .getByRole("button", { name: "再インポート", exact: true })
        .click();
    else
      await page
        .getByTestId("provider:helpers:source-dictionaries:add")
        .click();
    await page.getByRole("textbox", { name: "辞書名", exact: true }).fill(name);
    await button("辞書を取り込む").click();
  } else {
    await tab("user-dictionary");
    await button("取り込み").click();
    await page
      .getByRole("menuitem", { name: "CSVファイルを取り込む", exact: true })
      .click();
    await button("ユーザー辞書を置き換える").click();
  }
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
async function preview(text, expected, segments) {
  await tab("settings");
  await button("文章プレビュー").click();
  await page
    .getByRole("textbox", { name: "読み上げる文章", exact: true })
    .fill(text);
  await button("プレビューする").click();
  const output = page.getByRole("textbox", {
    name: "置換後の文章",
    exact: true,
  });
  await output.waitFor();
  assert.equal(await output.inputValue(), expected);
  if (segments) {
    assert.equal(
      await page
        .getByRole("textbox", {
          name: `分割結果: ${segments.length}個`,
          exact: true,
        })
        .inputValue(),
      segments.map((part, i) => `${i + 1}. ${part}`).join("\n\n"),
    );
  }
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
async function useShared() {
  await page.getByTestId("settings-storage-local").click();
  await page
    .getByRole("radio", {
      name: "このPCの設定を残して共有設定に戻す",
      exact: true,
    })
    .check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "切り替える", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await settleSettings(page);
}
(async () => {
  try {
    await open();
    await page
      .getByRole("heading", { name: "前後の文章", exact: true })
      .waitFor();
    for (const name of ["前に付ける文章", "後に付ける文章"])
      assert.equal(
        await page.getByRole("textbox", { name, exact: true }).inputValue(),
        "",
      );
    const prefixNewline = () =>
      page.getByRole("switch", {
        name: "前の文章の後に改行を入れる",
        exact: true,
      });
    const suffixNewline = () =>
      page.getByRole("switch", {
        name: "後の文章の前に改行を入れる",
        exact: true,
      });
    assert.equal(await prefixNewline().isChecked(), true);
    assert.equal(await suffixNewline().isChecked(), true);
    const additionTiming = () =>
      page.getByRole("combobox", {
        name: "前後の文章を追加するタイミング",
        exact: true,
      });
    assert.equal(await additionTiming().inputValue(), "before-split");
    await page
      .getByRole("heading", { name: "辞書変換", exact: true })
      .waitFor();
    const caseChoice = () =>
      page.getByRole("switch", {
        name: "英字の大文字・小文字を区別しない",
        exact: true,
      });
    assert.equal(await caseChoice().isChecked(), true);
    const splitField = () =>
      page.getByRole("textbox", { name: "分割に使う文字", exact: true });
    const newlineChoice = () =>
      page.getByRole("switch", { name: "改行を分割候補にする", exact: true });
    const spaceChoice = () =>
      page.getByRole("switch", {
        name: "スペースを分割候補にする",
        exact: true,
      });
    const saveSplit = async (name, value) => {
      await page.getByLabel(name, { exact: true }).fill(value);
      await page.keyboard.press("Enter");
      await settleSettings(page);
    };
    const splitMode = () =>
      page.getByRole("combobox", { name: "分割方式", exact: true });
    assert.equal(await splitMode().inputValue(), "characters");
    assert.equal(await splitField().inputValue(), ".!?。！？．｡");
    assert.equal(await newlineChoice().isChecked(), true);
    assert.equal(await spaceChoice().isChecked(), false);
    await saveSplit("分割の目安文字数", "6");
    await preview("本当！？そうなんだ。", "本当！？そうなんだ。", [
      "本当！？",
      "そうなんだ。",
    ]);
    await preview("あああ、いいい。う", "あああ、いいい。う", [
      "あああ、いいい。",
      "う",
    ]);
    await saveSplit("分割に使う文字", "、。");
    await preview("あああ、いいい。う", "あああ、いいい。う", [
      "あああ、",
      "いいい。う",
    ]);
    await saveSplit("分割に使う文字", "|");
    await newlineChoice().click();
    await settleSettings(page);
    await spaceChoice().click();
    await settleSettings(page);
    await splitMode().focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await settleSettings(page);
    assert.equal(await splitMode().inputValue(), "sentences");
    assert.equal(await splitField().count(), 0);
    assert.equal(await newlineChoice().count(), 0);
    assert.equal(await spaceChoice().count(), 0);
    assert.equal(
      await page.getByLabel("分割の目安文字数", { exact: true }).inputValue(),
      "6",
    );
    await preview("一、二。\n三 四|五", "一、二。\n三 四|五", [
      "一、二。\n",
      "三 四|五",
    ]);
    await splitMode().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(profile, "splitting-sentences.png"),
    });
    await host.close();
    await open();
    assert.equal(await splitMode().inputValue(), "sentences");
    assert.equal(await splitField().count(), 0);
    const settingsSearch = page.getByRole("combobox", {
      name: "設定を検索",
      exact: true,
    });
    await settingsSearch.fill("分割に使う文字");
    await page.getByRole("option", { name: /分割に使う文字/ }).click();
    await page
      .locator(
        '[data-setting-item="applet%3Aat365.speak/setting%3AsplitMode"].setting-highlight',
      )
      .waitFor();
    await settingsSearch.fill("");
    assert.equal(await splitMode().inputValue(), "sentences");
    await splitMode().selectOption("characters");
    await settleSettings(page);
    assert.equal(await splitField().inputValue(), "|");
    assert.equal(await newlineChoice().isChecked(), false);
    assert.equal(await spaceChoice().isChecked(), true);
    await splitMode().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(profile, "splitting-characters.png"),
    });
    await preview("one two|three", "one two|three", ["one ", "two|", "three"]);
    await spaceChoice().click();
    await settleSettings(page);
    await preview("one two|three", "one two|three", ["one two|", "three"]);
    await saveSplit("分割に使う文字", "");
    await preview("あああ。\nいいい", "あああ。\nいいい", ["あああ。\nいいい"]);
    await newlineChoice().click();
    await settleSettings(page);
    await preview("あああ\nいいい", "あああ\nいいい", ["あああ\n", "いいい"]);
    await saveSplit("分割に使う文字", ".!?。！？．｡");
    await saveSplit("分割の目安文字数", "300");
    checks.push(
      "nearest configured boundaries, earlier ties, comma exclusion, independent newline/space choices and empty delimiter settings persist across restart with preview parity",
    );
    checks.push(
      "sentence mode, grouped punctuation, keyboard selection, hidden field search redirection and retained delimiter values survive restart",
    );
    await importFile(userInput);
    assert.equal(readUser(), userCsv);
    const words = () =>
      page.getByRole("table", { name: "ユーザー辞書", exact: true });
    assert.equal(
      await page
        .getByRole("heading", { name: "表示範囲", exact: true })
        .count(),
      0,
    );
    assert.equal(await button("次のページ").count(), 0);
    assert.equal(await words().getAttribute("aria-rowcount"), "257");
    assert((await words().locator("[data-virtual-row]").count()) < 200);
    const wordSearch = () =>
      page.getByRole("searchbox", { name: "ユーザー辞書を検索", exact: true });
    await wordSearch().fill("ユーザー98");
    await page.keyboard.press("Enter");
    await words()
      .getByRole("button", { name: "ユーザー98を編集", exact: true })
      .waitFor();
    await wordSearch().fill("");
    await page.keyboard.press("Enter");
    const exported = path.join(profile, "exported.csv");
    await selectFile(exported, true);
    await button("書き出し").click();
    await until(
      () =>
        fs.existsSync(exported) &&
        fs.readFileSync(exported, "utf8") === userCsv,
      "complete CSV export",
    );
    assert.equal(fs.readFileSync(exported, "utf8"), userCsv);
    assert.equal(
      (await page.evaluate(() => window.dock.snapshot())).settings.value
        .extensions["at365.speak"].settings.dictionary,
      undefined,
    );
    checks.push(
      "UTF-8 BOM/CRLF user CSV imports and exports unchanged; 256 words form one virtual table without pagination or entering Settings JSON",
    );

    const largeCount = Number(process.env.APPDOCK_TEST_USER_WORDS || 10000);
    const virtualErrors = [];
    const captureVirtualError = (error) => virtualErrors.push(error.message);
    page.on("pageerror", captureVirtualError);
    const largeInput = input(
      "large-user",
      Array.from(
        { length: largeCount },
        (_, i) =>
          `仮想${i},${i === largeCount - 1 ? "折り返す長い読み".repeat(30) : `読み${i}`}`,
      ).join("\n"),
    );
    const largeStart = performance.now();
    await importFile(largeInput);
    await words().waitFor();
    const renderCount = await words().locator("[data-virtual-row]").count();
    assert(renderCount < 200);
    assert.equal(
      await words().getAttribute("aria-rowcount"),
      String(largeCount + 1),
    );
    const lastRendered = await words()
      .locator("[data-virtual-row]")
      .last()
      .evaluate((row) => {
        const controls = [...row.querySelectorAll("button")].filter(
          (button) => button.tabIndex >= 0 && !button.disabled,
        );
        controls.at(-1).focus();
        return Number(row.dataset.virtualRow);
      });
    await page.keyboard.press("Tab");
    assert.equal(
      await words().evaluate((table) =>
        Number(
          document.activeElement.closest("[data-virtual-row]")?.dataset
            .virtualRow,
        ),
      ),
      lastRendered + 1,
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await words().evaluate((table) =>
        Number(
          document.activeElement.closest("[data-virtual-row]")?.dataset
            .virtualRow,
        ),
      ),
      lastRendered,
    );
    await words().evaluate((table) => {
      for (
        let parent = table.parentElement;
        parent;
        parent = parent.parentElement
      )
        if (
          /(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
          parent.scrollHeight > parent.clientHeight
        ) {
          parent.scrollTop = parent.scrollHeight;
          return;
        }
    });
    const lastWord = words().getByRole("button", {
      name: `仮想${largeCount - 1}を編集`,
      exact: true,
    });
    await lastWord.waitFor();
    await lastWord.click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "置換元", exact: true })
        .inputValue(),
      `仮想${largeCount - 1}`,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const middle = Math.floor(largeCount / 2);
    await host.evaluate((electron) =>
      electron.BrowserWindow.getAllWindows()
        .find((window) =>
          window.webContents.getURL().startsWith("appdock://host/"),
        )
        .setSize(760, 900),
    );
    await lastWord.scrollIntoViewIfNeeded();
    assert(
      (await lastWord.evaluate(
        (button) => button.closest("tr").getBoundingClientRect().height,
      )) > 150,
      "long readings wrap into a measured variable-height row",
    );
    await page.screenshot({ path: path.join(profile, "user-virtual-end.png") });
    await wordSearch().fill(`仮想${middle}`);
    await page.keyboard.press("Enter");
    await words()
      .getByRole("button", { name: `仮想${middle}を編集`, exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "置換先", exact: true })
      .fill("仮想編集済み");
    await button("OK").click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert(readUser().includes(`仮想${middle},仮想編集済み`));
    measurements.push({
      userWords: largeCount,
      importScrollEditMs: Math.round(performance.now() - largeStart),
      initialRenderedRows: renderCount,
    });
    page.off("pageerror", captureVirtualError);
    assert.deepEqual(virtualErrors, []);
    await wordSearch().fill("");
    await page.keyboard.press("Enter");
    await importFile(userInput);
    assert.equal(readUser(), userCsv);
    checks.push(
      "large user dictionary keeps mounted rows bounded, reaches wrapped final rows, preserves Tab/Shift+Tab order across virtual boundaries and edits searched rows by stable ID",
    );

    const caseInput =
      "Hello PYTHON JavaScript English keyboard key board MyPython";
    const converted =
      "ハロー パイソン ジャヴァスクリプト イングリッシュ keyboard キー ボード MyPython";
    const sensitive =
      "Hello PYTHON JavaScript English keyboard キー ボード MyPython";
    await preview(caseInput, converted);
    await caseChoice().click();
    await settleSettings(page);
    await preview(caseInput, sensitive);
    await caseChoice().click();
    await settleSettings(page);
    await preview(caseInput, converted);
    assert.equal(readUser(), userCsv);
    checks.push(
      "dictionary conversion defaults to case-insensitive ASCII matching, switches immediately and preserves whole-word boundaries and CSV bytes",
    );

    await importFile(sourceA, "辞書A");
    await importFile(sourceB, "辞書B");
    for (const [i, entry] of catalog().entries()) {
      assert.equal(
        fs.readFileSync(path.join(shared, entry.file), "utf8"),
        fs.readFileSync([sourceA, sourceB][i], "utf8"),
      );
    }
    assert.deepEqual(
      catalog().map((entry) => entry.count),
      [50002, 50002],
    );
    await preview(
      "共通 個人優先 固有A49999 固有B49999",
      "個人共通 個人 読みA49999 読みB49999",
    );
    await tab("user-dictionary");
    await words()
      .getByRole("button", { name: "共通を削除", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "OK", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await preview("共通 個人優先", "A 個人");
    await tab("source-dictionaries");
    assert.equal(
      await page
        .getByRole("heading", { name: "辞書の優先順", exact: true })
        .count(),
      0,
    );
    await page
      .getByTestId("provider:helpers:source-dictionaries:list:order")
      .click();
    await button("辞書Bの順番を変更").focus();
    await page.keyboard.press("ArrowUp");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "OK", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(
      catalog().map((entry) => entry.name),
      ["辞書B", "辞書A"],
    );
    await preview("共通 個人優先", "B 個人");
    await tab("source-dictionaries");
    await page
      .getByRole("row")
      .filter({ hasText: "辞書B" })
      .getByRole("switch")
      .click();
    await until(() => catalog()[0].enabled === false, "disable source");
    await preview("共通", "A");
    checks.push(
      "duplicate CSV rows merge into 100,004 distributed keys; first rows, user priority, keyboard order and enable switches decide lookup",
    );

    const oldA = catalog().find((entry) => entry.name === "辞書A");
    const changedA = input("source-A-new", "共通,改A\n別語,べつ");
    await importFile(changedA, "辞書A", "辞書A");
    const newA = catalog().find((entry) => entry.name === "辞書A");
    assert.equal(newA.id, oldA.id);
    assert.notEqual(newA.file, oldA.file);
    assert.equal(fs.existsSync(path.join(shared, oldA.file)), false);
    assert.equal(catalog()[0].enabled, false);
    await preview("共通 別語", "改A べつ");
    await tab("source-dictionaries");
    await button("辞書Bを編集").click();
    await page
      .getByRole("textbox", { name: "辞書名", exact: true })
      .fill("辞書B改");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "OK", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const oldB = catalog()[0];
    await button("辞書B改を削除").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "OK", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(catalog().length, 1);
    assert.equal(fs.existsSync(path.join(shared, oldB.file)), false);
    assert.equal(fs.existsSync(sourceB), true);
    checks.push(
      "re-import preserves identity and priority, rename persists, removal deletes only the managed copy",
    );

    const good = readUser();
    fs.writeFileSync(path.join(shared, "user.csv"), "invalid,three,columns");
    await reload();
    await page
      .getByText("保存先のCSVとcatalog.jsonを確認し", { exact: false })
      .waitFor();
    await preview("共通 個人優先", "改A 個人");
    fs.writeFileSync(path.join(shared, "user.csv"), good);
    await tab("source-dictionaries");
    await reload();
    await until(
      async () =>
        (await page
          .getByText("保存先のCSVとcatalog.jsonを確認し", { exact: false })
          .count()) === 0,
      "reload recovery",
    );
    checks.push(
      "invalid external CSV retains the previous usable dictionary and explicit reload recovers",
    );

    await page.getByTestId("settings-storage-local").click();
    await settleSettings(page);
    await page.getByRole("table", { name: "配布辞書", exact: true }).waitFor();
    await until(
      async () =>
        (await page
          .getByRole("table", { name: "配布辞書", exact: true })
          .getByRole("switch")
          .count()) === 0,
      "device empty catalog",
    );
    await preview("共通 個人優先", "共通 個人優先");
    await tab("user-dictionary");
    await page.getByTestId("provider:helpers:user-words:add").click();
    await page
      .getByRole("textbox", { name: "置換元", exact: true })
      .fill("共通");
    await page
      .getByRole("textbox", { name: "置換先", exact: true })
      .fill("PC専用");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "OK", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      fs.readFileSync(path.join(device, "user.csv"), "utf8").trimEnd(),
      "共通,PC専用",
    );
    await preview("共通", "PC専用");
    await useShared();
    await preview("共通 個人優先", "改A 個人");
    assert.equal(readUser(), good);
    await caseChoice().click();
    await settleSettings(page);
    await host.close();
    await open();
    assert.equal(await caseChoice().isChecked(), false);
    await preview(caseInput, sensitive);
    await caseChoice().click();
    await settleSettings(page);
    await preview(caseInput, converted);
    await preview("共通 個人優先 別語", "改A 個人 べつ");
    checks.push(
      "shared/device dictionaries and the case-sensitive choice persist across host restart; switching back restores folded matching",
    );

    const additionField = (name) =>
      page.getByRole("textbox", { name, exact: true });
    const saveAddition = async (name, value) => {
      await tab("settings");
      await additionField(name).fill(value);
      await page.keyboard.press("Enter");
      await settleSettings(page);
    };
    await saveAddition("前に付ける文章", "Hello!");
    await saveAddition("後に付ける文章", "!Python.");
    await preview("English", "ハロー!\nイングリッシュ\n!パイソン.");
    await prefixNewline().click();
    await settleSettings(page);
    await preview("English", "ハロー!イングリッシュ\n!パイソン.");
    await suffixNewline().click();
    await settleSettings(page);
    await preview("English", "ハロー!イングリッシュ!パイソン.");
    await prefixNewline().click();
    await settleSettings(page);
    await preview("English", "ハロー!\nイングリッシュ!パイソン.");
    await prefixNewline().click();
    await settleSettings(page);
    assert.equal(readUser(), good);
    await page.getByLabel("分割の目安文字数", { exact: true }).fill("2");
    await page.keyboard.press("Enter");
    await settleSettings(page);
    await additionTiming().selectOption("after-split");
    await settleSettings(page);
    const decoratedParts = [
      "ハロー!一。!パイソン.",
      "ハロー!二。!パイソン.",
      "ハロー!三。!パイソン.",
    ];
    await preview("一。二。三。", decoratedParts.join(""), decoratedParts);
    await additionTiming().selectOption("before-split");
    await settleSettings(page);
    await preview("一。二。三。", "ハロー!一。二。三。!パイソン.");
    await additionTiming().selectOption("after-split");
    await settleSettings(page);
    await host.close();
    await open();
    assert.equal(await additionField("前に付ける文章").inputValue(), "Hello!");
    assert.equal(
      await additionField("後に付ける文章").inputValue(),
      "!Python.",
    );
    assert.equal(await prefixNewline().isChecked(), false);
    assert.equal(await suffixNewline().isChecked(), false);
    assert.equal(await additionTiming().inputValue(), "after-split");
    await preview("一。二。三。", decoratedParts.join(""), decoratedParts);
    checks.push(
      "addition timing defaults to before-split, switches to every-part additions without re-splitting, and persists across restart with preview parity",
    );
    await preview("English", "ハロー!イングリッシュ!パイソン.");
    await saveAddition("前に付ける文章", "   ");
    await saveAddition("後に付ける文章", " ");
    await preview("English", "イングリッシュ");
    await saveAddition("前に付ける文章", "");
    await saveAddition("後に付ける文章", "");
    await preview("English", "イングリッシュ");
    assert.equal(readUser(), good);
    await prefixNewline().click();
    await settleSettings(page);
    await suffixNewline().click();
    await settleSettings(page);
    await additionTiming().selectOption("before-split");
    await settleSettings(page);
    await page.getByLabel("分割の目安文字数", { exact: true }).fill("300");
    await page.keyboard.press("Enter");
    await settleSettings(page);
    checks.push(
      "prefix/suffix and independent newline choices persist across restart, all four combinations reach dictionary preview, and blank values add no text",
    );

    await tab("source-dictionaries");
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) => window.dock.executeCommand("appdock.theme." + value),
        theme,
      );
      await until(
        () =>
          page.evaluate(
            (value) => document.documentElement.dataset.theme === value,
            theme,
          ),
        "theme",
      );
      for (const width of [1280, 760]) {
        await host.evaluate(
          (electron, value) =>
            electron.BrowserWindow.getAllWindows()
              .find((window) =>
                window.webContents.getURL().startsWith("appdock://host/"),
              )
              .setSize(value, 900),
          width,
        );
        assert.equal(
          await page
            .locator(".settings-body")
            .evaluate(
              (element) => element.scrollWidth > element.clientWidth + 2,
            ),
          false,
        );
        await page.screenshot({
          path: path.join(profile, `dictionaries-${theme}-${width}.png`),
        });
      }
    }
    checks.push(
      "shared dictionary table stays within light/dark settings at 1280 and 760 pixels",
    );
    const result = {
      ok: true,
      profile,
      hostSha256: host.executableHash,
      version: manifest.version,
      inputHashes: Object.fromEntries(
        shipped.map((name) => [
          name,
          createHash("sha256")
            .update(fs.readFileSync(path.join(applet, name)))
            .digest("hex"),
        ]),
      ),
      checks,
      measurements,
    };
    fs.writeFileSync(
      path.join(profile, "result.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await page
      ?.screenshot({ path: path.join(profile, "failure.png") })
      .catch(() => {});
    throw error;
  } finally {
    await host.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
