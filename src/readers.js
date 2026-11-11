// @ts-check
// Bounded browser-side stitch readers for 21 machine formats: JEF, VP3, DST, SEW, PEC, PES,
// EXP, HUS, XXX, DSB, DSZ, TAP, TBF, PCS, SHV, STX, BRO, EMD, KSM, 10O and U01, plus the COL and EDR
// thread colour lists (no stitches; they decode to threads only).
// Each format family lives in its own typed module under ./readers/, sharing byte plumbing and
// colour tables. This file is the public entry point: the JSDoc types, the charts the encoders
// use and the format dispatch live here, so importers keep using './readers.js'.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/**
 * @typedef {{x: number, y: number, cmd: string, thread: number}} Stitch
 * @typedef {{
 *   index: number, color: string | null, brand: string, catalogNumber: string | null, name: string | null,
 *   threadType?: number, weight?: number, transition?: number
 * }} Thread
 * @typedef {{stitches: Stitch[], threads: Thread[], bounds: number[], warnings: string[], metadata?: Record<string, string>, anchored?: boolean}} Decoded
 * @typedef {{x: number, y: number, cmd: number}} Step
 * @typedef {{dflt: number, table: number[] | null, width: number, lengths: number[]}} Huff
 */

import {MAX_FILE_BYTES, MAX_THREADS, asBytes, fail} from './readers/shared.js';
import {readJef} from './readers/jef.js';
import {readVp3} from './readers/vp3.js';
import {readDst, readTap, readTbf} from './readers/tajima.js';
import {readSew} from './readers/sew.js';
import {readPec, readPes} from './readers/pec.js';
import {readExp, readStx} from './readers/exp.js';
import {readHus} from './readers/hus.js';
import {readXxx} from './readers/xxx.js';
import {readDsb, readDsz} from './readers/barudan.js';
import {readPcs} from './readers/pcs.js';
import {readShv} from './readers/shv.js';
import {readBro, readEmd} from './readers/broEmd.js';
import {readKsm, readTenO} from './readers/ksm10o.js';
import {readU01} from './readers/u01.js';

export {PEC_CHART} from './readers/pec.js';
export {SEW_CHART} from './readers/sew.js';

/** @param {Uint8Array | ArrayBuffer} input @param {string} format @returns {Decoded} */
export function decodeEmbroidery(input, format) {
  const bytes=asBytes(input);
  if(bytes.byteLength>MAX_FILE_BYTES) fail('file exceeds 64 MiB limit');
  if(format==='jef') return readJef(bytes);
  if(format==='vp3') return readVp3(bytes);
  if(format==='dst') return readDst(bytes);
  if(format==='sew') return readSew(bytes);
  if(format==='pec') return readPec(bytes);
  if(format==='pes') return readPes(bytes);
  if(format==='exp') return readExp(bytes);
  if(format==='hus') return readHus(bytes);
  if(format==='xxx') return readXxx(bytes);
  if(format==='dsb') return readDsb(bytes);
  if(format==='dsz') return readDsz(bytes);
  if(format==='tap') return readTap(bytes);
  if(format==='tbf') return readTbf(bytes);
  if(format==='pcs') return readPcs(bytes);
  if(format==='shv') return readShv(bytes);
  if(format==='stx') return readStx(bytes);
  if(format==='bro') return readBro(bytes);
  if(format==='emd') return readEmd(bytes);
  if(format==='ksm') return readKsm(bytes);
  if(format==='10o') return readTenO(bytes);
  if(format==='u01') return readU01(bytes);
  if(format==='col') return readCol(bytes);
  if(format==='edr') return readEdr(bytes);
  fail('format must be jef, vp3, dst, sew, pec, pes, exp, hus, xxx, dsb, dsz, tap, tbf, pcs, shv, stx, bro, emd, ksm, 10o, u01, col or edr');
}

/** @param {number} r @param {number} g @param {number} b @returns {string} */
const rgbHex = (r, g, b) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

/** @param {Uint8Array} bytes @returns {Decoded} */
export function readCol(bytes) {
  const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  if (text.includes('\r') && !/\r\n/.test(text)) fail('COL line ends must be CRLF');
  const lines = text.split('\r\n');
  if (lines.pop() !== '') fail('COL must end with a CRLF');
  const count = Number(lines[0]);
  if (!/^\d+$/.test(lines[0] ?? '') || count > MAX_THREADS) fail('COL color count is invalid');
  if (lines.length !== count + 1) fail('COL color count does not match the number of entries');
  /** @type {Thread[]} */ const threads = [];
  lines.slice(1).forEach((line, i) => {
    const m = /^(\d+),(\d{1,3}),(\d{1,3}),(\d{1,3})$/.exec(line);
    if (!m || Number(m[1]) !== i) fail('COL entry is malformed or out of order');
    const [r, g, b] = [Number(m[2]), Number(m[3]), Number(m[4])];
    if (r > 255 || g > 255 || b > 255) fail('COL color component out of range');
    threads.push({index: i, color: rgbHex(r, g, b), brand: '', catalogNumber: null, name: null});
  });
  return {stitches: [], threads, bounds: [0, 0, 0, 0], warnings: []};
}

/** @param {Uint8Array} bytes @returns {Decoded} */
export function readEdr(bytes) {
  if (bytes.byteLength % 4) fail('EDR length is not a multiple of four bytes');
  const count = bytes.byteLength / 4;
  if (count > MAX_THREADS) fail('EDR color count is too large');
  /** @type {Thread[]} */ const threads = [];
  for (let i = 0; i < count; i++) {
    const [r, g, b] = [bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2]];
    threads.push({index: i, color: rgbHex(r, g, b), brand: '', catalogNumber: null, name: null});
  }
  return {stitches: [], threads, bounds: [0, 0, 0, 0], warnings: []};
}
