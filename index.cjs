const fs = require("node:fs/promises");
const { createHash } = require("node:crypto");
const {
  InputError,
  validateDictionary,
  parseCsv,
  exportCsv,
  createProcessor,
} = require("./src/processing.cjs");
const manifest = require("./extension.json");
function createExtension() {
  let context;
  const processText = createProcessor();
  const current = () =>
    Object.fromEntries(
      manifest.settings.map((field) => [
        field.key,
        context.settings.get(field.key, field.default),
      ]),
    );
  const revision = (value) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const field = (key, title, readOnly = false) => ({
    key,
    title,
    type: "string",
    presentation: "multiline",
    readOnly,
    ...(!readOnly ? { initialFocus: true } : {}),
  });
  const dialog = (title, fields, values, submit, rev) => ({
    dialog: { title, fields, values, submit, revision: rev },
  });
  const csvPreview = (csv, before, rev) => {
    const rows = parseCsv(csv);
    return dialog(
      `辞書の取り込み: ${rows.length}件`,
      [field("csv", "取り込むCSV", true)],
      { csv },
      {
        id: "csv.apply",
        title: "辞書全体を置き換える",
        values: { before },
        primary: true,
      },
      rev,
    );
  };
  return {
    async activate(value) {
      context = value;
    },
    async onMcpTool(request, signal) {
      if (
        request.moduleId !== "at365.speech.read-aloud" ||
        request.name !== "appdock_speech_speak"
      )
        throw new InputError("読み上げツールが見つかりません。");
      const { text, connectionId, connectionName, instructions } =
        request.input;
      const plan = processText(
        text,
        request.settings.value,
        request.settings.revision,
      );
      signal.throwIfAborted();
      await context.appdock.call("tts.sequences.speak", {
        segments: plan.segments,
        startPolicy: plan.startPolicy,
        ...(connectionId !== undefined ? { connectionId } : {}),
        ...(connectionName !== undefined ? { connectionName } : {}),
        ...(instructions !== undefined ? { instructions } : {}),
      });
      return { accepted: true };
    },
    async onProviderRequest(request, signal) {
      if (
        request.actor.external ||
        request.actor.kind !== "host" ||
        request.params.providerId !== "helpers"
      )
        throw new InputError("この操作は設定画面から使用してください。");
      const snapshot = await context.providers.settings("helpers");
      const rev = snapshot.revision,
        values = request.params.values ?? {};
      const config = current();
      const authorize = async () => {
        signal.throwIfAborted();
        await context.providers.authorize(request.authorization);
      };
      try {
        switch (request.method) {
          case "snapshot":
            return {
              revision: rev,
              available: true,
              tabs: [
                {
                  id: "tools",
                  panels: [
                    {
                      id: "helpers",
                      title: "辞書と文章の補助操作",
                      description:
                        "CSVの取り込みはプレビュー後に辞書全体を置き換えます。文章プレビューは音声を生成しません。",
                      actions: [
                        { id: "csv.open", title: "CSVファイルを取り込む" },
                        { id: "csv.paste", title: "CSVを貼り付けて取り込む" },
                        { id: "csv.export", title: "辞書をCSVへ書き出す" },
                        { id: "text.open", title: "文章プレビュー" },
                      ],
                    },
                  ],
                },
              ],
            };
          case "prepare":
            if (Object.keys(request.params.value ?? {}).length)
              throw new InputError("補助操作の入力は保存しません。");
            return { plan: { value: {} } };
          case "csv.paste":
            return dialog(
              "CSVを貼り付けて取り込む",
              [field("csv", "個人辞書CSV")],
              { csv: "" },
              {
                id: "csv.preview",
                title: "取り込みをプレビュー",
                values: { before: config.dictionary },
              },
              rev,
            );
          case "csv.open": {
            const file = await context.ui.pickFile("csv");
            if (!file) return {};
            const csv = new TextDecoder("utf-8", { fatal: true }).decode(
              await fs.readFile(file),
            );
            await authorize();
            return csvPreview(csv, config.dictionary, rev);
          }
          case "csv.preview":
            return csvPreview(
              values.csv,
              values.before ?? config.dictionary,
              rev,
            );
          case "csv.apply": {
            const rows = parseCsv(values.csv);
            validateDictionary(values.before);
            await authorize();
            await context.settings.replaceList(
              "dictionary",
              rows,
              values.before,
            );
            return { feedback: `${rows.length}件の辞書を保存しました。` };
          }
          case "csv.export": {
            const csv = exportCsv(config.dictionary),
              file = await context.ui.pickSaveFile("csv");
            if (!file) return {};
            await authorize();
            await fs.writeFile(file, csv, "utf8");
            return { feedback: "辞書をCSVへ書き出しました。" };
          }
          case "text.open":
            return dialog(
              "文章プレビュー",
              [field("text", "読み上げる文章")],
              { text: "" },
              { id: "text.preview", title: "プレビューする" },
              rev,
            );
          case "text.preview": {
            const plan = processText(values.text, config, revision(config));
            const p = plan.startPolicy;
            const start = p.mode === "first" ? "最初の1個ができたら再生します。" :
              p.mode === "all" ? "全部の音声ができたら再生します。" :
              p.mode === "count" ? `先頭から${Math.min(p.count, plan.segments.length)}個の音声ができたら再生します。` :
              `最初の音声ができてから${p.seconds}秒待って再生します。待機中も続きの音声を生成します。`;
            return dialog(
              "文章プレビュー",
              [
                field("text", "読み上げる文章"),
                field("replaced", "置換後の文章", true),
                field("segments", `分割結果: ${plan.segments.length}個`, true),
                field("start", "再生開始", true),
              ],
              {
                text: values.text,
                replaced: plan.text,
                start,
                segments: plan.segments
                  .map((part, i) => `${i + 1}. ${part}`)
                  .join("\n\n"),
              },
              { id: "text.preview", title: "更新する" },
              rev,
            );
          }
          default:
            throw new InputError("操作が見つかりません。");
        }
      } catch (error) {
        if (error instanceof InputError)
          return { issue: { kind: "validation", message: error.message } };
        if (error instanceof TypeError && request.method === "csv.open")
          return {
            issue: {
              kind: "validation",
              message: "UTF-8のCSVファイルを選択してください。",
            },
          };
        throw error;
      }
    },
  };
}
module.exports = { ...createExtension(), createExtension };
