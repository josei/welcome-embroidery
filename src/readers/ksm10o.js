// @ts-check
// KSM and 10O: 3-byte records whose control byte carries the command in its low five bits.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, blockResult, fail, push} from './shared.js';
// KSM, read as pyembroidery 1.5.1 does (KsmReader): 3-byte records from 0x200 (y is stored negated, the 0x40 and 0x20 bits of the control byte flip
// x and y, and the low five bits are the control code). Steps are stitches until a trim, and moves after it, until the restart codes. Control 0x07,
// 0x13 and 0x1D trim (only once something is stitched) and start a trim; 0x17 to 0x19 and 0x1B end it; 0x0B to 0x12 are needle changes; 0x05 is a
// stop; 0x08 ends the stitches. There is no colour table, so needle changes start placeholder colour blocks.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readKsm(bytes) {
  if (bytes.length < 0x200) fail('KSM header is truncated');
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  let trimmed = false, stitchedYet = false;
  for (let p = 0x200; p + 3 <= bytes.length; p += 3) {
    let dy = -bytes[p], dx = bytes[p + 1];
    const raw = bytes[p + 2];
    if (raw & 0x40) dx = -dx;
    if (raw & 0x20) dy = -dy;
    const ctrl = raw & 0x1F;
    if (dx !== 0 || dy !== 0) {
      if (trimmed) { x += dx; y += dy; push(stitches, x, y, 'jump', block); }
      else { x += dx; y += dy; push(stitches, x, y, 'stitch', block); stitchedYet = true; }
    }
    if (ctrl === 0x00) continue;
    if (ctrl === 0x07 || ctrl === 0x13 || ctrl === 0x1D) {
      if (stitchedYet) push(stitches, x, y, 'trim', block);
      trimmed = true;
      continue;
    }
    if (ctrl >= 0x17 && ctrl <= 0x19) { trimmed = false; continue; }
    if (ctrl >= 0x0B && ctrl <= 0x12) {
      block++; if (block >= MAX_THREADS) fail('too many colour changes');
      push(stitches, x, y, 'color', block);
      trimmed = true;
      continue;
    }
    if (ctrl === 0x05) { push(stitches, x, y, 'stop', block); continue; }
    if (ctrl === 0x1B) { trimmed = false; continue; }
    if (ctrl === 0x08) break;
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'KSM');
}

// 10O, read as pyembroidery 1.5.1 does (A10oReader): 3-byte records from the start of the file. The first byte is the control, the second is y
// (negated) and the third is x; the 0x20 and 0x40 bits flip x and y. Control codes in the low five bits: 0 is a stitch and 0x10 a move. 0x8A is the
// start marker, 0x85 a colour change, 0x82 a stop, 0x81 a trim and 0x87 ends the stitches. There is no colour table, so colour changes start
// placeholder colour blocks.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readTenO(bytes) {
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  for (let p = 0; p + 3 <= bytes.length; p += 3) {
    const ctrl = bytes[p];
    let dy = -bytes[p + 1], dx = bytes[p + 2];
    if (ctrl & 0x20) dx = -dx;
    if (ctrl & 0x40) dy = -dy;
    if ((ctrl & 0x1F) === 0) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); continue; }
    if ((ctrl & 0x1F) === 0x10) { x += dx; y += dy; push(stitches, x, y, 'jump', block); continue; }
    if (ctrl === 0x8A) continue;
    if (ctrl === 0x85) { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, x, y, 'color', block); continue; }
    if (ctrl === 0x82) { push(stitches, x, y, 'stop', block); continue; }
    if (ctrl === 0x81) { push(stitches, x, y, 'trim', block); continue; }
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, '10O');
}
