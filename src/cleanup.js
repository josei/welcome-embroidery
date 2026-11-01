// @ts-check
// Small-area cleanup: holes under a size limit are removed from closed paths, and tiny closed shapes are deleted as whole objects.
// The engine's document operations call these; it re-exports the names callers use.
import {geometry} from './outlines.js';
import {objById} from './transforms.js';
import {shapeArea} from './designChecks.js';
import {isClosedShape} from './shapeOps.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {import('./transforms.js').Obj & {[key: string]: any}} Item */
/** @typedef {{objects: Item[]}} Doc */

// Area of a hole ring (shoelace formula), in mm².
/** @type {(h: Pt[]) => number} */
const holeArea=h=>{let a=0;for(let i=0;i<h.length;i++){const p=h[i],q=h[(i+1)%h.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a/2);};
// How many of a path's holes are under 1 mm² (the ones remove_small_holes drops).
/**
 * @param {Item|null|undefined} o
 * @param {number} [maxArea]
 * @returns {number}
 */
export function countSmallHoles(o,maxArea=1){return (/** @type {Pt[][]} */(o?.holes||[])).filter(h=>holeArea(h)<maxArea).length;}
/**
 * @param {Doc} doc
 * @param {string[]} ids
 * @param {number} [maxArea]
 * @returns {void}
 */
export function removeSmallHoles(doc,ids,maxArea=1){if(!Array.isArray(ids)||!ids.length)throw Error('Remove small holes needs the closed paths to clean.');if(!(Number.isFinite(maxArea)&&maxArea>=.1&&maxArea<=20))throw Error('The hole limit must be 0.1 to 20 mm².');for(const id of ids){const o=/** @type {Item} */(objById(doc,id));if(!(o.kind==='path'&&o.closed===true))throw Error('Remove small holes works on closed paths.');if(!o.holes)continue;const kept=(/** @type {Pt[][]} */(o.holes)).filter(h=>holeArea(h)>=maxArea);if(kept.length)o.holes=kept;else delete o.holes;}}
// Remove small islands: a closed shape whose area (its outline less its holes) is under the island limit is deleted as a whole object. Boolean and knife results already come out as separate objects, so this clears the tiny pieces they leave.
/**
 * @param {Item|null|undefined} o
 * @param {number} [maxArea]
 * @returns {boolean}
 */
export function isSmallIsland(o,maxArea=1){return isClosedShape(o)&&shapeArea(geometry(/** @type {Item} */(o),0))<maxArea;}
/**
 * @param {Doc} doc
 * @param {string[]} ids
 * @param {number} [maxArea]
 * @returns {void}
 */
export function removeSmallIslands(doc,ids,maxArea=1){if(!Array.isArray(ids)||!ids.length)throw Error('Remove small islands needs the closed shapes to check.');if(!(Number.isFinite(maxArea)&&maxArea>=.1&&maxArea<=20))throw Error('The island limit must be 0.1 to 20 mm².');for(const id of ids)if(!isClosedShape(objById(doc,id)))throw Error('Remove small islands works on closed shapes.');const drop=new Set(ids.filter(id=>isSmallIsland(objById(doc,id),maxArea)));for(let i=doc.objects.length-1;i>=0;i--)if(drop.has(doc.objects[i].id))doc.objects.splice(i,1);}
