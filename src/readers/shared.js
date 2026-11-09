// @ts-check
// Byte plumbing, stitch accumulators and colour tables shared by the format readers.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
/** @typedef {import('../readers.js').Step} Step */

export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_STITCHES = 2_000_000;
export const MAX_THREADS = 256;
/** @param {string} message @returns {never} */
export const fail = message => { throw new Error(`Invalid embroidery file: ${message}`); };
/** @param {Uint8Array | ArrayBuffer} input @returns {Uint8Array} */
export const asBytes = input => {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  fail('expected Uint8Array or ArrayBuffer');
};

/** @param {number} n @returns {number} */
export const s8 = n => n > 127 ? n - 256 : n;
export class Reader {
  /** @param {Uint8Array} bytes */
  constructor(bytes) { this.b = bytes; this.p = 0; }
  /** @param {number} n */
  need(n) { if (!Number.isSafeInteger(n) || n < 0 || this.p + n > this.b.length) fail('truncated data'); }
  /** @param {number} n */
  skip(n) { this.need(n); this.p += n; }
  u8() { this.need(1); return this.b[this.p++]; }
  s8() { const n = this.u8(); return n > 127 ? n - 256 : n; }
  u16be() { return this.u8() * 256 + this.u8(); }
  u32le() { return (this.u8() | this.u8() << 8 | this.u8() << 16 | this.u8() << 24) >>> 0; }
  u32be() { return (this.u8() * 0x1000000 + this.u8() * 0x10000 + this.u8() * 0x100 + this.u8()) >>> 0; }
  s32be() { const n = this.u32be(); return n > 0x7fffffff ? n - 0x100000000 : n; }
  s16be() { const n = this.u16be(); return n > 0x7fff ? n - 0x10000 : n; }
  str8() {
    const n = this.u16be(); this.need(n);
    const s = new TextDecoder('utf-8', {fatal:true}).decode(this.b.subarray(this.p, this.p+n));
    this.p += n; return s;
  }
  str16() {
    const n = this.u16be(); this.need(n);
    if (n % 2) fail('odd UTF-16 string length');
    const s = new TextDecoder('utf-16be', {fatal:true}).decode(this.b.subarray(this.p, this.p+n));
    this.p += n; return s;
  }
}

export const jefColors = [
  null, 0x000000, 0xffffff, 0xffff17, 0xff6600, 0x2f5933, 0x237336, 0x65c2c8, 0xab5a96, 0xf669a0, 0xff0000, 0xb1704e, 0x0b2f84, 0xe4c35d, 0x481a05,
  0xac9cc7, 0xfcf294, 0xf999b7, 0xfab381, 0xc9a480, 0x970533, 0xa0b8cc, 0x7fc21c, 0xe5e5e5, 0x889b9b, 0x98d6bd, 0xb2e1e3, 0x368ba0, 0x4f83ab,
  0x386a91, 0x071650, 0xf999a2, 0xf9676b, 0xe3311f, 0xe2a188, 0xb59474, 0xe4cf99, 0xffcb00, 0xe1add4, 0xc3007e, 0x80004b, 0x540571, 0xb10525,
  0xcae0c0, 0x899856, 0x5c941a, 0x003114, 0x5dae94, 0x4cbf8f, 0x007772, 0x595b61, 0xfffff2, 0xb15818, 0xcb8a07, 0x986c80, 0x98692d, 0x4d3419,
  0x4c330b, 0x33200a, 0x523a97, 0x0d217e, 0x1e77ac, 0xb2dd53, 0xf33689, 0xde649e, 0x984161, 0x4c5612, 0x4c881f, 0xe4de79, 0xcb8a1a, 0xcba21c,
  0xff9805, 0xfcb257, 0xffe505, 0xf0331f, 0x1a842d, 0x386cae, 0xe3c4b4, 0xe3ac81,
];
/** @param {number} n @returns {string} */
export const hex = n => `#${(n >>> 0).toString(16).padStart(6,'0')}`;

/** @param {Stitch[]} stitches @param {Thread[]} threads @param {string[]} [warnings] @returns {Decoded} */
export function result(stitches, threads, warnings=[]) {
  if (!stitches.length) fail('no stitch commands');
  const sew = stitches.some(s => s.cmd === 'stitch');
  if (!sew) fail('no sewable stitches');
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const s of stitches){minX=Math.min(minX,s.x);minY=Math.min(minY,s.y);maxX=Math.max(maxX,s.x);maxY=Math.max(maxY,s.y);}
  return {stitches, threads, bounds:[minX,minY,maxX,maxY],warnings};
}

/** @param {Stitch[]} out @param {number} x @param {number} y @param {string} cmd @param {number} thread */
export function push(out, x, y, cmd, thread) {
  if (out.length >= MAX_STITCHES) fail('stitch count exceeds limit');
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x)>100000 || Math.abs(y)>100000) fail('coordinate exceeds limit');
  /** @type {(n: number) => number} */
  const mm=n=>Object.is(n,-0)?0:n;
  out.push({x:mm(x/10),y:mm(y/10),cmd,thread});
}

