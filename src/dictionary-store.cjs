const { createHash, randomUUID } = require("node:crypto");
const { InputError, parseCsv, dictionaryIndex } = require("./processing.cjs");
const USER_FILE = "user.csv",
  CATALOG_FILE = "catalog.json";
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const byteRevision = (text) => createHash("sha256").update(text).digest("hex");
const conflict = () =>
  Object.assign(
    new Error("辞書が変更されています。表示を更新してから操作してください。"),
    { code: "CONFLICT" },
  );
const stableRows = (text) =>
  parseCsv(text ?? "").map((row) => ({
    ...row,
    id: createHash("sha256").update(row.source).digest("hex"),
  }));
function catalog(text) {
  if (text === null) return [];
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new InputError("辞書の管理ファイルを読み込めません。");
  }
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.dictionaries) ||
    Object.keys(value).some(
      (key) => !["schemaVersion", "dictionaries"].includes(key),
    )
  )
    throw new InputError("辞書の管理ファイルの形式を確認してください。");
  const ids = new Set(),
    files = new Set();
  for (const row of value.dictionaries) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !/^[a-z0-9-]+$/.test(row.id) ||
      ids.has(row.id) ||
      typeof row.file !== "string" ||
      !/^source-[a-z0-9-]+\.csv$/.test(row.file) ||
      files.has(row.file) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      typeof row.enabled !== "boolean" ||
      typeof row.revision !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.revision) ||
      !Number.isSafeInteger(row.count) ||
      row.count < 0 ||
      Object.keys(row).some(
        (key) =>
          !["id", "file", "name", "enabled", "count", "revision"].includes(key),
      )
    )
      throw new InputError("辞書の管理情報が不正です。");
    ids.add(row.id);
    files.add(row.file);
  }
  return value.dictionaries;
}
class DictionaryStore {
  #files;
  #pending = Promise.resolve();
  #snapshot;
  error = null;
  generation = 0;
  constructor(files) {
    this.#files = files;
  }
  get snapshot() {
    return this.#snapshot;
  }
  async ready() {
    await this.#pending;
  }
  #queue(action) {
    const pending = this.#pending.then(action, action);
    this.#pending = pending.catch(() => {});
    return pending;
  }
  #finish(state) {
    state.revision = digest([
      state.scope,
      state.userFile.revision,
      state.catalogFile.revision,
      state.entries
        .filter((entry) => entry.enabled)
        .map((entry) => [entry.id, state.sources.get(entry.file)?.revision]),
    ]);
    return state;
  }
  #compile(state) {
    const signature = digest([
      state.scope,
      state.userFile.revision,
      state.entries
        .filter((entry) => entry.enabled)
        .map((entry) => [entry.file, state.sources.get(entry.file)?.revision]),
    ]);
    if (this.#snapshot?.signature === signature)
      return { ...state, signature, index: this.#snapshot.index };
    const merged = new Map();
    for (const rows of [
      state.userRows,
      ...state.entries
        .filter((entry) => entry.enabled)
        .map((entry) => state.sources.get(entry.file).rows),
    ])
      for (const row of rows)
        if (!merged.has(row.source)) merged.set(row.source, row);
    return {
      ...state,
      signature,
      index: dictionaryIndex([...merged.values()]),
    };
  }
  #adopt(state) {
    if (state.index !== this.#snapshot?.index) this.generation++;
    // Disabled dictionaries are re-read when enabled, rather than retained indefinitely.
    const active = new Set(
      state.entries.filter((entry) => entry.enabled).map((entry) => entry.file),
    );
    this.#snapshot = this.#finish({
      ...state,
      sources: new Map([...state.sources].filter(([file]) => active.has(file))),
    });
    this.error = null;
    return this.#snapshot;
  }
  reload() {
    return this.#queue(async () => {
      try {
        const userFile = await this.#files.readText(USER_FILE, "configuration"),
          scope = userFile.scope;
        const catalogFile = await this.#files.readText(CATALOG_FILE, scope),
          entries = catalog(catalogFile.text);
        const sources = new Map();
        for (const entry of entries)
          if (entry.enabled) {
            const file = await this.#files.readText(entry.file, scope);
            if (file.text === null)
              throw new InputError(
                `「${entry.name}」のCSVが見つかりません。再インポートしてください。`,
              );
            const rows = stableRows(file.text);
            entry.revision = file.revision;
            entry.count = rows.length;
            sources.set(entry.file, { ...file, rows });
          }
        const latest = await this.#files.readText(
          CATALOG_FILE,
          "configuration",
        );
        if (latest.scope !== scope || latest.revision !== catalogFile.revision)
          throw conflict();
        this.#adopt(
          this.#compile({
            scope,
            userFile,
            catalogFile,
            entries,
            sources,
            userRows: stableRows(userFile.text),
          }),
        );
        return true;
      } catch (error) {
        this.error = error;
        return false;
      }
    });
  }
  current(scope) {
    const state = this.#snapshot;
    if (!state || (scope !== undefined && state.scope !== scope))
      throw new InputError(
        "辞書を準備できません。Speakの設定で保存先とCSVを確認してください。",
      );
    return state;
  }
  async #assert(expectedRevision) {
    const current = this.current();
    if (expectedRevision !== current.revision) throw conflict();
    const check = await this.#files.readText(CATALOG_FILE, "configuration");
    if (
      check.scope !== current.scope ||
      check.revision !== current.catalogFile.revision
    )
      throw conflict();
    return current;
  }
  replaceUser(csv, expectedRevision, authorize) {
    const rows = stableRows(csv);
    return this.#queue(async () => {
      const current = await this.#assert(expectedRevision);
      const candidate = this.#compile({
        ...current,
        userRows: rows,
        userFile: {
          text: csv,
          revision: byteRevision(csv),
          scope: current.scope,
        },
      });
      await authorize();
      await this.#assert(expectedRevision);
      const saved = await this.#files.writeText(
        USER_FILE,
        csv,
        current.userFile.revision,
        current.scope,
      );
      candidate.userFile = { text: csv, ...saved };
      candidate.signature = digest([
        current.scope,
        saved.revision,
        candidate.entries
          .filter((entry) => entry.enabled)
          .map((entry) => [
            entry.file,
            candidate.sources.get(entry.file)?.revision,
          ]),
      ]);
      this.#adopt(candidate);
    });
  }
  importSource(csv, name, id, expectedRevision, authorize) {
    if (typeof name !== "string" || !name.trim())
      throw new InputError("辞書名を入力してください。");
    const rows = stableRows(csv);
    return this.#queue(async () => {
      const current = await this.#assert(expectedRevision);
      const previous = id
        ? current.entries.find((entry) => entry.id === id)
        : undefined;
      if (id && !previous) throw conflict();
      const file = `source-${randomUUID()}.csv`;
      const row = {
        id: previous?.id ?? randomUUID(),
        file,
        name,
        enabled: previous?.enabled ?? true,
        count: rows.length,
        revision: byteRevision(csv),
      };
      const entries = previous
        ? current.entries.map((entry) => (entry.id === id ? row : entry))
        : [...current.entries, row];
      const sources = new Map(current.sources);
      sources.set(file, {
        text: csv,
        rows,
        revision: byteRevision(csv),
        scope: current.scope,
      });
      const candidate = this.#compile({ ...current, entries, sources });
      await authorize();
      await this.#assert(expectedRevision);
      const saved = await this.#files.writeText(
        file,
        csv,
        "missing",
        current.scope,
      );
      sources.set(file, { text: csv, rows, ...saved });
      let catalogFile;
      try {
        catalogFile = await this.#saveCatalog(current, entries);
      } catch (error) {
        await this.#files
          .delete(file, saved.revision, current.scope)
          .catch(() => {});
        throw error;
      }
      if (previous) sources.delete(previous.file);
      candidate.catalogFile = catalogFile;
      candidate.signature = digest([
        current.scope,
        current.userFile.revision,
        entries
          .filter((entry) => entry.enabled)
          .map((entry) => [entry.file, sources.get(entry.file)?.revision]),
      ]);
      this.#adopt(candidate);
      if (previous) return this.#removeCopy(previous, current);
    });
  }
  updateSources(action, expectedRevision, authorize) {
    return this.#queue(async () => {
      const current = await this.#assert(expectedRevision);
      const entries = action(current.entries.map((entry) => ({ ...entry }))),
        sources = new Map(current.sources);
      catalog(JSON.stringify({ schemaVersion: 1, dictionaries: entries }));
      for (const entry of entries)
        if (entry.enabled && !sources.has(entry.file)) {
          const file = await this.#files.readText(entry.file, current.scope);
          if (file.text === null)
            throw new InputError(`「${entry.name}」のCSVが見つかりません。`);
          const rows = stableRows(file.text);
          entry.revision = file.revision;
          entry.count = rows.length;
          sources.set(entry.file, { ...file, rows });
        }
      const candidate = this.#compile({ ...current, entries, sources });
      await authorize();
      await this.#assert(expectedRevision);
      candidate.catalogFile = await this.#saveCatalog(current, entries);
      this.#adopt(candidate);
      const warnings = [];
      for (const removed of current.entries.filter(
        (entry) => !entries.some((next) => next.id === entry.id),
      )) {
        const warning = await this.#removeCopy(removed, current);
        if (warning) warnings.push(warning);
        sources.delete(removed.file);
      }
      return warnings.join("\n") || undefined;
    });
  }
  async #saveCatalog(current, entries) {
    const text =
      JSON.stringify({ schemaVersion: 1, dictionaries: entries }, null, 2) +
      "\n";
    return {
      text,
      ...(await this.#files.writeText(
        CATALOG_FILE,
        text,
        current.catalogFile.revision,
        current.scope,
      )),
    };
  }
  async #removeCopy(entry, current) {
    try {
      const file = await this.#files.readText(entry.file, current.scope);
      if (file.text === null) return;
      const expected =
        current.sources.get(entry.file)?.revision ?? entry.revision;
      await this.#files.delete(entry.file, expected, current.scope);
    } catch {
      return `「${entry.name}」の登録は更新しましたが、保存コピー「${entry.file}」を削除できませんでした。ファイルを確認してください。`;
    }
  }
}
module.exports = {
  DictionaryStore,
  stableRows,
  USER_FILE,
  CATALOG_FILE,
  catalog,
};
