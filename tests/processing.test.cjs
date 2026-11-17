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
    ["a,b\na, ", 2],
    ["a,b\na,c,d", 2],
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
    targetCharacters: 4,
    startMode: "delay",
    startSeconds: 0.5,
  };
  const plan = process(
    "AppDockです。次です。",
    config,
    "one",
    dictionaryIndex(dictionary),
  );
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
    { splitCharacters: null },
    { splitOnNewline: "true" },
    { splitOnSpace: 1 },
    { startCount: 0 },
    { startSeconds: -1 },
    { startSeconds: Infinity },
    { startMode: "unknown" },
    { dictionaryIgnoreCase: "false" },
    { prefixText: null },
    { suffixText: 1 },
    { prefixNewline: "false" },
    { suffixNewline: null },
    { additionTiming: "later" },
    { additionTiming: null },
  ])
    assert.throws(() => settings(patch));
});

test("splitting picks the nearest specified boundary on either side without a search window or punctuation priority", () => {
  const early = "ああ。", late = "い".repeat(20) + "。";
  assert.deepEqual(splitText(early + late + "う", 10), [early, late, "う"]);
  const long = "あ".repeat(30) + "。";
  assert.deepEqual(splitText(long + "い", 10), [long, "い"]);
  assert.deepEqual(splitText("あああ。いいい。う", 6), ["あああ。", "いいい。う"]);
  assert.deepEqual(splitText("ああああ。いいいい\nうううう。", 8), [
    "ああああ。いいいい\n", "うううう。",
  ]);
  assert.deepEqual(splitText("ああああ\nいいい。うううう。", 8), [
    "ああああ\nいいい。", "うううう。",
  ]);
  assert.deepEqual(splitText("あああ、いいい。う", 4, [], { splitCharacters: "、。" }), [
    "あああ、", "いいい。", "う",
  ]);
});

test("default splitting excludes commas and spaces and never falls back to the middle of a sentence", () => {
  assert.equal(settings().splitCharacters, "。.");
  assert.equal(settings().splitOnNewline, true);
  assert.equal(settings().splitOnSpace, false);
  const first = "あ".repeat(9) + "、" + "い".repeat(20) + "。";
  assert.deepEqual(splitText(first + "う", 10), [first, "う"]);
  for (const text of ["英文の途中には、空白 や！感嘆符？括弧）もある", "one two three"])
    assert.deepEqual(splitText(text, 4), [text]);
  assert.deepEqual(splitText("Hello world. Next sentence.", 10), [
    "Hello world.", " Next sentence.",
  ]);
});

test("literal delimiters, newlines and spaces can be selected independently and all delimiters can be disabled", () => {
  const text = "あ|い|う";
  assert.deepEqual(splitText(text, 2, [], { splitCharacters: "|" }), ["あ|", "い|", "う"]);
  assert.deepEqual(splitText(text, 2), [text]);
  assert.deepEqual(splitText("あ\r\nい\nう\rえ\u2028お\u2029か", 2), [
    "あ\r\n", "い\n", "う\r", "え\u2028", "お\u2029", "か",
  ]);
  assert.deepEqual(splitText("one two three", 4, [], { splitOnSpace: true }), [
    "one ", "two ", "three",
  ]);
  assert.deepEqual(splitText("あ　い\tう", 2, [], { splitOnSpace: true }), ["あ　", "い\t", "う"]);
  const disabled = { splitCharacters: "", splitOnNewline: false, splitOnSpace: false };
  assert.deepEqual(splitText("あ。\nい. う", 2, [], disabled), ["あ。\nい. う"]);
  assert.deepEqual(splitText("あ。\nい", 2, [], { ...disabled, splitOnNewline: true }), ["あ。\n", "い"]);
});

test("selected boundaries keep closing quotes, protected terms and whitespace without empty parts", () => {
  assert.deepEqual(splitText("「一。」二。三", 3), ["「一。」", "二。三"]);
  assert.deepEqual(splitText("あ、い。う。", 2, [{ start: 0, end: 4 }], { splitCharacters: "、。" }), [
    "あ、い。", "う。",
  ]);
  const text = " \n\nあ。" + " \n".repeat(20);
  const parts = splitText(text, 2, [], { splitOnSpace: true });
  assert(parts.every((part) => part.trim()));
  assert.equal(parts.join(""), text);
  assert.deepEqual(splitText("あ。" + " ".repeat(1000), 2), ["あ。" + " ".repeat(1000)]);
  assert.deepEqual(splitText("あ👨‍👩‍👧‍👦い。", 2, [], { splitCharacters: "👨‍👩‍👧‍👦" }), [
    "あ👨‍👩‍👧‍👦", "い。",
  ]);
});

