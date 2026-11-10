// @ts-check
// SEW (Janome native).

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, fail, hex, push, result, s8} from './shared.js';
// Janome SEW thread set (pyembroidery's 79-entry EmbThreadSew list, 0-based): the file stores indices into it.
export const SEW_CHART = [
  [0,0,0], [0,0,0], [255,255,255], [255,255,23], [250,160,96], [92,118,73], [64,192,48], [101,194,200], [172,128,190], [245,188,203], [255,0,0],
  [192,128,0], [0,0,240], [228,195,93], [165,42,42], [213,176,212], [252,242,148], [240,208,192], [255,192,0], [201,164,128], [155,61,75],
  [160,184,204], [127,194,28], [185,185,185], [160,160,160], [152,214,189], [184,240,240], [54,139,160], [79,131,171], [56,106,145], [0,32,107],
  [229,197,202], [249,103,107], [227,49,31], [226,161,136], [181,148,116], [228,207,153], [225,203,0], [225,173,212], [195,0,126], [128,0,75],
  [160,96,176], [192,64,32], [202,224,192], [137,152,86], [0,170,0], [33,138,33], [93,174,148], [76,191,143], [0,119,114], [112,112,112],
  [242,255,255], [177,88,24], [203,138,7], [247,146,123], [152,105,45], [162,113,72], [123,85,74], [79,57,70], [82,58,151], [0,0,160], [0,150,222],
  [178,221,83], [250,143,187], [222,100,158], [181,80,102], [94,87,71], [76,136,31], [228,220,121], [203,138,26], [198,170,66], [236,176,44],
  [248,128,64], [255,229,5], [250,122,122], [107,224,0], [56,108,174], [208,186,176], [227,190,129],
];

// SEW (Janome native), as read by pyembroidery's SewReader: a 2-byte colour count and 2-byte thread-chart indices, then the stitch stream from byte
// 0x1D78. A record is two bytes: a plain pair is a stitch, and 80 xx starts a control record whose own two bytes are its coordinates (or zeros for
// a colour change). 80 01 is a colour change, 80 02 and 80 04 a jump, 80 10 a stitch; any other control ends the stream. Coordinates are relative,
// in 0.1 mm, with y negated.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readSew(bytes) {
  if (bytes.length < 0x1D78) fail('SEW header is truncated');
  const colours = bytes[0] | bytes[1] << 8;
  if (colours < 1 || colours > MAX_THREADS) fail('invalid SEW color count');
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i < colours; i++) {
    const [r, g, b] = SEW_CHART[(bytes[2 + 2*i] | bytes[3 + 2*i] << 8) % SEW_CHART.length];
    threads.push({index:i, color:hex(r << 16 | g << 8 | b), brand:'SEW', catalogNumber:null, name:null});
  }
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0, p = 0x1D78;
  while (p + 2 <= bytes.length) {
    const a = bytes[p], b = bytes[p+1];
    p += 2;
    if (a !== 0x80) { x += s8(a); y -= s8(b); push(stitches, x, y, 'stitch', block); continue; }
    if (p + 2 > bytes.length) break;
    const dx = s8(bytes[p]), dy = s8(bytes[p+1]);
    p += 2;
    if (b & 1) { block++; if (block >= colours) fail('more color changes than colors'); push(stitches, x, y, 'color', block); continue; }
    if (b === 0x02 || b === 0x04) { x += dx; y -= dy; push(stitches, x, y, 'jump', block); continue; }
    if (b === 0x10) { x += dx; y -= dy; push(stitches, x, y, 'stitch', block); continue; }
    break;
  }
  push(stitches, x, y, 'end', block);
  return result(stitches, threads);
}
