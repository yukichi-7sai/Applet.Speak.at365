const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  InputError,
  parseCsv,
  exportCsv,
  createProcessor,
  dictionaryIndex,
} = require("./src/processing.cjs");
const { DictionaryStore } = require("./src/dictionary-store.cjs");
const manifest = require("./extension.json");
const PAGE_SIZE = 100;
const emptyIndex = dictionaryIndex([]);
const field = (key, title, readOnly = false) => ({
  key,
  title,
  type: "string",
  presentation: "multiline",
  readOnly,
});
const dialog = (title, fields, values, submit, revision) => ({
  dialog: { title, fields, values, submit, revision },
});
function createExtension() {
  let context,
    dictionaries,
    userPage = 0;
  const processText = createProcessor();
  const current = () =>
    Object.fromEntries(
      manifest.settings.map((setting) => [
        setting.key,
        context.settings.get(setting.key, setting.default),
      ]),
    );
  const localPlan = (text) => {
    const config = current();
    const index = config.dictionaryEnabled
      ? dictionaries.snapshot?.index
      : emptyIndex;
    if (!index)
      throw new InputError(
        "辞書を読み込めません。設定画面で再読み込みしてください。",
      );
    return processText(text, config, JSON.stringify(config), index);
  };
  const auditionDialog = (connections, values, revision) =>
    dialog(
      "読み上げの試聴",
      [
        {
          ...field("text", "読み上げる文章"),
          initialFocus: true,
          required: true,
          description:
            "Speakの前後の文章・辞書変換・自動分割・再生開始設定を使って読み上げます。",
        },
        {
          key: "connectionId",
          title: "音声接続",
          type: "select",
          options: [
            { value: "", label: "既定の接続" },
            ...connections.map(({ id, name }) => ({ value: id, label: name })),
          ],
          description: connections.length
            ? "選んだ接続の声・話し方で読み上げます。既定の接続は変更しません。"
            : "音声接続がありません。AppDockの「音声生成AI」で接続を登録してください。",
        },
      ],
      {
        text: values.text ?? "Hello! Speakの読み上げを試聴します。",
        connectionId: values.connectionId ?? "",
      },
      {
        id: "audition.speak",
        title: "試聴する",
        disabled: !connections.length,
      },
      revision,
    );
  const sourceRow = (state, id) => {
    const row = state.entries.find((entry) => entry.id === id);
    if (!row)
      throw new InputError("辞書が見つかりません。表示を更新してください。");
    return row;
  };
  const importPreview = (csv, target, state, name = "", id) => {
    const rows = parseCsv(csv);
    return dialog(
      `辞書の取り込み: ${rows.length}件`,
      [
        ...(target === "source"
          ? [
              {
                key: "name",
                title: "辞書名",
                type: "string",
                required: true,
                initialFocus: true,
              },
            ]
          : []),
        field("preview", "取り込み内容", true),
      ],
      {
        csv,
        target,
        name,
        id,
        preview:
          rows
            .slice(0, 20)
            .map((row) => `${row.source} → ${row.replacement}`)
            .join("\n") + (rows.length > 20 ? `\n… 全${rows.length}件` : ""),
      },
      {
        id: "csv.apply",
        title:
          target === "user" ? "ユーザー辞書を置き換える" : "辞書を取り込む",
        primary: true,
      },
      state.revision,
    );
  };
  const userDialog = (state, row) =>
    dialog(
      row ? "単語を編集" : "単語を追加",
      [
        { ...field("source", "置換元"), required: true, initialFocus: true },
        { ...field("replacement", "置換先"), required: true },
      ],
      {
        id: row?.id,
        source: row?.source ?? "",
        replacement: row?.replacement ?? "",
      },
      { id: "user.save", title: "OK", primary: true },
      state.revision,
    );
  const userPanels = (state) => {
    userPage = Math.min(
      userPage,
      Math.max(0, Math.ceil(state.userRows.length / PAGE_SIZE) - 1),
    );
    const offset = userPage * PAGE_SIZE;
    return [
      {
        id: "user-page",
        title: "表示範囲",
        description: `全${state.userRows.length}件・${userPage + 1}/${Math.max(1, Math.ceil(state.userRows.length / PAGE_SIZE))}ページ。共有とこのPC専用の辞書は別々に保存します。`,
        actions: [
          {
            id: "user.previous",
            title: "前のページ",
            disabled: userPage === 0,
          },
          {
            id: "user.next",
            title: "次のページ",
            disabled: offset + PAGE_SIZE >= state.userRows.length,
          },
        ],
      },
      {
        id: "user-words",
        title: "ユーザー辞書",
        columns: [
          { key: "source", title: "置換元" },
          { key: "replacement", title: "置換先" },
        ],
        list: { titleKey: "source" },
        actions: [{ id: "user.add", title: "単語を追加", role: "add" }],
        rows: state.userRows.slice(offset, offset + PAGE_SIZE).map((row) => ({
          id: row.id,
          values: { ...row },
          actions: [
            {
              id: "user.edit",
              title: "単語を編集",
              role: "edit",
              rowId: row.id,
            },
            {
              id: "user.delete",
              title: "単語を削除",
              role: "delete",
              rowId: row.id,
              confirm: `「${row.source}」をユーザー辞書CSVから削除しますか？`,
            },
          ],
        })),
      },
    ];
  };
  const sourcePanels = (state) => [
    {
      id: "source-priority",
      title: "辞書の優先順",
      description:
        "同じ置換元はユーザー辞書を最優先し、配布辞書は一覧の上から優先します。共有とこのPC専用の辞書は別々に保存します。",
    },
    {
      id: "source-dictionaries",
      title: "配布辞書",
      columns: [
        { key: "name", title: "辞書名" },
        { key: "count", title: "件数" },
        { key: "priority", title: "優先順" },
      ],
      list: { titleKey: "name", enabledKey: "enabled" },
      actions: [
        { id: "source.import", title: "CSVを取り込む", role: "add" },
        { id: "source.order", title: "優先順を変更", role: "order" },
      ],
      rows: state.entries.map((row, i) => ({
        id: row.id,
        values: {
          id: row.id,
          name: row.name,
          count: String(row.count),
          priority: String(i + 1),
          enabled: row.enabled,
        },
        actions: [
          {
            id: "source.edit",
            title: "辞書名を編集",
            role: "edit",
            rowId: row.id,
          },
          {
            id: "source.toggle",
            title: "有効状態を切り替える",
            role: "toggle",
            rowId: row.id,
          },
          {
            id: "source.delete",
            title: "辞書を削除",
            role: "delete",
            rowId: row.id,
            confirm: `「${row.name}」（${row.count}件）の登録とAppDock内のCSVコピーを削除しますか？ 元の指定ファイルは残ります。`,
          },
          { id: "source.replace", title: "再インポート", rowId: row.id },
        ],
      })),
    },
  ];
  const reload = async () => {
    await dictionaries.reload();
    userPage = 0;
    await context.providers.changed();
  };
  return {
    async activate(value) {
      context = value;
      dictionaries = new DictionaryStore(context.storage.files);
      context.storage.files.onScopeChanged(reload);
      await dictionaries.reload();
    },
    async onMcpTool(request, signal) {
      if (
        request.moduleId !== "at365.speak.read-aloud" ||
        request.name !== "appdock_speech_speak"
      )
        throw new InputError("読み上げツールが見つかりません。");
      await dictionaries.ready();
      const config = request.settings.value;
      const index =
        config.dictionaryEnabled === false
          ? emptyIndex
          : dictionaries.current(request.settings.storageScope).index;
      const plan = processText(
        request.input.text,
        config,
        request.settings.revision,
        index,
      );
      signal.throwIfAborted();
      const { connectionId, connectionName, instructions } = request.input;
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
      await dictionaries.ready();
      const values = request.params.values ?? {},
        state = dictionaries.snapshot,
        rev = state?.revision ?? "unavailable";
      const authorize = async () => {
        signal.throwIfAborted();
        await context.providers.authorize(request.authorization);
      };
      const expected = request.params.expectedRevision;
      const assertRevision = () => {
        if (expected !== rev)
          throw Object.assign(
            new Error("辞書が変更されています。表示を更新してください。"),
            { code: "CONFLICT" },
          );
      };
      try {
        switch (request.method) {
          case "snapshot": {
            const warning = dictionaries.error
              ? [
                  {
                    id: "dictionary-error",
                    title: "辞書の読み込み",
                    description: `${dictionaries.error.message} 保存先のCSVとcatalog.jsonを確認し、再読み込みしてください。直前の正常な辞書があれば保持しています。`,
                    actions: [{ id: "dictionary.reload", title: "再読み込み" }],
                  },
                ]
              : [];
            return {
              revision: rev,
              available: true,
              tabs: [
                {
                  id: "settings",
                  panels: warning,
                  toolbar: [
                    { id: "text.open", title: "文章プレビュー" },
                    { id: "audition.open", title: "試聴" },
                  ],
                },
                {
                  id: "user-dictionary",
                  panels: [...warning, ...(state ? userPanels(state) : [])],
                  toolbar: state
                    ? [
                        {
                          title: "取り込み",
                          items: [
                            { id: "csv.open", title: "CSVファイルを取り込む" },
                            {
                              id: "csv.paste",
                              title: "CSVを貼り付けて取り込む",
                            },
                          ],
                        },
                        { id: "csv.export", title: "書き出し" },
                        { id: "dictionary.reload", title: "再読み込み" },
                      ]
                    : [],
                },
                {
                  id: "source-dictionaries",
                  panels: [...warning, ...(state ? sourcePanels(state) : [])],
                  toolbar: [{ id: "dictionary.reload", title: "再読み込み" }],
                },
              ],
            };
          }
          case "prepare":
            if (Object.keys(request.params.value ?? {}).length)
              throw new InputError("辞書本文はCSVで保存します。");
            return { plan: { value: {} } };
          case "dictionary.reload":
            await authorize();
            await reload();
            return {};
        }
        if (!state)
          throw new InputError(
            "辞書の保存ファイルを確認して再読み込みしてください。",
          );
        const rowId = request.params.rowId ?? values.id;
        switch (request.method) {
          case "user.previous":
            userPage = Math.max(0, userPage - 1);
            return {};
          case "user.next":
            userPage++;
            return {};
          case "user.add":
            return userDialog(state);
          case "user.edit": {
            const row = state.userRows.find((row) => row.id === rowId);
            if (!row) throw new InputError("単語が見つかりません。");
            return userDialog(state, row);
          }
          case "user.save": {
            assertRevision();
            const rows = state.userRows.map((row) => ({ ...row })),
              index = values.id
                ? rows.findIndex((row) => row.id === values.id)
                : -1;
            if (values.id && index < 0)
              throw new InputError("単語が見つかりません。");
            const row = {
              id: values.id ?? randomUUID(),
              source: values.source,
              replacement: values.replacement,
            };
            if (index < 0) rows.push(row);
            else rows[index] = row;
            await dictionaries.replaceUser(
              exportCsv(rows),
              expected,
              authorize,
            );
            return {};
          }
          case "user.delete":
            assertRevision();
            if (!state.userRows.some((row) => row.id === rowId))
              throw new InputError("単語が見つかりません。");
            await dictionaries.replaceUser(
              exportCsv(state.userRows.filter((row) => row.id !== rowId)),
              expected,
              authorize,
            );
            return {};
          case "csv.paste":
            return dialog(
              "CSVを貼り付けて取り込む",
              [{ ...field("csv", "ユーザー辞書CSV"), initialFocus: true }],
              { csv: "" },
              { id: "csv.preview", title: "取り込みをプレビュー" },
              rev,
            );
          case "csv.open":
          case "source.import":
          case "source.replace": {
            const source =
              request.method === "source.replace"
                ? sourceRow(state, rowId)
                : undefined;
            const file = await context.ui.pickFile("csv");
            if (!file) return {};
            const csv = new TextDecoder("utf-8", {
              fatal: true,
              ignoreBOM: true,
            }).decode(await fs.readFile(file));
            await authorize();
            return importPreview(
              csv,
              request.method === "csv.open" ? "user" : "source",
              state,
              source?.name ?? path.basename(file, path.extname(file)),
              source?.id,
            );
          }
          case "csv.preview":
            return importPreview(values.csv, "user", state);
          case "csv.apply": {
            assertRevision();
            if (values.target === "user") {
              await dictionaries.replaceUser(values.csv, expected, authorize);
              userPage = 0;
              return {
                feedback: `${parseCsv(values.csv).length}件のユーザー辞書をCSVに保存しました。`,
              };
            }
            if (values.target !== "source")
              throw new InputError("取り込み先が不正です。");
            const warning = await dictionaries.importSource(
              values.csv,
              values.name,
              values.id,
              expected,
              authorize,
            );
            return {
              feedback: "辞書を取り込みました。",
              value: { saved: true },
              ...(warning ? { warning } : {}),
            };
          }
          case "csv.export": {
            const file = await context.ui.pickSaveFile("csv");
            if (!file) return {};
            await authorize();
            await fs.writeFile(file, state.userFile.text ?? "", "utf8");
            return { feedback: "辞書をCSVへ書き出しました。" };
          }
          case "source.edit": {
            const row = sourceRow(state, rowId);
            return dialog(
              "辞書名を編集",
              [
                {
                  key: "name",
                  title: "辞書名",
                  type: "string",
                  required: true,
                  initialFocus: true,
                },
              ],
              { id: row.id, name: row.name },
              { id: "source.save", title: "OK", primary: true },
              rev,
            );
          }
          case "source.save":
          case "source.toggle":
          case "source.delete":
          case "source.order": {
            assertRevision();
            const method = request.method;
            const warning = await dictionaries.updateSources(
              (entries) => {
                if (method === "source.order") {
                  if (
                    !Array.isArray(values.ids) ||
                    values.ids.length !== entries.length ||
                    new Set(values.ids).size !== entries.length ||
                    values.ids.some(
                      (id) => !entries.some((entry) => entry.id === id),
                    )
                  )
                    throw new InputError("辞書の優先順が変更されています。");
                  return values.ids.map((id) =>
                    entries.find((entry) => entry.id === id),
                  );
                }
                const row = sourceRow({ entries }, rowId);
                if (method === "source.delete")
                  return entries.filter((entry) => entry.id !== row.id);
                if (method === "source.toggle") row.enabled = !row.enabled;
                else {
                  if (typeof values.name !== "string" || !values.name.trim())
                    throw new InputError("辞書名を入力してください。");
                  row.name = values.name;
                }
                return entries;
              },
              expected,
              authorize,
            );
            return warning ? { value: { saved: true }, warning } : {};
          }
          case "text.open":
            return dialog(
              "文章プレビュー",
              [{ ...field("text", "読み上げる文章"), initialFocus: true }],
              { text: "" },
              { id: "text.preview", title: "プレビューする" },
              rev,
            );
          case "text.preview": {
            const plan = localPlan(values.text),
              p = plan.startPolicy;
            const start =
              p.mode === "first"
                ? "最初の1個ができたら再生します。"
                : p.mode === "all"
                  ? "全部の音声ができたら再生します。"
                  : p.mode === "count"
                    ? `先頭から${Math.min(p.count, plan.segments.length)}個の音声ができたら再生します。`
                    : `最初の音声ができてから${p.seconds}秒待って再生します。待機中も続きの音声を生成します。`;
            return dialog(
              "文章プレビュー",
              [
                field("text", "読み上げる文章"),
                {
                  ...field("replaced", "置換後の文章", true),
                  description: "前後の文章を含めた辞書変換後の文章です。",
                },
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
          case "audition.open": {
            const { connections } = await context.appdock.call(
              "tts.connections.list",
              {},
            );
            signal.throwIfAborted();
            return auditionDialog(connections, {}, rev);
          }
          case "audition.speak": {
            const connectionId = values.connectionId ?? "";
            if (typeof connectionId !== "string")
              throw new InputError("音声接続を選択してください。");
            const { connections } = await context.appdock.call(
              "tts.connections.list",
              {},
            );
            if (!connections.length)
              throw new InputError(
                "AppDockの「音声生成AI」で接続を登録してください。",
              );
            if (
              connectionId &&
              !connections.some(({ id }) => id === connectionId)
            )
              throw new InputError(
                "音声接続が見つかりません。試聴画面を開き直してください。",
              );
            await dictionaries.ready();
            await authorize();
            signal.throwIfAborted();
            const plan = localPlan(values.text);
            const reply = auditionDialog(
              connections,
              values,
              dictionaries.snapshot?.revision ?? rev,
            );
            await context.appdock.call("tts.sequences.speak", {
              segments: plan.segments,
              startPolicy: plan.startPolicy,
              ...(connectionId ? { connectionId } : {}),
            });
            return { ...reply, feedback: "試聴の読み上げを受け付けました。" };
          }
          default:
            throw new InputError("操作が見つかりません。");
        }
      } catch (error) {
        if (error.code === "CONFLICT") {
          await reload();
          throw error;
        }
        if (error instanceof InputError)
          return { issue: { kind: "validation", message: error.message } };
        if (
          error instanceof TypeError &&
          ["csv.open", "source.import", "source.replace"].includes(
            request.method,
          )
        )
          return {
            issue: {
              kind: "validation",
              message: "UTF-8の2列CSVファイルを選択してください。",
            },
          };
        throw error;
      }
    },
  };
}
module.exports = { ...createExtension(), createExtension };
