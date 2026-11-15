// The caller validates rows. All search data is private and independent of the
// input array, storage format, and subsequent edits to the source dictionary.
const foldAscii = (character) =>
  character >= 65 && character <= 90 ? character + 32 : character;
function compareFolded(a, b) {
  let offset = 0;
  while (offset < a.source.length && offset < b.source.length) {
    const left = foldAscii(a.source.codePointAt(offset)),
      right = foldAscii(b.source.codePointAt(offset));
    if (left !== right) return left - right;
    offset += left > 0xffff ? 2 : 1;
  }
  return a.source.length - b.source.length;
}
const compareSources = (a, b) =>
  compareFolded(a, b) ||
  (a.source < b.source ? -1 : a.source > b.source ? 1 : 0);
const indexArray = (length, largestValue) =>
  largestValue <= 0xffffffff
    ? new Uint32Array(length)
    : new Float64Array(length);
const asciiWord = (character) =>
  !!character && /^[A-Za-z0-9_]$/.test(character);

class DictionaryIndex {
  #labels;
  #children;
  #terminals;
  #sources;
  #replacements;
  #groups;
  #words;
  constructor(rows) {
    const sorted = rows
      .map((row, priority) => ({
        source: row.source,
        replacement: row.replacement,
        priority,
      }))
      .sort(compareSources);
    const labels = [0],
      first = [-1],
      last = [-1],
      sibling = [-1],
      terminal = [0];
    const path = [0],
      groups = [],
      words = [];
    let previous = "",
      group = -1;
    this.#sources = [];
    this.#replacements = [];
    for (let entry = 0; entry < sorted.length; entry++) {
      const row = sorted[entry];
      if (entry === 0 || compareFolded(sorted[entry - 1], row) !== 0) {
        group++;
        // Keep the spelling range and earliest input priority at each terminal.
        groups.push(entry, entry + 1, entry);
        words.push(/^[A-Za-z0-9]+$/.test(row.source) ? 1 : 0);
      } else {
        groups[group * 3 + 1] = entry + 1;
        const winner = groups[group * 3 + 2];
        if (row.priority < sorted[winner].priority)
          groups[group * 3 + 2] = entry;
      }
      let offset = 0,
        depth = 0;
      while (
        offset < previous.length &&
        offset < row.source.length &&
        foldAscii(previous.codePointAt(offset)) ===
          foldAscii(row.source.codePointAt(offset))
      ) {
        offset += row.source.codePointAt(offset) > 0xffff ? 2 : 1;
        depth++;
      }
      path.length = depth + 1;
      while (offset < row.source.length) {
        const originalCharacter = row.source.codePointAt(offset);
        const character = foldAscii(originalCharacter),
          parent = path[path.length - 1];
        const node = labels.length;
        labels.push(character);
        first.push(-1);
        last.push(-1);
        sibling.push(-1);
        terminal.push(0);
        if (last[parent] < 0) first[parent] = node;
        else sibling[last[parent]] = node;
        last[parent] = node;
        path.push(node);
        offset += originalCharacter > 0xffff ? 2 : 1;
      }
      terminal[path[path.length - 1]] = group + 1;
      this.#sources.push(row.source);
      this.#replacements.push(row.replacement);
      previous = row.source;
    }
    this.#groups = indexArray(groups.length, sorted.length);
    this.#groups.set(groups);
    this.#words = Uint8Array.from(words);
    // Breadth-first numbering makes every node's children one contiguous range.
    // No node objects, per-node arrays, or Map instances survive compilation.
    const count = labels.length,
      queue = indexArray(count, count - 1);
    this.#labels = new Uint32Array(count);
    this.#children = indexArray(count + 1, count);
    this.#terminals = indexArray(count, group + 1);
    let tail = 1;
    for (let node = 0; node < count; node++) {
      const original = queue[node];
      this.#labels[node] = labels[original];
      this.#terminals[node] = terminal[original];
      this.#children[node] = tail;
      for (let child = first[original]; child >= 0; child = sibling[child])
        queue[tail++] = child;
    }
    this.#children[count] = tail;
  }
  get size() {
    return this.#replacements.length;
  }
  get nodeCount() {
    return this.#labels.length;
  }
  get arrayBufferBytes() {
    return (
      this.#labels.byteLength +
      this.#children.byteLength +
      this.#terminals.byteLength +
      this.#groups.byteLength +
      this.#words.byteLength
    );
  }
  #child(node, character) {
    let low = this.#children[node],
      high = this.#children[node + 1];
    const end = high;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.#labels[middle] < character) low = middle + 1;
      else high = middle;
    }
    return low < end && this.#labels[low] === character ? low : -1;
  }
  #entry(group, text, start, end, ignoreCase) {
    const base = group * 3;
    if (ignoreCase) return this.#groups[base + 2];
    let low = this.#groups[base],
      high = this.#groups[base + 1];
    if (high - low === 1)
      return text.startsWith(this.#sources[low], start) ? low : -1;
    const last = high,
      source = text.slice(start, end);
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.#sources[middle] < source) low = middle + 1;
      else high = middle;
    }
    return low < last && this.#sources[low] === source ? low : -1;
  }
  replace(text, ignoreCase = false) {
    const pieces = [],
      ranges = [];
    let outputLength = 0;
    for (let i = 0; i < text.length;) {
      let node = 0,
        found = -1,
        matchEnd = i;
      for (let end = i; end < text.length;) {
        const character = text.codePointAt(end);
        node = this.#child(node, foldAscii(character));
        if (node < 0) break;
        end += character > 0xffff ? 2 : 1;
        const group = this.#terminals[node] - 1;
        if (
          group >= 0 &&
          (!this.#words[group] ||
            (!asciiWord(text[i - 1]) && !asciiWord(text[end])))
        ) {
          const entry = this.#entry(group, text, i, end, ignoreCase);
          if (entry >= 0) {
            found = entry;
            matchEnd = end;
          }
        }
      }
      if (found >= 0) {
        const replacement = this.#replacements[found];
        pieces.push(replacement);
        ranges.push({
          start: outputLength,
          end: outputLength + replacement.length,
        });
        outputLength += replacement.length;
        i = matchEnd;
      } else {
        const character = String.fromCodePoint(text.codePointAt(i));
        pieces.push(character);
        outputLength += character.length;
        i += character.length;
      }
    }
    return { text: pieces.join(""), ranges };
  }
}
module.exports = { compileDictionary: (rows) => new DictionaryIndex(rows) };
