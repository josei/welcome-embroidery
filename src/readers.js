// @ts-check
// Bounded browser-side stitch readers for 20 machine formats: JEF, VP3, DST, SEW, PEC, PES,
// EXP, HUS, XXX, DSB, DSZ, TAP, TBF, PCS, SHV, STX, BRO, EMD, KSM and 10O.
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
 * @typedef {{stitches: Stitch[], threads: Thread[], bounds: number[], warnings: string[], metadata?: Record<string, string>}} Decoded
 * @typedef {{x: number, y: number, cmd: number}} Step
 * @typedef {{dflt: number, table: number[] | null, width: number, lengths: number[]}} Huff
 */

import {MAX_FILE_BYTES, asBytes, fail} from './readers/shared.js';
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
  fail('format must be jef, vp3, dst, sew, pec, pes, exp, hus, xxx, dsb, dsz, tap, tbf, pcs, shv, stx, bro, emd, ksm or 10o');
}
