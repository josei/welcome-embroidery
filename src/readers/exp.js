// @ts-check
// Melco EXP, and the STX stitch stream that shares its decoder.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, dstPalette, fail, push, result, s8} from './shared.js';
// EXP (Melco), as read by pyembroidery's ExpReader: no header, a stream of byte pairs of 0.1 mm steps (y is negated, as in SEW). 80 xx starts a
// control record whose own pair holds the step: 80 80 is a trim (its step is ignored), 80 04 a jump, 80 02 a stitch, 80 01 a colour change followed
// by a jump when the step is not zero. Any other control ends the stream, and so does EOF. EXP has no palette, so each colour block gets a
// placeholder colour as DST does.
/** @param {Uint8Array} bytes @param {string} [label] @returns {Decoded} */
export function readExp(bytes, label = 'EXP') {
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0, p = 0;
  while (p + 1 < bytes.length) {
    const a = bytes[p], b = bytes[p + 1];
    p += 2;
    if (a !== 0x80) { x += s8(a); y -= s8(b); push(stitches, x, y, 'stitch', block); continue; }
    if (p + 1 >= bytes.length) break;
    const dx = s8(bytes[p]), dy = -s8(bytes[p + 1]);
    p += 2;
    if (b === 0x80) { push(stitches, x, y, 'trim', block); continue; }
    if (b === 0x02) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); continue; }
    if (b === 0x04) { x += dx; y += dy; push(stitches, x, y, 'jump', block); continue; }
    if (b === 0x01) {
      push(stitches, x, y, 'color', ++block);
      if (block >= MAX_THREADS) fail('too many color changes');
      if (dx !== 0 || dy !== 0) { x += dx; y += dy; push(stitches, x, y, 'jump', block); }
      continue;
    }
    break;
  }
  push(stitches, x, y, 'end', block);
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i <= block; i++) {
    threads.push({index: i, color: dstPalette[i % dstPalette.length], brand: label, catalogNumber: null, name: `Color ${i + 1}`});
  }
  return result(stitches, threads, [`${label} files carry no thread colors: placeholder colors were assigned.`]);
}

// STX, read as pyembroidery 1.5.1 does (StxReader): a 'STX' file whose stitch stream starts at the offset in the 32-bit field at 0x14; the stream
// is read with the EXP decoder. The file carries no colour table, so colour blocks get placeholder colours.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readStx(bytes) {
  if (bytes.length < 0x18) fail('STX header is truncated');
  if (new TextDecoder().decode(bytes.subarray(0, 3)) !== 'STX') fail('invalid STX signature');
  const start = (bytes[0x14] | bytes[0x15] << 8 | bytes[0x16] << 16 | bytes[0x17] << 24) >>> 0;
  if (start >= bytes.length) fail('STX stitch stream is outside the file');
  return readExp(bytes.subarray(start), 'STX');
}
