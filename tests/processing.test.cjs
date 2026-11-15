const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseCsv,
  exportCsv,
  dictionaryIndex,
  replaceText,
  splitText,
  createProcessor,
  settings,
} = require("../src/processing.cjs");
const rows = (values) =>
  values.map(([source, replacement], i) => ({
    id: String(i),
    source,
    replacement,
  }));
test("CSV retains Japanese, spaces, case, quoted commas/quotes/newlines and BOM across a round trip", () => {
  const original = rows([
    ["AppDock", "アップドック"],
    [" 日本橋 ", "ニホンバシ"],
    ["a,b", 'c"d'],
    ["two\nlines", "2\r\n行"],
  ]);
  const csv = "\uFEFF\r\n" + exportCsv(original) + "\r\n\n";
  const parsed = parseCsv(csv);
  assert.deepEqual(
    parsed.map(({ source, replacement }) => [source, replacement]),
    original.map(({ source, replacement }) => [source, replacement]),
  );
  assert.equal(new Set(parsed.map((r) => r.id)).size, 4);
  assert.equal(exportCsv(parsed), exportCsv(original));
});
test("CSV rejects invalid records with record positions and ignores only entirely empty lines", () => {
  for (const [csv, record] of [
    ["a,b\na,c", 2],
    ["a,b,c", 1],
    ["a, ", 1],
    ['"a', 1],
    ['a"b,c', 1],
    ['"a"x,b', 1],
    ["\n \n", 2],
    ['a,b\n"",c', 2],
  ])
    assert.throws(
      () => parseCsv(csv),
      (e) =>
        e.code === "INVALID_ARGUMENT" &&
        e.message.includes(`${record}レコード目`),
    );
  assert.deepEqual(parseCsv(""), []);
  assert.deepEqual(parseCsv("\n\r\n"), []);
});
test("replacement is longest, one-pass, boundary-aware and Unicode literal", () => {
  const index = dictionaryIndex(
    rows([
      ["App", "アプ"],
      ["AppDock", "アップドック"],
      ["アップドック", "再置換しない"],
      ["日本", "にほん"],
      ["日本橋", "にほんばし"],
      ["AI", "エーアイ"],
    ]),
  );
  const text =
    "App AppDockを MyApp AppDock2 _App APP AppDock 日本橋 日本 AIと AI_tools";
  const result = replaceText(text, index);
  assert.equal(
    result.text,
    "アプ アップドックを MyApp AppDock2 _App APP アップドック にほんばし にほん エーアイと AI_tools",
  );
  assert.equal(replaceText(text, index).text, result.text);
  for (const r of result.ranges)
    assert.ok(result.text.slice(r.start, r.end).length);
});
test("splitting preserves all content, graphemes, URLs, long words and replaced ranges", () => {
  const original =
    "最初の段落です。\n\n「文末です。」続きは3.14です。長い文には、区切りを入れます。 https://example.com/a.b?q=1 next_word 👨‍👩‍👧‍👦 e\u0301 終わり。  ";
  const replacement = replaceText(
    original,
    dictionaryIndex(rows([["区切り", "とても長いカタカナ用語"]])),
  );
  const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
  const positions = new Set(
    Array.from(segmenter.segment(replacement.text), (p) => p.index),
  );
  positions.add(replacement.text.length);
  for (const target of [1, 5, 12, 30, 300]) {
    const parts = splitText(replacement.text, target, replacement.ranges);
    assert.equal(parts.join(""), replacement.text);
    assert.ok(parts.every((p) => p.trim()));
    let offset = 0;
    for (const p of parts) {
      offset += p.length;
      assert.ok(positions.has(offset));
      assert.ok(
        !replacement.ranges.some((r) => offset > r.start && offset < r.end),
      );
    }
    assert.ok(parts.some((p) => p.includes("https://example.com/a.b?q=1")));
    assert.ok(parts.some((p) => p.includes("next_word")));
    assert.ok(parts.some((p) => p.includes("3.14")));
  }
  const parts = splitText("「最初の文章。」次の文章です。", 7);
  assert.ok(parts[0].endsWith("」"));
  assert.ok(!parts.some((p) => p.startsWith("」")));
  assert.deepEqual(splitText("a".repeat(1000), 10), ["a".repeat(1000)]);
});
test("processor applies replacement before splitting, uses exclusive policies and resets cached revisions", () => {
  const process = createProcessor(),
    dictionary = rows([["AppDock", "アップドック"]]);
  const config = {
    dictionary,
    targetCharacters: 4,
    startMode: "delay",
    startSeconds: 0.5,
  };
  const plan = process("AppDockです。次です。", config, "one");
  assert.equal(plan.text, "アップドックです。次です。");
  assert.deepEqual(plan.startPolicy, { mode: "delay", seconds: 0.5 });
  assert.ok(plan.segments.some((p) => p.includes("アップドック")));
  const disabled = process(
    "AppDockです。次です。",
    {
      splitEnabled: false,
      dictionaryEnabled: false,
      startMode: "count",
      startCount: 2,
    },
    "two",
  );
  assert.deepEqual(disabled.segments, ["AppDockです。次です。"]);
  assert.deepEqual(disabled.startPolicy, { mode: "count", count: 2 });
  for (const patch of [
    { targetCharacters: 1.5 },
    { startCount: 0 },
    { startSeconds: -1 },
    { startSeconds: Infinity },
    { startMode: "unknown" },
  ])
    assert.throws(() => settings(patch));
});
test("a large personal dictionary and long input remain complete without caps", () => {
  const dictionary = rows(
    Array.from({ length: 12000 }, (_, i) => [`Word${i}`, `ワード${i}`]),
  );
  const csv = exportCsv(dictionary),
    parsed = parseCsv(csv);
  assert.equal(parsed.length, 12000);
  const text = "Word11999を Word11 ".repeat(1200);
  const result = createProcessor()(text, { dictionary: parsed }, "large");
  assert.equal(
    result.segments.join(""),
    "ワード11999を ワード11 ".repeat(1200),
  );
});