test("configured text is joined before dictionary conversion and splitting without changing the caller input", () => {
  const process = createProcessor();
  const index = dictionaryIndex(
    rows([
      ["hello", "ハロー"],
      ["python", "とても長い置換結果"],
      ["goodbye", "さようなら"],
    ]),
  );
  const input = "Pythonです。次の文章です。";
  const options = {
    prefixText: "Hello!",
    suffixText: "Goodbye.",
    targetCharacters: 8,
  };
  const plan = process(input, options, "joined", index);
  assert.equal(
    plan.text,
    "ハロー!\nとても長い置換結果です。次の文章です。\nさようなら.",
  );
  assert.equal(plan.segments.join(""), plan.text);
  assert(plan.segments.length > 1);
  assert(
    plan.segments.some((segment) => segment.includes("とても長い置換結果")),
  );
  assert.equal(input, "Pythonです。次の文章です。");
  assert.deepEqual(options, {
    prefixText: "Hello!",
    suffixText: "Goodbye.",
    targetCharacters: 8,
  });
  const raw = process(
    input,
    { ...options, dictionaryEnabled: false, splitEnabled: false },
    "raw",
    index,
  );
  assert.deepEqual(raw.segments, [
    "Hello!\nPythonです。次の文章です。\nGoodbye.",
  ]);
});

test("blank additions contribute no separators while nonblank whitespace and newlines are preserved", () => {
  const process = createProcessor(),
    input = "  本文です。  ";
  for (const [i, value] of [
    {},
    { prefixText: "", suffixText: "" },
    { prefixText: " \n\t", suffixText: "\r\n " },
    {
      prefixText: " \n\t",
      suffixText: "\r\n ",
      prefixNewline: false,
      suffixNewline: false,
    },
  ].entries())
    assert.equal(process(input, value, i).text, input);
  assert.equal(
    process(input, { prefixText: "前文" }, "prefix").text,
    "前文\n  本文です。  ",
  );
  assert.equal(
    process(input, { suffixText: "後文" }, "suffix").text,
    "  本文です。  \n後文",
  );
  assert.equal(
    process(input, { prefixText: " 前文\n続き ", suffixText: " 後文 " }, "both")
      .text,
    " 前文\n続き \n  本文です。  \n 後文 ",
  );
  assert.throws(() => process(" \n ", { prefixText: "前文" }, "empty-body"));
});
test("newline choices are independent and dictionary matching sees the combined text", () => {
  const process = createProcessor();
  const index = dictionaryIndex(
    rows([
      ["hello", "ハロー"],
      ["keyboard", "キーボード"],
    ]),
  );
  for (const [prefixNewline, suffixNewline, expected] of [
    [true, true, "前。\nハロー。\n後。"],
    [false, true, "前。ハロー。\n後。"],
    [true, false, "前。\nハロー。後。"],
    [false, false, "前。ハロー。後。"],
  ]) {
    const plan = process(
      "Hello。",
      {
        prefixText: "前。",
        suffixText: "後。",
        prefixNewline,
        suffixNewline,
        targetCharacters: 4,
      },
      `${prefixNewline}/${suffixNewline}`,
      index,
    );
    assert.equal(plan.text, expected);
    assert.equal(plan.segments.join(""), expected);
  }
  assert.equal(
    process(
      "board",
      {
        prefixText: "key",
        prefixNewline: false,
      },
      "joined-prefix",
      index,
    ).text,
    "キーボード",
  );
  assert.equal(
    process(
      "key",
      {
        suffixText: "board",
        suffixNewline: false,
      },
      "joined-suffix",
      index,
    ).text,
    "キーボード",
  );
  assert.equal(
    process("board", { prefixText: "key" }, "separate", index).text,
    "key\nboard",
  );
  assert.equal(
    process(
      "本文",
      {
        prefixText: " 前\n文 ",
        suffixText: " 後\n文 ",
        prefixNewline: false,
        suffixNewline: false,
        dictionaryEnabled: false,
        splitEnabled: false,
      },
      "preserved",
    ).text,
    " 前\n文 本文 後\n文 ",
  );
});
test("after-split additions wrap every part without re-splitting or converting replacements twice", () => {
  const index = dictionaryIndex(
    rows([
      ["hello", "開始の長い文章"],
      ["python", "終了"],
      ["一", "甲"],
      ["甲", "二重変換"],
      ["開始の長い文章", "二重変換"],
      ["終了", "二重変換"],
    ]),
  );
  const plan = createProcessor()(
    "一。二。三。",
    {
      additionTiming: "after-split",
      prefixText: "Hello!",
      suffixText: "!Python",
      prefixNewline: false,
      suffixNewline: false,
      targetCharacters: 2,
      startMode: "count",
      startCount: 2,
    },
    "after",
    index,
  );
  assert.deepEqual(plan.segments, [
    "開始の長い文章!甲。!終了",
    "開始の長い文章!二。!終了",
    "開始の長い文章!三。!終了",
  ]);
  assert.equal(plan.text, plan.segments.join(""));
  assert.deepEqual(plan.startPolicy, { mode: "count", count: 2 });
});
test("after-split additions honor blank text, newline choices and disabled conversion or splitting", () => {
  const process = createProcessor();
  assert.deepEqual(
    process(
      "一。二。",
      {
        additionTiming: "after-split",
        prefixText: "前",
        suffixText: "後",
        splitEnabled: false,
        targetCharacters: 1,
      },
      "single",
    ).segments,
    ["前\n一。二。\n後"],
  );
  assert.deepEqual(
    process(
      "一。二。",
      {
        additionTiming: "after-split",
        prefixText: " 前\n文 ",
        suffixText: " 後文 ",
        prefixNewline: false,
        suffixNewline: false,
        dictionaryEnabled: false,
        targetCharacters: 2,
      },
      "literal",
    ).segments,
    [" 前\n文 一。 後文 ", " 前\n文 二。 後文 "],
  );
  assert.deepEqual(
    process(
      "一。二。",
      {
        additionTiming: "after-split",
        prefixText: " \n",
        suffixText: "\t",
        targetCharacters: 2,
      },
      "blank",
    ).segments,
    ["一。", "二。"],
  );
});
test("a large personal dictionary and long input remain complete without caps", () => {
  const dictionary = rows(
    Array.from({ length: 12000 }, (_, i) => [`Word${i}`, `ワード${i}`]),
  );
  const csv = exportCsv(dictionary),
    parsed = parseCsv(csv);
  assert.equal(parsed.length, 12000);
  const text = "Word11999を Word11 ".repeat(1200);
  const result = createProcessor()(text, {}, "large", dictionaryIndex(parsed));
  assert.equal(
    result.segments.join(""),
    "ワード11999を ワード11 ".repeat(1200),
  );
});

