// @ts-check
// Writers: turn a compiled plan into machine file bytes (JEF, VP3, PEC, PES, SEW, TBF, XXX, U01, EXP, DST) and thread colour lists (COL, EDR).
// The engine re-exports these functions, so callers keep importing them from engine.js.
// Each machine format lives in its own module under ./encoders/, sharing byte plumbing. This file is the
// public entry point: the JSDoc types and the format dispatch live here, so importers keep using './encoders.js'.
import {hoopSize} from './hoops.js';
import {decodeEmbroidery} from './readers.js';
import {encodeJef} from './encoders/jef.js';
import {hasMovedImport, withAnchorTail} from './anchor.js';
import {encodeVp3} from './encoders/vp3.js';
import {hasLongStitch, layerCanPassThrough, sourceMatches} from './encoders/layers.js';
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
 * @typedef {{errors: string[], stitches: PlanStitch[], bounds: number[], count: number, planned?: boolean, writer?: {stitches: PlanStitch[], count: number, bounds: number[]}}} Plan
 * @typedef {{thread: string, palette?: number, items: PlanStitch[]}} JefBlock
 * @typedef {{thread: string, start: number[], items: PlanStitch[]}} Vp3Block
 */

export {
  encodeJef, encodeVp3, hasLongStitch, layerCanPassThrough, sourceMatches,
  encodePec, encodePes, encodePesV6, encodeSew, encodeTbf, encodeXxx, encodeU01, encodeExp, encodeDst,
  encodeCol, encodeEdr,
};

/** PES formats that write an imported layer's planned stitches, so the file's stitch count is the canvas count (see encode()). */
const PLANNED_PES_FORMATS = new Set(['pes', 'pes6']);
/** Formats whose moved design carries the anchor tail (see anchor.js). */
const ANCHORABLE = new Set(['jef', 'exp', 'pes', 'pes6']);

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
  // DST sews the preview's 12.1 mm split, so it takes the plan as compiled. Every other writer takes the plan before that split, so its bytes do not change.
  // An imported layer's PES file is the exception: the canvas counts the planned (split) stitches, so PES takes them too and the file holds that
  // same count. Its geometry is the DST list, which sits within 0.1 mm of the drawn lines; the PES writer's own 12.7 mm split then splits nothing.
  const usePlanned=plan.planned&&PLANNED_PES_FORMATS.has(format);
  if(format!=='dst'&&plan.writer&&!usePlanned)plan={...plan,stitches:plan.writer.stitches,count:plan.writer.count,bounds:plan.writer.bounds};
  const layers=/** @type {Layer[]} */((document?.objects||[]).filter(o=>o.visible!==false&&o.kind==='stitch_layer'));
  if(layers.length===1&&document?.objects.length===1&&layerCanPassThrough(layers[0],format)){
    const bytes=Uint8Array.from(atob(/** @type {string} */(layers[0].source.originalBytesBase64)),c=>c.charCodeAt(0));
    if(bytes.byteLength===layers[0].source.size){try{const checked=decodeEmbroidery(bytes,format);if(sourceMatches(checked,layers[0]))return bytes;}catch{}}
  }
  // A document with a moved imported layer writes its JEF, PES and EXP file with the anchor tail, so the re-import keeps every position (see anchor.js).
  const anchored=ANCHORABLE.has(format)&&hasMovedImport(document);
  const tailed=(/** @type {Uint8Array} */ bytes,/** @type {number[]} */ lead=[])=>(anchored?withAnchorTail(bytes,lead):bytes);
  if(format==='jef')return tailed(encodeJef(plan,color,hoop));if(format==='dst')return encodeDst(plan,document?.name||'Welcome');
    if(format==='exp')return tailed(encodeExp(plan),[0x80,0xF0]);if(format==='pec')return encodePec(plan,document?.name||'Welcome');
    if(format==='pes')return tailed(encodePes(plan,document?.name||'Welcome'));if(format==='pes6')return tailed(encodePesV6(plan,document?.name||'Welcome'));
    if(format==='sew')return encodeSew(plan);if(format==='u01')return encodeU01(plan);if(format==='xxx')return encodeXxx(plan);
    if(format==='tbf')return encodeTbf(plan,document?.name||'Welcome');if(format==='col')return encodeCol(plan);if(format==='edr')return encodeEdr(plan);
    return encodeVp3(plan,color);
}

