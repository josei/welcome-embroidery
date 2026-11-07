// @ts-check
// Singer XXX.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, fail, push, result, s8} from './shared.js';
// Singer XXX, read as pyembroidery 1.5.1 does (XxxReader): a 0x100-byte header whose colour count is at 0x27, uncompressed commands from 0x100 (a
// 7F escape introduces moves, trims and colour changes; 7D and 7E are big jumps), an end code, then the colours as big-endian 32-bit values.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readXxx(bytes) {
  if (bytes.length < 0x100) fail('XXX header is truncated');
  const colourCount = bytes[0x27] | bytes[0x28] << 8;
  let p = 0x100;
  const next = () => { if (p >= bytes.length) fail('XXX commands end before the end code'); return bytes[p++]; };
  const s16 = () => { const v = next() | next() << 8; return v > 0x7FFF ? v - 0x10000 : v; };
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  for (;;) {
    const b1 = next();
    if (b1 === 0x7D || b1 === 0x7E) {
      const dx = s16(), dy = -s16();
      x += dx; y += dy; push(stitches, x, y, 'jump', block);
      continue;
    }
    const b2 = next();
    if (b1 !== 0x7F) { x += s8(b1); y -= s8(b2); push(stitches, x, y, 'stitch', block); continue; }
    const b3 = next(), b4 = next();
    if (b2 === 0x01) { x += s8(b3); y -= s8(b4); push(stitches, x, y, 'jump', block); }
    else if (b2 === 0x03) {
      push(stitches, x, y, 'trim', block);
      const dx = s8(b3), dy = -s8(b4);
      if (dx !== 0 || dy !== 0) { x += dx; y += dy; push(stitches, x, y, 'jump', block); }
    }
    else if (b2 === 0x08 || (b2 >= 0x0A && b2 <= 0x17)) {
      block++; if (block >= MAX_THREADS) fail('too many colour changes');
      push(stitches, x, y, 'color', block);
    }
    else if (b2 === 0x7F || b2 === 0x18) break;
  }
  push(stitches, x, y, 'end', block);
  p += 2;
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i < colourCount && p + 4 <= bytes.length; i++) {
    const v = (bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3]) >>> 0;
    p += 4;
    threads.push({index: i, color: '#' + (v & 0xFFFFFF).toString(16).padStart(6, '0'), brand: 'XXX', catalogNumber: null, name: null});
  }
  // A colour block with no entry in the colour table gets a placeholder colour, and the file is reported as having one.
  /** @type {string[]} */ const warnings = [];
  if (threads.length < block + 1) warnings.push(threads.length
    ? 'XXX file has fewer colours than colour changes: placeholder colours were assigned.'
    : 'XXX file has no colour table: placeholder colours were assigned.');
  for (let i = threads.length; i <= block; i++) threads.push({index: i, color: '#527461', brand: 'XXX', catalogNumber: null, name: `Colour ${i + 1}`});
  return result(stitches, threads, warnings);
}
