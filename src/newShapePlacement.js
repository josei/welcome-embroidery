// @ts-check
// Where a newly added rectangle or ellipse goes. Placement rule: the first shape sits at the hoop centre, as before.
// Each further shape takes the nearest free slot on a grid around the centre, stepping by its own size plus a 4 mm gap
// (so the slots are 28 mm apart horizontally and 20 mm vertically for the 24 × 16 mm default). Slots are tried in order of
// their grid distance from the centre, ties broken left before right and up before down, and a slot counts as free when
// its bounds do not touch any existing object's bounds and it lies inside the hoop. When no free slot exists, the shape
// goes back at the centre and `overlaps` is true so the toast can say so.
// When a `view` is given (the part of the canvas the finger can see, in mm), a slot must also lie inside it, and the fallback
// is the centre of the visible part of the hoop. A phone sheet covers the canvas, so a shape added under it must land above it.
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
 * @param {{x0: number, y0: number, x1: number, y1: number}} [view] the visible part of the canvas in mm; defaults to the whole hoop
 * @returns {Spot}
 */
export function newShapeSpot(objects, hoop, w, h, view){
  const taken=objects.map(o=>objectBounds(o));
  const stepX=w+GAP, stepY=h+GAP;
  const hoopBox=[-hoop.w/2,-hoop.h/2,hoop.w/2,hoop.h/2];
  const area=view?[Math.max(hoopBox[0],view.x0),Math.max(hoopBox[1],view.y0),Math.min(hoopBox[2],view.x1),Math.min(hoopBox[3],view.y1)]:hoopBox;
  // The grid is centred on the area, so the first slot is at its middle (the hoop's centre when there is no view).
  const cx0=(area[0]+area[2])/2-w/2, cy0=(area[1]+area[3])/2-h/2;
  /** @type {Array<[number, number, number]>} */
  const slots=[];
  for(let i=-MAX_STEPS;i<=MAX_STEPS;i++)for(let j=-MAX_STEPS;j<=MAX_STEPS;j++)slots.push([i,j,Math.abs(i)+Math.abs(j)]);
  slots.sort((a,b)=>a[2]-b[2]||a[0]-b[0]||a[1]-b[1]);
  for(const [i,j] of slots){
    const x=cx0+i*stepX, y=cy0+j*stepY;
    const box=[x,y,x+w,y+h];
    const inside=box[0]>=area[0]&&box[1]>=area[1]&&box[2]<=area[2]&&box[3]<=area[3];
    if(inside&&!taken.some(b=>touches(box,b)))return {x,y,overlaps:false};
  }
  return {x:clampInto(area[0],area[2],w,(area[0]+area[2])/2), y:clampInto(area[1],area[3],h,(area[1]+area[3])/2), overlaps:true};
}

/**
 * The start of a `size`-long span centred on `centre` that stays within [lo, hi] where it can; when the span is longer than the
 * range it starts at `lo`.
 * @param {number} lo
 * @param {number} hi
 * @param {number} size
 * @param {number} centre
 */
const clampInto=(lo,hi,size,centre)=>Math.max(lo,Math.min(centre-size/2,hi-size));
