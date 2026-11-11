// @ts-check
// Checks that an imported stitch layer still matches the source bytes kept with it.

/** @typedef {import('../encoders.js').PlanStitch} PlanStitch */

import {isLongStitch} from './shared.js';

/**
 * @param {{kind: string, x: number, y: number, w: number, h: number, rotation?: number, thread?: string, threadOverrides: object, source: {format: string,
  * originalBytesBase64?: string|null, defaultThread: string, defaultPlacement: {x: number, y: number, w: number, h: number}}}} o
 * @param {string} format
 * @returns {boolean}
 */
export function layerCanPassThrough(o,format){const p=o.source.defaultPlacement;
  return Boolean(o.kind==='stitch_layer'&&o.source.format===format&&o.source.originalBytesBase64&&o.x===p.x&&o.y===p.y&&o.w===p.w&&o.h===p.h&&(o.rotation||0)===
  0&&o.thread===o.source.defaultThread&&Object.keys(o.threadOverrides).length===0);}
/**
 * @param {{bounds: number[], threads: unknown, stitches: Array<{x: number, y: number, cmd: string, thread: unknown}>}} decoded
 * @param {{source: {bounds: number[]}, threads: unknown, stitches: Array<{x: number, y: number, cmd: string, thread: unknown}>}} o
 * @returns {boolean}
 */
export function sourceMatches(decoded,o){
  if(JSON.stringify(decoded.bounds)!==JSON.stringify(o.source.bounds)||JSON.stringify(decoded.threads)!==JSON.stringify(o.threads)||decoded.stitches.length!==
  o.stitches.length)return false;
  for(let i=0;i<decoded.stitches.length;i++){const a=decoded.stitches[i],b=o.stitches[i];
  if(a.x!==b.x||a.y!==b.y||a.cmd!==b.cmd||a.thread!==b.thread)return false;}return true;}
/**
 * True when a plan holds a stop. VP3 has no stop command: the reader never produces one, and writing it as a colour block would change the colour-change count.
 * @param {PlanStitch[]} stitches
 * @returns {boolean}
 */
export function vp3LayerHasStop(stitches){return stitches.some(p=>p.cmd==='stop');}
/**
 * True when an imported layer has a non-jump move longer than the writer for its format can emit in one stitch. Such a file is re-encoded, not passed through.
 * @param {Array<{x: number, y: number, cmd: string}>} stitches
 * @param {import('./shared.js').StitchRule} [rule]
 * @returns {boolean}
 */
export function hasLongStitch(stitches,rule){
  let prev=null;
  for(const s of stitches){if(isLongStitch(prev,s,rule))return true;if(s.cmd!=='end')prev=s;}
  return false;}