// A deliberately simple independent matcher checks behavior, not trie layout.
function referenceReplace(text, dictionary) {
  const parts = [], ranges = [];
  const ascii = (character) => !!character && /^[A-Za-z0-9_]$/.test(character);
  let outputLength = 0;
  for (let i = 0; i < text.length;) {
    let found;
    for (const row of dictionary) {
      if (!text.startsWith(row.source, i)) continue;
      const end = i + row.source.length, before = text.charCodeAt(end - 1), after = text.charCodeAt(end);
      if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) continue;
      if (/^[A-Za-z0-9]+$/.test(row.source) && (ascii(text[i - 1]) || ascii(text[end]))) continue;
      if (!found || row.source.length > found.source.length) found = row;
    }
    if (found) {
      parts.push(found.replacement);
      ranges.push({ start: outputLength, end: outputLength + found.replacement.length });
      outputLength += found.replacement.length;
      i += found.source.length;
    } else {
      const character = String.fromCodePoint(text.codePointAt(i));
      parts.push(character); outputLength += character.length; i += character.length;
    }
  }
  return { text: parts.join(''), ranges };
}
test("compiled dictionary preserves literal matching for unsorted Unicode, phrases and overlapping keys", () => {
  let seed = 89125;
  const random = (count) => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) % count;
  };
  const units = ['a', 'b', 'A', '0', '_', '日', '本', '橋', '😀', '𠮷', '\ue000', ' ', '-', '\n', '\u0301'];
  for (let trial = 0; trial < 100; trial++) {
    const sources = new Set(['日本', '日本橋', 'a b', '😀', '😀a', '\ue000', '𠮷野', '\ud800']);
    while (sources.size < 36) {
      const source = Array.from({ length: 1 + random(8) }, () => units[random(units.length)]).join('');
      if (source.trim()) sources.add(source);
    }
    const dictionary = rows([...sources].map((source, i) => [source, `置換${i}`]));
    const text = Array.from({ length: 300 }, () => units[random(units.length)]).join('') + ' ' + [...sources].join(' ');
    assert.deepEqual(replaceText(text, dictionaryIndex(dictionary)), referenceReplace(text, dictionary));
  }
});
test("compiled dictionary owns a stable snapshot and handles empty and deep dictionaries", () => {
  const dictionary = rows([['日本橋', 'にほんばし'], ['日本', 'にほん']]);
  const index = dictionaryIndex(dictionary);
  dictionary[0].replacement = '編集途中'; dictionary.reverse(); dictionary.length = 0;
  assert.equal(replaceText('日本橋と日本', index).text, 'にほんばしとにほん');
  assert.deepEqual(replaceText('😀 日本', dictionaryIndex([])), { text: '😀 日本', ranges: [] });
  const deep = '日'.repeat(10000);
  assert.equal(replaceText(deep, dictionaryIndex(rows([[deep, '長い登録語']]))).text, '長い登録語');
});
test("100,000 entries retain longest-match and first/last entries across a compiled index", () => {
  const dictionary = rows(Array.from({ length: 100000 }, (_, i) => [`Word${i}`, `ワード${i}`]));
  const index = dictionaryIndex(dictionary);
  const text = 'Word0 Word11 Word99999 Word99999_extra MyWord11';
  assert.equal(replaceText(text, index).text, 'ワード0 ワード11 ワード99999 Word99999_extra MyWord11');
});
