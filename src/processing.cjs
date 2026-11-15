const { randomUUID } = require("node:crypto");
const { compileDictionary } = require("./dictionary-engine.cjs");
class InputError extends Error {
  constructor(message) {
    super(message);
    this.code = "INVALID_ARGUMENT";
  }
}
function validateDictionary(rows) {
  if (!Array.isArray(rows))
    throw new InputError("辞書は一覧で指定してください。");
  const sources = new Set(),
    ids = new Set();
  return rows.map((row, index) => {
    if (
      !row ||
      typeof row.source !== "string" ||
      !row.source.trim() ||
      typeof row.replacement !== "string" ||
      !row.replacement.trim()
    )
      throw new InputError(
        `${index + 1}行目: 置換元と置換先を入力してください。`,
      );
    if (sources.has(row.source))
      throw new InputError(`${index + 1}行目: 置換元が重複しています。`);
    if (typeof row.id !== "string" || !row.id || ids.has(row.id))
      throw new InputError(`${index + 1}行目: 行IDが不正です。`);
    sources.add(row.source);
    ids.add(row.id);
    return { id: row.id, source: row.source, replacement: row.replacement };
  });
}
function parseCsv(text) {
  if (typeof text !== "string")
    throw new InputError("CSVの文字列を指定してください。");
  text = text.replace(/^\uFEFF/, "");
  const rows = [],
    sources = new Set();
  let fields = [],
    value = "",
    quoted = false,
    closed = false,
    started = false,
    record = 1;
  const invalid = (message) => {
    throw new InputError(`CSV ${record}レコード目: ${message}`);
  };
  const field = () => {
    fields.push(value);
    value = "";
    closed = false;
  };
  const finish = () => {
    field();
    if (started) {
      if (fields.length !== 2) invalid("置換元と置換先の2列にしてください。");
      if (fields.some((v) => !v.trim()))
        invalid("空の値や空白だけの値は使えません。");
      // Keep the first occurrence, matching the merge order across dictionaries.
      if (!sources.has(fields[0])) {
        sources.add(fields[0]);
        rows.push({
          id: randomUUID(),
          source: fields[0],
          replacement: fields[1],
        });
      }
    }
    fields = [];
    started = false;
    record++;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
      continue;
    }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      finish();
      continue;
    }
    started = true;
    if (c === ",") {
      field();
      continue;
    }
    if (closed) invalid("閉じ引用符の後に文字があります。");
    if (c === '"') {
      if (value) invalid("引用符は値の先頭だけに使えます。");
      quoted = true;
    } else value += c;
  }
  if (quoted) invalid("引用符が閉じていません。");
  if (started || fields.length || value) finish();
  return validateDictionary(rows);
}
function exportCsv(rows) {
  const quote = (value) =>
    /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
  return validateDictionary(rows)
    .map((row) => `${quote(row.source)},${quote(row.replacement)}`)
    .join("\r\n");
}
function dictionaryIndex(rows) {
  return compileDictionary(validateDictionary(rows));
}
function replaceText(text, index, ignoreCase = false) {
  return index.replace(text, ignoreCase);
}
const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });
function splitText(text, target, protectedRanges = []) {
  if (!Number.isSafeInteger(target) || target < 1)
    throw new InputError("目安文字数には1以上の整数を指定してください。");
  if (!text.trim()) throw new InputError("読み上げる文章を入力してください。");
  const atomic = [...protectedRanges];
  for (const match of text.matchAll(
    /(?:https?:\/\/|www\.)\S+|[0-9]+(?:[.,][0-9]+)+|[A-Za-z0-9_]+(?:['’-][A-Za-z0-9_]+)*/g,
  ))
    atomic.push({ start: match.index, end: match.index + match[0].length });
  atomic.sort((a, b) => a.start - b.start || b.end - a.end);
  const units = Array.from(graphemes.segment(text));
  const candidates = [];
  let rangeIndex = 0,
    protectedUntil = 0;
  const closing = /[」』）)\]】〉》”’]/u;
  for (let n = 1; n <= units.length; n++) {
    const position = n === units.length ? text.length : units[n].index;
    while (rangeIndex < atomic.length && atomic[rangeIndex].start < position)
      protectedUntil = Math.max(protectedUntil, atomic[rangeIndex++].end);
    if (
      position < protectedUntil ||
      (n < units.length && closing.test(units[n].segment))
    )
      continue;
    const previous = units[n - 1].segment,
      next = units[n]?.segment ?? "";
    let score = 0;
    if (previous.includes("\n")) score = 5;
    else if (
      /[。！？!?]/u.test(previous) ||
      (previous === "." &&
        !(/[0-9]/.test(text[position - 2] ?? "") && /[0-9]/.test(next)))
    )
      score = 4;
    else if (closing.test(previous)) score = 3;
    else if (/[、，,;；:：]/u.test(previous)) score = 2;
    else if (/\s/u.test(previous)) score = 1;
    candidates.push({ n, position, score });
  }
  const chunks = [];
  let start = 0,
    startN = 0,
    cursor = 0;
  while (start < text.length) {
    if (units.length - startN <= target) {
      const rest = text.slice(start);
      if (rest.trim()) chunks.push(rest);
      else if (chunks.length) chunks[chunks.length - 1] += rest;
      break;
    }
    const low = startN + target * 0.6,
      high = startN + target * 1.4;
    let best;
    while (cursor < candidates.length && candidates[cursor].n <= startN)
      cursor++;
    let scan = cursor;
    for (; scan < candidates.length; scan++) {
      const candidate = candidates[scan];
      if (candidate.n > high && best) break;
      if (candidate.n < low) continue;
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score &&
          Math.abs(candidate.n - startN - target) <
            Math.abs(best.n - startN - target))
      )
        best = candidate;
      if (candidate.n > high) break;
    }
    best ??= candidates.at(-1);
    if (!best || best.position <= start) {
      chunks.push(text.slice(start));
      break;
    }
    const part = text.slice(start, best.position);
    if (part.trim()) chunks.push(part);
    else if (chunks.length) chunks[chunks.length - 1] += part;
    else {
      startN = best.n;
      continue;
    }
    start = best.position;
    startN = best.n;
  }
  return chunks;
}
function settings(value = {}) {
  const result = {
    splitEnabled: true,
    targetCharacters: 300,
    dictionaryEnabled: true,
    dictionaryIgnoreCase: true,
    startMode: "first",
    startCount: 2,
    startSeconds: 0,
    ...value,
  };
  if (
    !Number.isSafeInteger(result.targetCharacters) ||
    result.targetCharacters < 1 ||
    !Number.isSafeInteger(result.startCount) ||
    result.startCount < 1 ||
    typeof result.startSeconds !== "number" ||
    !Number.isFinite(result.startSeconds) ||
    result.startSeconds < 0 ||
    typeof result.splitEnabled !== "boolean" ||
    typeof result.dictionaryEnabled !== "boolean" ||
    typeof result.dictionaryIgnoreCase !== "boolean" ||
    !["first", "count", "all", "delay"].includes(result.startMode)
  )
    throw new InputError("読み上げ設定を確認してください。");
  return result;
}
function createProcessor() {
  let cachedRevision, config;
  const emptyIndex = dictionaryIndex([]);
  return (text, value, revision, preparedIndex) => {
    if (typeof text !== "string" || !text.trim())
      throw new InputError("読み上げる文章を入力してください。");
    if (cachedRevision !== revision || !config) {
      config = settings(value);
      cachedRevision = revision;
    }
    const replaced = config.dictionaryEnabled
      ? replaceText(
          text,
          preparedIndex ?? emptyIndex,
          config.dictionaryIgnoreCase,
        )
      : { text, ranges: [] };
    const segments = config.splitEnabled
      ? splitText(replaced.text, config.targetCharacters, replaced.ranges)
      : [replaced.text];
    const startPolicy = {
      mode: config.startMode,
      ...(config.startMode === "count"
        ? { count: config.startCount }
        : config.startMode === "delay"
          ? { seconds: config.startSeconds }
          : {}),
    };
    return { text: replaced.text, segments, startPolicy };
  };
}
module.exports = {
  InputError,
  validateDictionary,
  parseCsv,
  exportCsv,
  dictionaryIndex,
  replaceText,
  splitText,
  settings,
  createProcessor,
};
