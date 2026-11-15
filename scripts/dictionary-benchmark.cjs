const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const processing = require('../src/processing.cjs');
const round = (value) => +value.toFixed(3);
const mib = (value) => +(value / 1048576).toFixed(2);
const asciiWord = (character) => !!character && /^[A-Za-z0-9_]$/.test(character);
// Previous representation, kept only as the comparison baseline.
function baselineIndex(rows) {
  const root = new Map();
  for (const row of processing.validateDictionary(rows)) {
    let node = root;
    for (const character of row.source) {
      if (!node.has(character)) node.set(character, new Map());
      node = node.get(character);
    }
    node.row = { ...row, word: /^[A-Za-z0-9]+$/.test(row.source) };
  }
  return root;
}
function baselineReplace(text, root) {
  const pieces = [], ranges = [];
  let outputLength = 0;
  for (let i = 0; i < text.length;) {
    let node = root, found, end = i;
    for (let j = i; j < text.length;) {
      const character = String.fromCodePoint(text.codePointAt(j));
      node = node.get(character);
      if (!node) break;
      j += character.length;
      if (node.row && (!node.row.word || (!asciiWord(text[i - 1]) && !asciiWord(text[j])))) {
        found = node.row; end = j;
      }
    }
    if (found) {
      pieces.push(found.replacement);
      ranges.push({ start: outputLength, end: outputLength + found.replacement.length });
      outputLength += found.replacement.length; i = end;
    } else {
      const character = String.fromCodePoint(text.codePointAt(i));
      pieces.push(character); outputLength += character.length; i += character.length;
    }
  }
  return { text: pieces.join(''), ranges };
}
if (process.argv[2] === '--case') {
  if (!global.gc) throw Error('Use --expose-gc');
  const count = Number(process.argv[3]), shape = process.argv[4], algorithm = process.argv[5];
  global.gc();
  const before = process.memoryUsage();
  let lines = [], sources = new Set();
  const samples = [];
  for (let i = 0; i < count; i++) {
    let salt = 0, word;
    do {
      const hash = createHash('sha256').update(`capacity-${i}-${salt++}`).digest();
      const length = shape === 'shared-prefix' ? 6 + hash[24] % 7 : 6 + hash[24] % 13;
      word = (shape === 'shared-prefix' ? 'term' : '') +
        Array.from(hash.subarray(0, length), (byte) => String.fromCharCode(97 + byte % 26)).join('');
    } while (sources.has(word));
    sources.add(word); lines.push(`${word},ヨミ${i}`);
    if (i % 100 === 0) samples.push({ id: String(i), source: word, replacement: `ヨミ${i}` });
  }
  let csv = lines.join('\r\n'); lines = null; sources = null;
  const csvBytes = Buffer.byteLength(csv);
  let started = performance.now(), rows = processing.parseCsv(csv);
  const parseMs = performance.now() - started;
  assert.equal(rows.length, count);
  csv = null;
  const build = algorithm === 'packed' ? processing.dictionaryIndex : baselineIndex;
  const replace = algorithm === 'packed' ? processing.replaceText : baselineReplace;
  started = performance.now();
  const index = build(rows), buildMs = performance.now() - started;
  rows = null; global.gc();
  const after = process.memoryUsage();
  for (const sample of samples) assert.equal(replace(sample.source, index).text, sample.replacement);
  const timings = [];
  for (const characters of [1000, 10000]) {
    const parts = [];
    let length = 0, i = 0;
    while (length < characters) {
      const part = i % 2 ? `unknown${i}` : samples[(i * 31) % samples.length].source;
      parts.push(part); length += part.length + 1; i++;
    }
    const text = parts.join(' ').slice(0, characters);
    const expected = baselineReplace(text, baselineIndex(samples));
    assert.deepEqual(replace(text, index), expected);
    for (let i = 0; i < 30; i++) replace(text, index);
    const elapsed = [];
    for (let i = 0; i < 200; i++) {
      started = performance.now();
      const result = replace(text, index);
      elapsed.push(performance.now() - started);
      assert.ok(result.ranges.length);
    }
    elapsed.sort((a, b) => a - b);
    timings.push({ characters, medianMs: round(elapsed[100]), p95Ms: round(elapsed[189]) });
  }
  process.stdout.write(JSON.stringify({ algorithm, count, shape, csvMiB: mib(csvBytes), parseMs: round(parseMs), buildMs: round(buildMs),
    retainedHeapMiB: mib(after.heapUsed - before.heapUsed), retainedArrayBuffersMiB: mib(after.arrayBuffers - before.arrayBuffers),
    retainedTotalMiB: mib(after.heapUsed - before.heapUsed + after.arrayBuffers - before.arrayBuffers), processRssMiB: mib(after.rss),
    processPeakRssMiB: mib(process.resourceUsage().maxRSS * 1024), nodeCount: index.nodeCount, indexBufferBytes: index.arrayBufferBytes, timings }));
} else {
  const output = path.resolve(process.argv[2] || path.join(__dirname, '../.artifacts/dictionary-benchmark'));
  fs.mkdirSync(output, { recursive: true });
  const inputs = ['src/processing.cjs', 'src/dictionary-engine.cjs', 'scripts/dictionary-benchmark.cjs'];
  const report = { createdAt: new Date().toISOString(), node: process.version, cpu: os.cpus()[0]?.model,
    inputs: Object.fromEntries(inputs.map((file) => [file, createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', file))).digest('hex')])),
    method: 'Fresh process per case; synthetic UTF-8 CSV; explicit GC; retained heap plus ArrayBuffer delta, not heap alone; full process RSS/peak RSS separate. 30 warmups and 200 replacements. Excludes GUI, storage I/O, multi-dictionary merging, IPC and TTS.', cases: [] };
  for (const count of [50000, 100000]) for (const shape of ['shared-prefix', 'varied-prefix']) for (const algorithm of ['map', 'packed']) {
    const result = spawnSync(process.execPath, ['--expose-gc', __filename, '--case', String(count), shape, algorithm], { encoding: 'utf8' });
    if (result.status !== 0) throw Error(result.stderr || `Child exited ${result.status}`);
    const row = JSON.parse(result.stdout); report.cases.push(row); process.stdout.write(JSON.stringify(row) + '\n');
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const table = report.cases.map((row) => `| ${row.algorithm} | ${row.count} | ${row.shape} | ${row.retainedTotalMiB} | ${row.retainedHeapMiB} | ${row.retainedArrayBuffersMiB} | ${row.buildMs} | ${row.timings[1].medianMs} |`).join('\n');
  fs.writeFileSync(path.join(output, 'report.md'), `# Dictionary engine benchmark\n\n${report.method}\n\nNode ${report.node}; ${report.cpu}.\n\n| Engine | Entries | Shape | Retained total MiB | Heap MiB | ArrayBuffers MiB | Build ms | 10,000-char median ms |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${table}\n`);
}
