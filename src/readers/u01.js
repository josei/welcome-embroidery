// @ts-check
// Barudan U01: a 256-byte header, then 3-byte records (control, dy, dx) in 0.1 mm, ended by F8 00 00. The layout is the one src/encoders/u01.js writes.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, blockResult, fail, push} from './shared.js';

// Header: 0x80 ASCII '0's, then int16 bounds (min x, -max y, max x, -min y), a zero int32, the record count + 1 as int32 and the last stitch as
// int16 (x, -y), padded to 0x100. The header is only checked for size here; the stitches come from the records. Control byte: the low five bits
// are the command (0x00 stitch, 0x01 jump, 0x07 trim, 0x08 stop, 0x09 to 0x17 needle change to needle 1 to 15); 0x40 set means dy is positive and
// 0x20 set means dx is negative. Each record moves the pen first, then the command applies at the new position, as the encoder writes trims,
// stops and colour changes. 0xF8 ends the file.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readU01(bytes) {
  if (bytes.length < 0x100) fail('U01 header is truncated');
  /** @type {import('../readers.js').Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0;
  for (let p = 0x100; p + 3 <= bytes.length; p += 3) {
    const ctrl = bytes[p];
    if (ctrl === 0xF8) break;
    const cmd = ctrl & 0x1F;
    let dy = bytes[p + 1], dx = bytes[p + 2];
    if (!(ctrl & 0x40)) dy = -dy;
    if (ctrl & 0x20) dx = -dx;
    x += dx; y += dy;
    if (cmd === 0x00) push(stitches, x, y, 'stitch', block);
    else if (cmd === 0x01) push(stitches, x, y, 'jump', block);
    else if (cmd === 0x07) push(stitches, x, y, 'trim', block);
    else if (cmd === 0x08) push(stitches, x, y, 'stop', block);
    else if (cmd >= 0x09 && cmd <= 0x17) { block++; if (block >= MAX_THREADS) fail('too many color changes'); push(stitches, x, y, 'color', block); }
    else fail(`unknown U01 command 0x${cmd.toString(16)}`);
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'U01');
}
