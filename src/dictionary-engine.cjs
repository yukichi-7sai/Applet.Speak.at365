// The caller validates rows. All search data is private and independent of the
// input array, storage format, and subsequent edits to the source dictionary.
function compareSources(a, b) {
  let offset = 0;
  while (offset < a.source.length && offset < b.source.length) {
    const left = a.source.codePointAt(offset), right = b.source.codePointAt(offset);
    if (left !== right) return left - right;
    offset += left > 0xffff ? 2 : 1;
  }
  return a.source.length - b.source.length;
}
const indexArray = (length, largestValue) =>
  largestValue <= 0xffffffff ? new Uint32Array(length) : new Float64Array(length);
const asciiWord = (character) => !!character && /^[A-Za-z0-9_]$/.test(character);

class DictionaryIndex {
  #labels;
  #children;
  #terminals;
  #replacements;
  #words;
  constructor(rows) {
    const sorted = rows.slice().sort(compareSources);
    const labels = [0], first = [-1], last = [-1], sibling = [-1], terminal = [0];
    const path = [0];
    let previous = '';
    this.#replacements = [];
    this.#words = new Uint8Array(sorted.length);
    for (let entry = 0; entry < sorted.length; entry++) {
      const row = sorted[entry];
      let offset = 0, depth = 0;
      while (offset < previous.length && offset < row.source.length &&
             previous.codePointAt(offset) === row.source.codePointAt(offset)) {
        offset += row.source.codePointAt(offset) > 0xffff ? 2 : 1;
        depth++;
      }
      path.length = depth + 1;
      while (offset < row.source.length) {
        const character = row.source.codePointAt(offset), parent = path[path.length - 1];
        const node = labels.length;
        labels.push(character); first.push(-1); last.push(-1); sibling.push(-1); terminal.push(0);
        if (last[parent] < 0) first[parent] = node;
        else sibling[last[parent]] = node;
        last[parent] = node;
        path.push(node);
        offset += character > 0xffff ? 2 : 1;
      }
      terminal[path[path.length - 1]] = entry + 1;
      this.#replacements.push(row.replacement);
      this.#words[entry] = /^[A-Za-z0-9]+$/.test(row.source) ? 1 : 0;
      previous = row.source;
    }
    // Breadth-first numbering makes every node's children one contiguous range.
    // No node objects, per-node arrays, or Map instances survive compilation.
    const count = labels.length, queue = indexArray(count, count - 1);
    this.#labels = new Uint32Array(count);
    this.#children = indexArray(count + 1, count);
    this.#terminals = indexArray(count, sorted.length);
    let tail = 1;
    for (let node = 0; node < count; node++) {
      const original = queue[node];
      this.#labels[node] = labels[original];
      this.#terminals[node] = terminal[original];
      this.#children[node] = tail;
      for (let child = first[original]; child >= 0; child = sibling[child]) queue[tail++] = child;
    }
    this.#children[count] = tail;
  }
  get size() { return this.#replacements.length; }
  get nodeCount() { return this.#labels.length; }
  get arrayBufferBytes() {
    return this.#labels.byteLength + this.#children.byteLength +
      this.#terminals.byteLength + this.#words.byteLength;
  }
  #child(node, character) {
    let low = this.#children[node], high = this.#children[node + 1];
    const end = high;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.#labels[middle] < character) low = middle + 1;
      else high = middle;
    }
    return low < end && this.#labels[low] === character ? low : -1;
  }
  replace(text) {
    const pieces = [], ranges = [];
    let outputLength = 0;
    for (let i = 0; i < text.length;) {
      let node = 0, found = -1, matchEnd = i;
      for (let end = i; end < text.length;) {
        const character = text.codePointAt(end);
        node = this.#child(node, character);
        if (node < 0) break;
        end += character > 0xffff ? 2 : 1;
        const entry = this.#terminals[node] - 1;
        if (entry >= 0 && (!this.#words[entry] ||
            (!asciiWord(text[i - 1]) && !asciiWord(text[end])))) {
          found = entry;
          matchEnd = end;
        }
      }
      if (found >= 0) {
        const replacement = this.#replacements[found];
        pieces.push(replacement);
        ranges.push({ start: outputLength, end: outputLength + replacement.length });
        outputLength += replacement.length;
        i = matchEnd;
      } else {
        const character = String.fromCodePoint(text.codePointAt(i));
        pieces.push(character);
        outputLength += character.length;
        i += character.length;
      }
    }
    return { text: pieces.join(''), ranges };
  }
}
module.exports = { compileDictionary: (rows) => new DictionaryIndex(rows) };
