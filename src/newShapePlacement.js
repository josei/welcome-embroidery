// @ts-check
// Where a newly added rectangle or ellipse goes. Placement rule (issue #280): the first shape sits at the hoop centre, as before.
// Each further shape takes the nearest free slot on a grid around the centre, stepping by its own size plus a 4 mm gap
// (so the slots are 28 mm apart horizontally and 20 mm vertically for the 24 × 16 mm default). Slots are tried in order of
// their grid distance from the centre, ties broken left before right and up before down, and a slot counts as free when
// its bounds do not touch any existing object's bounds and it lies inside the hoop. When no free slot exists, the shape
// goes back at the centre and `overlaps` is true so the toast can say so.
import {objectBounds} from './transforms.js';

const GAP = 4;
const MAX_STEPS = 12;

/**
 * @typedef {{x: number, y: number, overlaps: boolean}} Spot
 */

/**
 * @param {number[]} a
 * @param {number[]} b
 */
const touches=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];

/**
 * @param {any[]} objects the document's objects
 * @param {{w: number, h: number}} hoop the hoop size in mm, centred on the origin
 * @param {number} w the new shape's width in mm
 * @param {number} h the new shape's height in mm
 * @returns {Spot}
 */
export function newShapeSpot(objects, hoop, w, h){
  const taken=objects.map(o=>objectBounds(o));
  const stepX=w+GAP, stepY=h+GAP;
  /** @type {Array<[number, number, number]>} */
  const slots=[];
  for(let i=-MAX_STEPS;i<=MAX_STEPS;i++)for(let j=-MAX_STEPS;j<=MAX_STEPS;j++)slots.push([i,j,Math.abs(i)+Math.abs(j)]);
  slots.sort((a,b)=>a[2]-b[2]||a[0]-b[0]||a[1]-b[1]);
  for(const [i,j] of slots){
    const x=-w/2+i*stepX, y=-h/2+j*stepY;
    const box=[x,y,x+w,y+h];
    const inside=box[0]>=-hoop.w/2&&box[1]>=-hoop.h/2&&box[2]<=hoop.w/2&&box[3]<=hoop.h/2;
    if(inside&&!taken.some(b=>touches(box,b)))return {x,y,overlaps:false};
  }
  return {x:-w/2,y:-h/2,overlaps:true};
}