// A deliberately simple independent matcher checks behavior, not trie layout.
function referenceReplace(text, dictionary, ignoreCase = false) {
  const parts = [],
    ranges = [];
  const ascii = (character) => !!character && /^[A-Za-z0-9_]$/.test(character);
  const fold = (value) =>
    value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  let outputLength = 0;
  for (let i = 0; i < text.length;) {
    let found;
    for (const row of dictionary) {
      if (
        ignoreCase
          ? fold(text.slice(i, i + row.source.length)) !== fold(row.source)
          : !text.startsWith(row.source, i)
      )
        continue;
      const end = i + row.source.length,
        before = text.charCodeAt(end - 1),
        after = text.charCodeAt(end);
      if (
        before >= 0xd800 &&
        before <= 0xdbff &&
        after >= 0xdc00 &&
        after <= 0xdfff
      )
        continue;
      if (
        /^[A-Za-z0-9]+$/.test(row.source) &&
        (ascii(text[i - 1]) || ascii(text[end]))
      )
        continue;
      if (!found || row.source.length > found.source.length) found = row;
    }
    if (found) {
      parts.push(found.replacement);
      ranges.push({
        start: outputLength,
        end: outputLength + found.replacement.length,
      });
      outputLength += found.replacement.length;
      i += found.source.length;
    } else {
      const character = String.fromCodePoint(text.codePointAt(i));
      parts.push(character);
      outputLength += character.length;
      i += character.length;
    }
  }
  return { text: parts.join(""), ranges };
}
test("compiled dictionary preserves literal matching for unsorted Unicode, phrases and overlapping keys", () => {
  let seed = 89125;
  const random = (count) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % count;
  };
  const units = [
    "a",
    "b",
    "A",
    "0",
    "_",
    "日",
    "本",
    "橋",
    "😀",
    "𠮷",
    "\ue000",
    " ",
    "-",
    "\n",
    "\u0301",
  ];
  for (let trial = 0; trial < 100; trial++) {
    const sources = new Set([
      "日本",
      "日本橋",
      "a b",
      "😀",
      "😀a",
      "\ue000",
      "𠮷野",
      "\ud800",
    ]);
    while (sources.size < 36) {
      const source = Array.from(
        { length: 1 + random(8) },
        () => units[random(units.length)],
      ).join("");
      if (source.trim()) sources.add(source);
    }
    const dictionary = rows(
      [...sources].map((source, i) => [source, `置換${i}`]),
    );
    const text =
      Array.from({ length: 300 }, () => units[random(units.length)]).join("") +
      " " +
      [...sources].join(" ");
    const index = dictionaryIndex(dictionary);
    for (const ignoreCase of [false, true])
      assert.deepEqual(
        replaceText(text, index, ignoreCase),
        referenceReplace(text, dictionary, ignoreCase),
      );
  }
});

