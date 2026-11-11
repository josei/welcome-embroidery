// @ts-check
// Writers: turn a compiled plan into machine file bytes (JEF, VP3, PEC, PES, SEW, TBF, XXX, U01, EXP, DST) and thread colour lists (COL, EDR).
// The engine re-exports these functions, so callers keep importing them from engine.js.
// Each machine format lives in its own module under ./encoders/, sharing byte plumbing. This file is the
// public entry point: the JSDoc types and the format dispatch live here, so importers keep using './encoders.js'.
import {hoopSize} from './hoops.js';
import {decodeEmbroidery} from './readers.js';
import {encodeJef} from './encoders/jef.js';
import {encodeVp3} from './encoders/vp3.js';
import {hasLongStitch, layerCanPassThrough, sourceMatches, vp3LayerHasUnsupportedTravel} from './encoders/layers.js';
import {encodePec} from './encoders/pec.js';
import {encodePes, encodePesV6} from './encoders/pes.js';
import {encodeSew} from './encoders/sew.js';
import {encodeTbf} from './encoders/tbf.js';
import {encodeXxx} from './encoders/xxx.js';
import {encodeU01} from './encoders/u01.js';
import {encodeExp} from './encoders/exp.js';
import {encodeDst} from './encoders/dst.js';
import {encodeCol, encodeEdr} from './encoders/colour.js';

/**
 * A design: its objects, and the stitch layers imported into it keep their source bytes.
 * @typedef {{name?: string, hoop?: number, hoopH?: number, objects: Array<import('./transforms.js').Obj & {visible?: boolean, stitches?: Array<{x: number, y:
  * number, cmd: string, thread: string}>, threads?: Record<string, {color?: string}>, threadOverrides?: Record<string, string>, source?: {format: string,
  * bounds: number[], size?: number, defaultPlacement: {x: number, y: number, w: number, h: number}, originalBytesBase64?: string|null, defaultThread:
  * string}}>}} Document
 * @typedef {Document['objects'][number] & {source: NonNullable<Document['objects'][number]['source']>, stitches:
  * NonNullable<Document['objects'][number]['stitches']>, threadOverrides: Record<string, string>, threads: Record<string, {color?: string}>}} Layer
 */

/**
 * @typedef {{x: number, y: number, cmd: string, thread: string}} PlanStitch
 * @typedef {{errors: string[], stitches: PlanStitch[], bounds: number[], count: number}} Plan
 * @typedef {{thread: string, palette?: number, items: PlanStitch[]}} JefBlock
 * @typedef {{thread: string, start: number[], items: PlanStitch[]}} Vp3Block
 */

export {
  encodeJef, encodeVp3, hasLongStitch, layerCanPassThrough, sourceMatches, vp3LayerHasUnsupportedTravel,
  encodePec, encodePes, encodePesV6, encodeSew, encodeTbf, encodeXxx, encodeU01, encodeExp, encodeDst,
  encodeCol, encodeEdr,
};

/** Writers that split non-jump moves longer than MAX_STITCH_MM; an imported file with such a move is re-encoded instead of passed through. */
const LONG_MOVE_FORMATS=['pec','pes','pes6','vp3'];

/**
 * Writes a compiled plan in one machine format. An unchanged imported file is returned as its source bytes.
 * @param {Plan} plan
 * @param {string} format
 * @param {string} [color]
 * @param {number|{w: number, h: number}} [hoop]
 * @param {Document|null} [document]
 * @returns {Uint8Array}
 */
export function encode(plan,format,color,hoop=110,document=null){
  if(document)hoop=hoopSize(document);
  if(
    !(['jef','vp3','dst','exp','pec','pes','pes6','sew','u01','xxx','tbf','col','edr'].includes(
    format)))throw Error(`Unsupported machine format: ${format}. Choose JEF, VP3, DST, EXP, PEC, PES, PES v6, SEW, U01, XXX, TBF, COL or EDR.`);
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  const layers=/** @type {Layer[]} */((document?.objects||[]).filter(o=>o.visible!==false&&o.kind==='stitch_layer'));
  if(layers.length===1&&document?.objects.length===1&&layerCanPassThrough(layers[0],format)&&!(LONG_MOVE_FORMATS.includes(format)&&hasLongStitch(layers[0].stitches))){
    const bytes=Uint8Array.from(atob(/** @type {string} */(layers[0].source.originalBytesBase64)),c=>c.charCodeAt(0));
    if(bytes.byteLength===layers[0].source.size){try{const checked=decodeEmbroidery(bytes,format);if(sourceMatches(checked,layers[0]))return bytes;}catch{}}
  }
  if(format==='vp3'&&layers.some(o=>vp3LayerHasUnsupportedTravel(o.stitches)))throw Error(
    'This VP3 design contains intra-block travel, trim, or stop commands the current VP3 writer cannot preserve after edits. Leading color-block origin ' +
    'moves and no-op moves are preserved. Export JEF or restore the unchanged VP3 source.');
  if(format==='jef')return encodeJef(plan,color,hoop);if(format==='dst')return encodeDst(plan,document?.name||'Welcome');
    if(format==='exp')return encodeExp(plan);if(format==='pec')return encodePec(plan,document?.name||'Welcome');
    if(format==='pes')return encodePes(plan,document?.name||'Welcome');if(format==='pes6')return encodePesV6(plan,document?.name||'Welcome');
    if(format==='sew')return encodeSew(plan);if(format==='u01')return encodeU01(plan);if(format==='xxx')return encodeXxx(plan);
    if(format==='tbf')return encodeTbf(plan,document?.name||'Welcome');if(format==='col')return encodeCol(plan);if(format==='edr')return encodeEdr(plan);
    return encodeVp3(plan,color);
}

