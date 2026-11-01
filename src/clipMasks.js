// @ts-check
// Clipping masks: a clipped object is sewn only inside its mask, and the links are cleaned up after every edit.
// The engine's compile step and document refresh call these; it re-exports nothing.
import {polygonClipping} from './geom.js';
import {closeRing} from './stitchRuns.js';
import {isClosedShape} from './shapeOps.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {import('./transforms.js').Obj & {[key: string]: any}} Item */
/** @typedef {{objects: Item[]}} Doc */

// Clipping masks: a clipped object is sewn only inside its mask (a closed shape that is itself not sewn). Dangling links are cleaned up after every edit.
/**
 * @param {Pt[][]} lines
 * @param {Pt[][]} maskLines
 * @returns {Pt[][]}
 */
export function clipLines(lines,maskLines){
  /** @type {(ls: Pt[][]) => Pt[][]} */
  const poly=ls=>ls.filter(l=>l.length>=3).map(closeRing);
  const a=poly(lines),b=poly(maskLines);if(!a.length||!b.length)return [];
  try{return polygonClipping.intersection(a,b).flatMap(pg=>pg.map(r=>r.map(([x,y])=>/** @type {Pt} */([x,y]))));}catch{return [];}}
/**
 * @param {Doc} doc
 * @returns {void}
 */
export function refreshClips(doc){const ids=new Set(doc.objects.map(o=>o.id));for(const o of doc.objects)if(o.clipId&&(!ids.has(o.clipId)||o.clipId===o.id||!isClosedShape(doc.objects.find(v=>v.id===o.clipId))))delete o.clipId;const used=new Set(doc.objects.map(o=>o.clipId).filter(Boolean));for(const o of doc.objects){if(o.mask&&!used.has(o.id))delete o.mask;else if(!o.mask&&used.has(o.id))o.mask=true;}}