test("one index switches ASCII case matching while preserving priority, boundaries, longest matches and ranges", () => {
  const dictionary = rows([
    ["python", "パイソン"],
    ["Python", "別の読み"],
    ["HELLO", "先頭の読み"],
    ["hello", "後の読み"],
    ["JavaScript", "ジャヴァスクリプト"],
    ["key", "キー"],
    ["board", "ボード"],
    ["A日", "短い"],
    ["a日本", "長い"],
    ["😀ABC", "絵文字"],
    ["Ä", "非ASCII"],
    ["Ａ", "全角"],
  ]);
  const index = dictionaryIndex(dictionary);
  const text =
    "python Python PYTHON HELLO hello Hello JavaScript JAVASCRIPT keyboard key board MyPython A日本 😀abc Ä ä Ａ ａ";
  for (const ignoreCase of [false, true])
    assert.deepEqual(
      replaceText(text, index, ignoreCase),
      referenceReplace(text, dictionary, ignoreCase),
    );
  assert.equal(
    replaceText("Hello PYTHON JAVASCRIPT keyboard key board", index, true).text,
    "先頭の読み パイソン ジャヴァスクリプト keyboard キー ボード",
  );
  assert.equal(
    replaceText("hello Python Hello", index, false).text,
    "後の読み 別の読み Hello",
  );
  assert.equal(replaceText("A日本", index, false).text, "短い本");
  assert.equal(replaceText("A日本", index, true).text, "長い");
  assert.equal(replaceText("ä ａ", index, true).text, "ä ａ");
});

test("many spellings of one word retain their individual readings and a stable first-priority winner", () => {
  const dictionary = rows(
    Array.from({ length: 256 }, (_, mask) => [
      [..."caseword"]
        .map((letter, i) => (mask & (1 << i) ? letter.toUpperCase() : letter))
        .join(""),
      "読み" + mask,
    ]).reverse(),
  );
  const index = dictionaryIndex(dictionary),
    first = dictionary[0].replacement;
  for (const row of dictionary) {
    assert.equal(replaceText(row.source, index, false).text, row.replacement);
    assert.equal(replaceText(row.source, index, true).text, first);
  }
  dictionary[0].replacement = "編集中";
  dictionary.length = 0;
  assert.equal(replaceText("CaSeWoRd", index, true).text, first);
});
test("compiled dictionary owns a stable snapshot and handles empty and deep dictionaries", () => {
  const dictionary = rows([
    ["日本橋", "にほんばし"],
    ["日本", "にほん"],
  ]);
  const index = dictionaryIndex(dictionary);
  dictionary[0].replacement = "編集途中";
  dictionary.reverse();
  dictionary.length = 0;
  assert.equal(replaceText("日本橋と日本", index).text, "にほんばしとにほん");
  assert.deepEqual(replaceText("😀 日本", dictionaryIndex([])), {
    text: "😀 日本",
    ranges: [],
  });
  const deep = "日".repeat(10000);
  assert.equal(
    replaceText(deep, dictionaryIndex(rows([[deep, "長い登録語"]]))).text,
    "長い登録語",
  );
});
test("100,000 entries retain longest-match and first/last entries across a compiled index", () => {
  const dictionary = rows(
    Array.from({ length: 100000 }, (_, i) => [`Word${i}`, `ワード${i}`]),
  );
  const index = dictionaryIndex(dictionary);
  const text = "Word0 Word11 Word99999 Word99999_extra MyWord11";
  assert.equal(
    replaceText(text, index).text,
    "ワード0 ワード11 ワード99999 Word99999_extra MyWord11",
  );
});

test("CSV accepts duplicate sources with first-record priority and preserves literal keys", () => {
  const parsed = parseCsv(
    '\ufeffAppDock,アップドック\r\nAppDock,後の読み\r\n"two\nlines",先の読み\r\n"two\nlines",後の読み\r\nAPPDOCK,大文字\r\n" AppDock ",空白\r\nAppDock,アップドック',
  );
  assert.deepEqual(
    parsed.map(({ source, replacement }) => [source, replacement]),
    [
      ["AppDock", "アップドック"],
      ["two\nlines", "先の読み"],
      ["APPDOCK", "大文字"],
      [" AppDock ", "空白"],
    ],
  );
  assert.equal(new Set(parsed.map((row) => row.id)).size, 4);
  assert.equal(
    replaceText("AppDock", dictionaryIndex(parsed)).text,
    "アップドック",
  );
  assert.deepEqual(
    parseCsv(exportCsv(parsed)).map(({ source, replacement }) => [
      source,
      replacement,
    ]),
    parsed.map(({ source, replacement }) => [source, replacement]),
  );
});