export const dstPalette = ['#1f2937','#c0392b','#2471a3','#229954','#d4ac0d','#8e44ad','#e67e22','#17a589','#7f8c8d','#a93226','#5d6d7e','#117864'];

export const HUS_THREADS = [
  ["#000000","Black","026"], ["#0000e7","Blue","005"], ["#00c600","Green","002"], ["#ff0000","Red","014"], ["#840084","Purple","008"],
  ["#ffff00","Yellow","020"], ["#848484","Gray","024"], ["#8484e7","Light Blue","006"], ["#00ff84","Light Green","003"], ["#ff7b31","Orange","017"],
  ["#ff8ca5","Pink","011"], ["#845200","Brown","028"], ["#ffffff","White","022"], ["#000084","Dark Blue","004"], ["#008400","Dark Green","001"],
  ["#7b0000","Dark Red","013"], ["#ff6384","Light Red","015"], ["#522952","Dark Purple","007"], ["#ff00ff","Light Purple","009"],
  ["#ffde00","Dark Yellow","019"], ["#ffff9c","Light Yellow","021"], ["#525252","Dark Gray","025"], ["#d6d6d6","Light Gray","023"],
  ["#ff5208","Dark Orange","016"], ["#ff9c5a","Light Orange","018"], ["#ff52b5","Dark Pink","010"], ["#ffc6de","Light Pink","012"],
  ["#523100","Dark Brown","027"], ["#b5a584","Light Brown","029"],
];

export const SHV_THREADS = [
  [0,0,0], [0,0,255], [51,204,102], [255,0,0], [255,0,255], [255,255,0], [127,127,127], [51,154,255], [0,255,0], [255,127,0], [255,160,180],
  [153,75,0], [255,255,255], [0,0,0], [0,0,0], [0,0,0], [0,0,0], [0,0,0], [0,0,0], [255,127,127], [255,127,255], [255,255,153], [192,192,192],
  [0,0,0], [0,0,0], [255,165,65], [255,204,204], [175,90,10], [0,0,0], [0,0,0], [0,0,0], [0,0,0], [0,0,0], [0,0,127], [0,127,0], [127,0,0],
  [127,0,127], [200,200,0], [60,60,60], [0,0,0], [0,0,0], [232,63,0], [255,102,122],
];

// Colour blocks in a file with no colour table: one placeholder colour per block, reported as a warning when there is more than one block.
/** @param {Stitch[]} stitches @param {number} block @param {string} brand @returns {Decoded} */
export function blockResult(stitches, block, brand) {
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i <= block; i++) threads.push({index: i, color: '#527461', brand, catalogNumber: null, name: `Color ${i + 1}`});
  return result(stitches, threads, block ? [`${brand} files carry no thread colors: placeholder colors were assigned.`] : []);
}

// pyembroidery's EmbPattern.interpolate_trims on a list of absolute {x, y, cmd} stitches, edited in place: a run of jumps after stitching gets a
// trim at its start once it reaches jumpsRequired jumps, and a zero-displacement run is deleted when clipping.
/** @param {Step[]} st @param {number} jumpsRequired @param {boolean} clipping */
export function interpolateTrims(st, jumpsRequired, clipping) {
  const JUMP = 1, STITCH = 0, TRIM = 2, COLOR = 5;
  let i = -1, ie = st.length - 1, x = 0, y = 0, jumpCount = 0, jumpStart = 0, jumpDx = 0, jumpDy = 0, jumping = false, trimmed = true;
  while (i < ie) {
    i++;
    const s = st[i];
    const dx = s.x - x, dy = s.y - y;
    x = s.x; y = s.y;
    if (s.cmd === STITCH) { trimmed = false; jumping = false; }
    else if (s.cmd === COLOR || s.cmd === TRIM) { trimmed = true; jumping = false; }
    if (s.cmd !== JUMP) continue;
    if (!jumping) { jumpDx = 0; jumpDy = 0; jumpCount = 0; jumpStart = i; jumping = true; }
    jumpCount++; jumpDx += dx; jumpDy += dy;
    if (!trimmed && jumpCount === jumpsRequired) {
      // The trim takes the position of the stitch before the jump run, as pyembroidery's insert_stitch_relative does.
      const before = jumpStart > 0 ? st[jumpStart - 1] : {x: 0, y: 0};
      st.splice(jumpStart, 0, {x: before.x, y: before.y, cmd: TRIM});
      jumpStart++; i++; ie++;
      trimmed = true;
    }
    if (clipping && jumpDx === 0 && jumpDy === 0) {
      st.splice(jumpStart, i + 1 - jumpStart);
      i = jumpStart - 1;
      ie = st.length - 1;
    }
  }
}
