// @ts-check
// BRO and EMD: 2-byte records with 80-prefixed control escapes.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, blockResult, fail, push, s8} from './shared.js';
// BRO, read as pyembroidery 1.5.1 does (BroReader): records from 0x100 in pairs of bytes. A first byte other than 0x80 is a relative stitch (y is
// stored negated). A 0x80 escape reads a control byte: 0x00 is a no-op, 0x02 and 0xE0 end the stitches, 0x03 and 0x7E are a 16-bit move, and 0xE1
// to 0xEF change needle and then move. There is no colour table, so each needle change starts a colour block.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readBro(bytes) {
  if (bytes.length < 0x100) fail('BRO header is truncated');
  /** @type {(o: number) => number} */ const s16 = o => { const v = bytes[o] | bytes[o + 1] << 8; return v > 0x7FFF ? v - 0x10000 : v; };
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  let p = 0x100;
  const move = () => { if (p + 4 > bytes.length) fail('BRO move is truncated'); x += s16(p); y -= s16(p + 2); p += 4; push(stitches, x, y, 'jump', block); };
  while (p + 2 <= bytes.length) {
    const b0 = bytes[p], b1 = bytes[p + 1];
    p += 2;
    if (b0 !== 0x80) { x += s8(b0); y -= s8(b1); push(stitches, x, y, 'stitch', block); continue; }
    if (p >= bytes.length) break;
    const control = bytes[p++];
    if (control === 0x00) continue;
    if (control === 0x02 || control === 0xE0) break;
    if (control === 0x7E || control === 0x03) { move(); continue; }
    if (control > 0xE0 && control < 0xF0) {
      block++; if (block >= MAX_THREADS) fail('too many color changes');
      push(stitches, x, y, 'color', block);
      move();
      continue;
    }
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'BRO');
}

// EMD, read as pyembroidery 1.5.1 does (EmdReader): 2-byte records from 0x30. A first byte other than 0x80 is a relative stitch (y is stored
// negated). A 0x80 escape reads a control byte: 0x80 is a 2-byte move, 0x2A a colour change, 0x7D a no-op, 0xAD and 0x90 a trim (0x90 is the last
// command before the start), 0xFD ends the stitches, and anything else stops. There is no colour table, so each colour change starts a colour
// block.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readEmd(bytes) {
  if (bytes.length < 0x30) fail('EMD header is truncated');
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  let p = 0x30;
  while (p + 2 <= bytes.length) {
    const b0 = bytes[p], b1 = bytes[p + 1];
    p += 2;
    if (b0 !== 0x80) { x += s8(b0); y -= s8(b1); push(stitches, x, y, 'stitch', block); continue; }
    if (b1 === 0x80) {
      if (p + 2 > bytes.length) break;
      x += s8(bytes[p]); y -= s8(bytes[p + 1]); p += 2;
      push(stitches, x, y, 'jump', block);
      continue;
    }
    if (b1 === 0x2A) { block++; if (block >= MAX_THREADS) fail('too many color changes'); push(stitches, x, y, 'color', block); continue; }
    if (b1 === 0x7D) continue;
    if (b1 === 0xAD || b1 === 0x90) { push(stitches, x, y, 'trim', block); continue; }
    if (b1 === 0xFD) break;
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'EMD');
}
