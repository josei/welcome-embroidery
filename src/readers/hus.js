// @ts-check
// Husqvarna HUS, including its Huffman and back-reference stream expansion.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
/** @typedef {import('../readers.js').Huff} Huff */
import {HUS_THREADS, MAX_THREADS, fail, push, result, s8} from './shared.js';
// Husqvarna HUS, read as pyembroidery 1.5.1 does (HusReader and EmbCompress): a header, a chart of 29 thread colours, then the command, x and y
// streams, each compressed with a Huffman and back-reference scheme. Coordinates are 0.1 mm and y is stored negated.

/** @type {(message: string) => never} */ const husFail = message => fail(`HUS ${message}`);
/** @param {Uint8Array} data @param {number} size @returns {number[]} */
function husExpand(data, size) {
  let bitPos = 0, blockElements = -1;
  /** @type {Huff | null} */
  let charHuff = null;
  /** @type {Huff | null} */
  let distHuff = null;
  /** @type {(start: number, length: number) => number} */ const bits = (start, length) => {
    const end = start + length - 1, first = Math.floor(start / 8), last = Math.floor(end / 8);
    let value = 0;
    for (let i = first; i <= last; i++) value = (value << 8) | (i < data.length ? data[i] : 0);
    const unused = (8 - ((end + 1) % 8)) % 8;
    return (value >>> unused) & ((1 << length) - 1);
  };
  /** @type {(n: number) => number} */ const peek = n => bits(bitPos, n);
  /** @type {(n: number) => number} */ const pop = n => { const v = peek(n); bitPos += n; return v; };
  // A Huffman code is either a single default value (table null) or a lookup table built from code lengths.
  /** @type {(lengths: number[] | null, dflt: number) => Huff} */ const huffman = (lengths, dflt) => {
    if (!lengths) return {dflt, table: null, width: 0, lengths: []};
    const width = Math.max(...lengths);
    if (!Number.isFinite(width) || width < 1 || width > 16) husFail('has an invalid Huffman code');
    /** @type {number[]} */ const table = [];
    let size = 1 << width;
    for (let len = 1; len <= width; len++) {
      size /= 2;
      lengths.forEach((l, index) => { if (l === len) for (let k = 0; k < size; k++) table.push(index); });
    }
    return {dflt, table, width, lengths};
  };
  /** @type {(h: Huff, bits16: number) => [number, number]} */ const lookup = (h, bits16) => {
    if (!h.table) return [h.dflt, 0];
    const v = h.table[bits16 >> (16 - h.width)];
    if (v === undefined) husFail('has an incomplete Huffman code');
    return [v, h.lengths[v]];
  };
  const variableLength = () => {
    let m = pop(3);
    if (m !== 7) return m;
    for (let q = 0; q < 13; q++) { if (pop(1) === 1) m++; else break; }
    return m;
  };
  const characterLengthHuffman = () => {
    const count = pop(5);
    if (count === 0) return huffman(null, pop(5));
    /** @type {number[]} */ const lengths = new Array(count).fill(0);
    let index = 0;
    while (index < count) {
      if (index === 3) index += pop(2);
      if (index >= count) husFail('has a code length out of range');
      lengths[index++] = variableLength();
    }
    return huffman(lengths, 8);
  };
  /** @type {(lengthHuff: Huff) => Huff} */ const characterHuffman = lengthHuff => {
    const count = pop(9);
    if (count === 0) return huffman(null, pop(9));
    /** @type {number[]} */ const lengths = new Array(count).fill(0);
    let index = 0;
    while (index < count) {
      const [c, used] = lookup(lengthHuff, peek(16));
      bitPos += used;
      if (c === 0) index += 1;
      else if (c === 1) index += 3 + pop(4);
      else if (c === 2) index += 20 + pop(9);
      else {
        if (index >= count) husFail('has a code length out of range');
        lengths[index++] = c - 2;
      }
    }
    return huffman(lengths, 0);
  };
  const distanceHuffman = () => {
    const count = pop(5);
    if (count === 0) return huffman(null, pop(5));
    /** @type {number[]} */ const lengths = [];
    for (let i = 0; i < count; i++) lengths.push(variableLength());
    return huffman(lengths, 0);
  };
  const loadBlock = () => {
    blockElements = pop(16);
    charHuff = characterHuffman(characterLengthHuffman());
    distHuff = distanceHuffman();
  };
  const token = () => {
    if (blockElements <= 0) loadBlock();
    blockElements--;
    const [v, used] = lookup(/** @type {Huff} */ (charHuff), peek(16));
    bitPos += used;
    return v;
  };
  const position = () => {
    const [v, used] = lookup(/** @type {Huff} */ (distHuff), peek(16));
    bitPos += used;
    if (v === 0) return 0;
    return (1 << (v - 1)) + pop(v - 1);
  };
  /** @type {number[]} */ const out = [];
  const bitsTotal = data.length * 8;
  while (bitsTotal > bitPos && (size === null || out.length <= size)) {
    const c = token();
    if (c <= 255) out.push(c);
    else if (c === 510) break;
    else {
      const length = c - 253, back = position() + 1, start = out.length - back;
      if (start < 0) husFail('has a back-reference before its start');
      if (back > length) out.push(...out.slice(start, start + length));
      else for (let i = start; i < start + length; i++) out.push(out[i]);
    }
  }
  return out;
}
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readHus(bytes) {
  if (bytes.length < 42) husFail('header is truncated');
  /** @type {(o: number) => number} */ const u32 = o => (bytes[o] | bytes[o + 1] << 8 | bytes[o + 2] << 16 | bytes[o + 3] << 24) >>> 0;
  /** @type {(o: number) => number} */ const u16 = o => bytes[o] | bytes[o + 1] << 8;
  const stitchCount = u32(4), colours = u32(8);
  const cmdOffset = u32(20), xOffset = u32(24), yOffset = u32(28);
  if (colours < 1 || colours > MAX_THREADS) husFail('has an invalid color count');
  if (42 + 2 * colours > bytes.length) husFail('color chart is truncated');
  if (!(cmdOffset <= xOffset && xOffset <= yOffset && yOffset <= bytes.length)) husFail('stream offsets are out of order');
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i < colours; i++) {
    const index = u16(42 + 2 * i);
    if (index >= HUS_THREADS.length) husFail('uses an unknown thread');
    const [color, name, code] = HUS_THREADS[index];
    threads.push({index: i, color, brand: 'HUS', catalogNumber: code, name});
  }
  const cmd = husExpand(bytes.subarray(cmdOffset, xOffset), stitchCount);
  const xs = husExpand(bytes.subarray(xOffset, yOffset), stitchCount);
  const ys = husExpand(bytes.subarray(yOffset), stitchCount);
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  const count = Math.min(cmd.length, xs.length, ys.length);
  for (let i = 0; i < count; i++) {
    const dx = s8(xs[i]), dy = -s8(ys[i]);
    if (cmd[i] === 0x80) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); }
    else if (cmd[i] === 0x81) { x += dx; y += dy; push(stitches, x, y, 'jump', block); }
    else if (cmd[i] === 0x84) { x += dx; y += dy; block++; if (block >= MAX_THREADS) husFail('too many color changes'); push(stitches, x, y, 'color', block); }
    else if (cmd[i] === 0x88) { if (dx !== 0 || dy !== 0) { x += dx; y += dy; push(stitches, x, y, 'jump', block); } push(stitches, x, y, 'trim', block); }
    else break;
  }
  push(stitches, x, y, 'end', block);
  return result(stitches, threads);
}
