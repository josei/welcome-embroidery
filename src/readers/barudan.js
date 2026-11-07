// @ts-check
// Barudan DSB and DSZ: the same DST-style 3-byte records with different byte orders.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, blockResult, fail, push} from './shared.js';
// Barudan-style DSB, read as pyembroidery 1.5.1 does (DsbReader): a 512-byte DST-style header, then 3-byte records. The control byte gives the
// command, and its 0x40 and 0x20 bits flip y and x. Coordinates are read as unsigned bytes, as pyembroidery does. There is no colour table: each
// needle change starts a colour block.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readDsb(bytes) {
  if (bytes.length < 512) fail('DSB header is truncated');
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  let p = 512;
  for (; p + 3 <= bytes.length; p += 3) {
    const ctrl = bytes[p];
    let dy = -bytes[p + 1], dx = bytes[p + 2];
    if (ctrl & 0x40) dy = -dy;
    if (ctrl & 0x20) dx = -dx;
    if ((ctrl & 0x1F) === 0) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); continue; }
    if ((ctrl & 0x1F) === 1) { x += dx; y += dy; push(stitches, x, y, 'jump', block); continue; }
    if (ctrl === 0xF8) break;
    if (ctrl === 0xE7) { push(stitches, x, y, 'trim', block); continue; }
    if (ctrl === 0xE8) { push(stitches, x, y, 'stop', block); continue; }
    if (ctrl >= 0xE9 && ctrl < 0xF8) { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, x, y, 'color', block); continue; }
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'DSB');
}

// Barudan-style DSZ (pyembroidery's DszReader): the same header and 3-byte records as DSB, with the bytes in another order (y, x, control), other
// control codes (0x82 stop, 0x9B trim, 0x83 to 0x9A needle change) and no end code: the file simply stops.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readDsz(bytes) {
  if (bytes.length < 512) fail('DSZ header is truncated');
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  for (let p = 512; p + 3 <= bytes.length; p += 3) {
    const ctrl = bytes[p + 2];
    let dy = -bytes[p], dx = bytes[p + 1];
    if (ctrl & 0x40) dx = -dx;
    if (ctrl & 0x20) dy = -dy;
    if ((ctrl & 0x1F) === 0) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); continue; }
    if ((ctrl & 0x1F) === 1) { x += dx; y += dy; push(stitches, x, y, 'jump', block); continue; }
    if (ctrl === 0x82) { push(stitches, x, y, 'stop', block); continue; }
    if (ctrl === 0x9B) { push(stitches, x, y, 'trim', block); continue; }
    if (ctrl >= 0x83 && ctrl <= 0x9A) { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, x, y, 'color', block); continue; }
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'DSZ');
}
