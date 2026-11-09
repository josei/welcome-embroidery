// @ts-check
// Brother PEC and PES readers.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, fail, hex, push, result} from './shared.js';
// Brother PEC thread chart, 1-based: the machine stores these indices for each colour block (index 0 is no thread). Also used by the PEC and PES
// writers.
export const PEC_CHART = [
  [14,31,124], [10,85,163], [0,135,119], [75,107,175], [237,23,31], [209,92,0], [145,54,151], [228,154,203], [145,95,172], [158,214,125], [232,169,0],
  [254,186,53], [255,255,0], [112,188,31], [186,152,0], [168,168,168], [125,111,0], [255,255,179], [79,85,86], [0,0,0], [11,61,145], [119,1,118],
  [41,49,51], [42,19,1], [246,74,138], [178,118,36], [252,187,197], [254,55,15], [240,240,240], [106,28,138], [168,221,196], [37,132,187],
  [254,179,67], [255,243,107], [208,166,96], [209,84,0], [102,186,73], [19,74,70], [135,135,135], [216,204,198], [67,86,7], [253,217,222],
  [249,147,188], [0,56,34], [178,175,212], [104,106,176], [239,227,185], [247,56,102], [181,75,100], [19,43,26], [199,1,86], [254,158,50],
  [168,222,235], [0,103,62], [78,41,144], [47,126,32], [255,204,204], [255,217,17], [9,91,166], [240,249,112], [227,243,91], [255,153,0],
  [255,240,141], [255,200,200],
];
// PEC (Brother), as read by pyembroidery's PecReader: '#PEC0001', 'LA:' and a 16-byte label, the colour count minus one at 0x38 and one palette
// byte per colour, then the stitch stream at 0x218. Values are 0.1 mm relative moves: a byte below 0x80 is a 7-bit step, 0x80 starts a 12-bit step
// whose flags are 0x20 trim and 0x10 jump. FE B0 xx is a colour change; FF 00 ends the stream. Palette bytes index the chart modulo 65, where 0 is
// no thread (pyembroidery's reader behaves the same way). PES (Brother): every version starts '#PES' + a four-digit version, and bytes 8-11 hold
// the offset of its PEC block, which is read as a PEC file.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readPes(bytes) {
  if (bytes.length < 12) fail('PES header is truncated');
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== '#PES') fail('invalid PES signature');
  const offset = (bytes[8] | bytes[9] << 8 | bytes[10] << 16 | bytes[11] << 24) >>> 0;
  if (offset >= bytes.length) fail('PES PEC block offset is outside the file');
  // The offset points at the PEC label 'LA:', which is byte 8 of a PEC block; a PES file has no '#PEC0001' header of its own, so one is put in
  // front.
  const block = new Uint8Array(8 + bytes.length - offset);
  block.set(new TextEncoder().encode('#PEC0001'), 0);
  block.set(bytes.subarray(offset), 8);
  const result = readPec(block);
  const metadata = pesMetadata(bytes, offset);
  if (metadata) result.metadata = metadata;
  return result;
}
// PES headers from version 4 on (pyembroidery's PesReader) hold five length-prefixed strings after the 16-byte prefix: name, category, author,
// keywords and comments. Each is one length byte then the text; an empty field is a zero length. Versions 1 to 3 have none. Anything malformed or
// cut short by the PEC block is ignored, so the stitches still import.
const PES_METADATA_KEYS = ['name', 'category', 'author', 'keywords', 'comments'];
/** @param {Uint8Array} bytes @param {number} pecOffset @returns {Record<string, string> | null} */
function pesMetadata(bytes, pecOffset) {
  if (!(Number(new TextDecoder().decode(bytes.subarray(4, 8))) >= 40)) return null;
  /** @type {Record<string, string>} */
  const out = {};
  let p = 16;
  for (const key of PES_METADATA_KEYS) {
    if (p >= pecOffset) break;
    const n = bytes[p++];
    if (p + n > pecOffset) break;
    const text = new TextDecoder().decode(bytes.subarray(p, p + n)).trim();
    p += n;
    if (text) out[key] = text.slice(0, 240);
  }
  return Object.keys(out).length ? out : null;
}
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readPec(bytes) {
  if (bytes.length < 0x218) fail('PEC header is truncated');
  if (new TextDecoder().decode(bytes.subarray(0, 3)) !== '#PE' || new TextDecoder().decode(bytes.subarray(8, 11)) !== 'LA:') fail('invalid PEC signature');
  const count = bytes[0x38] + 1;
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i < count; i++) {
    const index = bytes[0x39 + i] % (PEC_CHART.length + 1);
    const rgb = index ? PEC_CHART[index - 1] : null;
    const color = rgb ? hex(rgb[0] << 16 | rgb[1] << 8 | rgb[2]) : null;
    const catalogNumber = index ? String(index) : null;
    threads.push({index: i, color, brand: 'PEC', catalogNumber, name: null});
  }
  /** @type {(b: number) => number} */ const s7 = b => b > 63 ? b - 128 : b;
  /** @type {(c: number) => number} */ const s12 = c => { c &= 0xFFF; return c > 0x7FF ? c - 0x1000 : c; };
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, p = 0x218;
  while (p + 1 < bytes.length) {
    let a = bytes[p], b = bytes[p + 1];
    p += 2;
    if (a === 0xFF && b === 0x00) break;
    if (a === 0xFE && b === 0xB0) { p += 1; push(stitches, x, y, 'color', 0); continue; }
    let jump = false, trim = false, dx = 0, dy = 0;
    if (a & 0x80) {
      trim = Boolean(a & 0x20); jump = Boolean(a & 0x10);
      if (p >= bytes.length) break;
      dx = s12(a << 8 | b); b = bytes[p++];
    } else dx = s7(a);
    if (b & 0x80) {
      trim = trim || Boolean(b & 0x20); jump = jump || Boolean(b & 0x10);
      if (p >= bytes.length) break;
      dy = s12(b << 8 | bytes[p++]);
    } else dy = s7(b);
    if (jump) { x += dx; y += dy; push(stitches, x, y, 'jump', 0); }
    else if (trim) { push(stitches, x, y, 'trim', 0); x += dx; y += dy; push(stitches, x, y, 'jump', 0); }
    else { x += dx; y += dy; push(stitches, x, y, 'stitch', 0); }
  }
  push(stitches, x, y, 'end', 0);
  // pyembroidery's interpolate_duplicate_color_as_stop: a colour change back to the thread already sewing becomes a STOP and its thread entry is
  // dropped.
  let threadIndex = 0, initColour = true, lastChange = -1;
  for (let i = 0; i < stitches.length; i++) {
    const cmd = stitches[i].cmd;
    if (cmd === 'color') { initColour = true; lastChange = i; continue; }
    if (cmd !== 'stitch' || !initColour) continue;
    if (lastChange >= 0 && threadIndex !== 0) {
      if (threadIndex >= threads.length) break;
      if (threads[threadIndex - 1].color === threads[threadIndex].color) { threads.splice(threadIndex, 1); stitches[lastChange].cmd = 'stop'; }
      else threadIndex++;
    } else threadIndex++;
    initColour = false;
  }
  threads.forEach((t, i) => { t.index = i; });
  let block = 0;
  for (const s of stitches) { if (s.cmd === 'color') s.thread = ++block; else s.thread = block; }
  if (block >= threads.length) fail('more color changes than colors');
  return result(stitches, threads);
}
