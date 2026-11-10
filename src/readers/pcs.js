// @ts-check
// PCS (Pfaff).

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, fail, push, result} from './shared.js';
// PCS, read as pyembroidery 1.5.1 does (PcsReader): a header of version and hoop bytes and a 16-bit colour count, then one 4-byte entry per colour
// (a 24-bit big-endian colour and a skipped byte), a 16-bit stitch count, and 9-byte records: a byte, x as signed 24-bit little-endian, a byte, y
// as signed 24-bit little-endian (negated), then a control byte. Coordinates are absolute and scaled by 5/3. Control 0x00 stitches, bit 0x01
// changes colour, bit 0x04 jumps; anything else ends the stitches.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readPcs(bytes) {
  if (bytes.length < 6) fail('PCS header is truncated');
  const colours = bytes[2] | bytes[3] << 8;
  let p = 4;
  /** @type {string[]} */ const colourList = [];
  for (let i = 0; i < colours; i++) {
    if (p + 4 > bytes.length) fail('PCS color table is truncated');
    colourList.push('#' + ((bytes[p] << 16 | bytes[p + 1] << 8 | bytes[p + 2]) & 0xFFFFFF).toString(16).padStart(6, '0'));
    p += 4;
  }
  p += 2;
  /** @type {(o: number) => number} */
  const s24 = o => { const v = bytes[o] | bytes[o + 1] << 8 | bytes[o + 2] << 16; return v > 0x7FFFFF ? v - 0x1000000 : v; };
  const ratio = 5 / 3;
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  for (; p + 9 <= bytes.length; p += 9) {
    const ctrl = bytes[p + 8];
    const X = s24(p + 1) * ratio, Y = -s24(p + 5) * ratio;
    if (ctrl === 0x00) { x = X; y = Y; push(stitches, x, y, 'stitch', block); }
    else if (ctrl & 0x01) { block++; if (block >= MAX_THREADS) fail('too many color changes'); push(stitches, x, y, 'color', block); }
    else if (ctrl & 0x04) { x = X; y = Y; push(stitches, x, y, 'jump', block); }
    else break;
  }
  push(stitches, x, y, 'end', block);
  /** @type {string[]} */ const warnings = [];
  if (colourList.length < block + 1) warnings.push(colourList.length
    ? 'PCS file has fewer colors than color changes: placeholder colors were assigned.'
    : 'PCS file has no color table: placeholder colors were assigned.');
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i <= Math.max(colourList.length - 1, block); i++) {
    const color = i < colourList.length ? colourList[i] : '#527461';
    threads.push({index: i, color, brand: 'PCS', catalogNumber: null, name: `Color ${i + 1}`});
  }
  return result(stitches, threads, warnings);
}
