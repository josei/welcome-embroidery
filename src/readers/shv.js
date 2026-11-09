// @ts-check
// SHV (Husqvarna Viking).

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, SHV_THREADS, fail, push, result, s8} from './shared.js';
// SHV, read as pyembroidery 1.5.1 does (ShvReader): a header with the design name, size and colour count, then a 32-bit stitch count and a thread
// code for each colour, then 2-byte stitch records. Colour changes come from the per-colour stitch counts, as in pyembroidery. The thread codes
// index the 43-colour SHV chart. Control 0x80 with a second byte of 1 is a jump with a 16-bit move, 2 ends a jump run, 3 is ignored; anything else
// is a stitch step.

/** @param {Uint8Array} bytes @returns {Decoded} */
export function readShv(bytes) {
  let p = 0x56;
  /** @type {number[][]} */ const colourList = [];
  const u8 = () => (p < bytes.length ? bytes[p++] : null);
  const u32be = () => {
    if (p + 4 > bytes.length) fail('SHV color table is truncated');
    const v = (bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3]) >>> 0;
    p += 4; return v;
  };
  const s16be = () => {
    if (p + 2 > bytes.length) fail('SHV move is truncated');
    const v = bytes[p] << 8 | bytes[p + 1]; p += 2;
    return v > 0x7FFF ? v - 0x10000 : v;
  };
  const length = u8();
  if (length === null) fail('SHV header is truncated');
  const name = new TextDecoder().decode(bytes.subarray(p, p + length)).trim();
  p += length;
  const width = u8(), height = u8();
  if (width === null || height === null) fail('SHV header is truncated');
  p += 4 + Math.ceil(height / 2) * width;
  const colourCount = u8();
  if (colourCount === null) fail('SHV header is truncated');
  p += 18;
  /** @type {number[]} */ const perColour = [];
  for (let i = 0; i < colourCount; i++) {
    perColour.push(u32be());
    if (p >= bytes.length) fail('SHV color table is truncated');
    const code = bytes[p++];
    colourList.push(SHV_THREADS[code % SHV_THREADS.length]);
    p += 9;
  }
  p -= 2;
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0, sinceStop = 0, current = 0, inJump = false;
  let maxStitches = perColour.length ? perColour[0] : 0;
  for (;;) {
    const jumping = inJump;
    const b0 = u8(), b1 = u8();
    if (b0 === null || b1 === null) break;
    if (sinceStop >= maxStitches) {
      block++; if (block >= MAX_THREADS) fail('too many color changes');
      push(stitches, x, y, 'color', block);
      sinceStop = 0;
      current++;
      maxStitches = current < perColour.length ? perColour[current] : 0xFFFFFFFF;
    }
    if (b0 === 0x80) {
      sinceStop++;
      if (b1 === 3) continue;
      if (b1 === 2) { inJump = false; continue; }
      if (b1 === 1) {
        sinceStop += 2;
        const sx = s16be(), sy = s16be();
        inJump = true;
        x += sx; y += sy; push(stitches, x, y, 'jump', block);
        continue;
      }
    }
    x += s8(b0); y += s8(b1);
    sinceStop++;
    push(stitches, x, y, jumping ? 'jump' : 'stitch', block);
  }
  push(stitches, x, y, 'end', block);
  /** @type {Thread[]} */ const threads = [];
  /** @type {string[]} */ const warnings = [];
  if (colourList.length < block + 1) warnings.push(colourList.length
    ? 'SHV file has fewer colors than color changes: placeholder colors were assigned.'
    : 'SHV file has no color table: placeholder colors were assigned.');
  for (let i = 0; i <= Math.max(colourList.length - 1, block); i++) {
    const rgb = i < colourList.length ? colourList[i] : null;
    const color = rgb ? '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('') : '#527461';
    threads.push({index: i, color, brand: 'SHV', catalogNumber: null, name: `Color ${i + 1}`});
  }
  const decoded = result(stitches, threads, warnings);
  if (name) decoded.metadata = {name: name.slice(0, 240)};
  return decoded;
}
