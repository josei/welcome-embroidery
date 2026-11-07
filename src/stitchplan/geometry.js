// @ts-check
// Geometry helpers for the stitch planners: point lists, rings, and inset outlines.

/** @typedef {import('../stitchplan.js').Pt} Pt */
/** @typedef {import('../stitchplan.js').Run} Run */
/** @typedef {import('../stitchplan.js').Best} Best */

import {polygonClipping, bufferSegments, closedRing, openRing, rdp} from '../geom.js';

/**
 * The last item of a non-empty list.
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
export const last=list=>
/** @type {T} */(list.at(-1));

/** @type {(a: Pt, b: Pt) => number} */
export const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

// Points along a polyline no further apart than maxLen (original vertices are kept).
/**
 * @param {Pt[]} pts
 * @param {number} [maxLen]
 * @returns {Pt[]}
 */
export function sampleRun(pts,maxLen=2.5){
  /** @type {Pt[]} */
  const out=[];
    for(const p of pts){if(!out.length){out.push([p[0],p[1]]);continue;}const a=last(out),d=dist(a,p);if(d<1e-6)continue;const n=
    Math.max(1,Math.ceil(d/maxLen-1e-9));for(let k=1;k<=n;k++)out.push([a[0]+(p[0]-a[0])*k/n,a[1]+(p[1]-a[1])*k/n]);}
  return out;
}

// ---- outline travel -----------------------------------------------------------------------------------------
/**
 * @param {Pt[][]} rings
 */
export function buildBoundary(rings){
  const rs=
    rings.map(r=>
    {const pts=openRing(r),cum=[0];for(let i=1;i<=pts.length;i++)cum.push(cum[i-1]+dist(pts[i-1],pts[i%pts.length]));return {pts,cum,len:last(cum)};}).filter(
    r=>r.len>0);
  /**
   * @param {Pt} p
   * @returns {Best|null}
   */
  function locate(p){
    /** @type {Best|null} */
    let best=null;
      rs.forEach((r,ri)=>
      {const n=r.pts.length;
      for(let i=0;i<n;i++){const a=r.pts[i],b=r.pts[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?
      Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0,d=Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);if(!best||d<best.d)best=
      {ring:ri,d,s:r.cum[i]+Math.sqrt(l2)*t,i};}});return best;}
  // Shorter way round the ring from a to b, as vertices strictly between plus b itself; null when they are on different rings or too far.
  /**
   * @param {Pt} a
   * @param {Pt} b
   * @param {number} maxLen
   * @param {number} [tol]
   * @returns {Pt[]|null}
   */
  function walk(a,b,maxLen,tol=.3){const la=locate(a),lb=locate(b);if(!la||!lb||la.d>tol||lb.d>tol||la.ring!==lb.ring)return null;const r=rs[la.ring],L=r.len,
    fwd=((lb.s-la.s)%L+L)%L,back=L-fwd,forward=fwd<=back,d=Math.min(fwd,back);if(d>maxLen)return null;
    /** @type {Pt[]} */ const out=[];const n=r.pts.length;
      if(forward){
      for(let k=1;k<=n;k++){const idx=(la.i+k)%n,s=r.cum[idx],ds=((s-la.s)%L+L)%L;if(ds>1e-6&&ds<fwd-1e-6)out.push(r.pts[idx]);else if(ds>=fwd-1e-6)break;}}
    else{
      for(let k=0;k<n;k++){const idx=((la.i-k)%n+n)%n,s=r.cum[idx],ds=((la.s-s)%L+L)%L;if(ds>1e-6&&ds<back-1e-6)out.push(r.pts[idx]);
      else if(ds>=back-1e-6)break;}}
    return [...out,b];}
  return {walk,locate,rings:rs};
}

/** @type {(k: number) => number} */
// (a,b) => true when the straight line between two points stays inside the shape (even-odd over all rings).
/**
 * @param {Pt[][]} rings
 * @returns {(a: Pt, b: Pt) => boolean}
 */
export function makeInside(rings){const closed=rings.map(closedRing).filter(r=>r.length>=4);
  /** @type {(p: Pt) => boolean} */
  const pointIn=p=>
    {let inside=false;
    for(const ring of closed)for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;};return (a,b)=>
    {const n=Math.max(2,Math.ceil(dist(a,b)/.4));
    for(let i=0;i<=n;i++){const t=i/n;if(!pointIn([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]))return false;}return true;};}
// ---- underlay -----------------------------------------------------------------------------------------------
// Rings of the shape shrunk by `inset` mm (holes grow). Returns closed rings, or null when the shape is too small for the inset.
// Rings are outlines and holes by nesting depth (even-odd); disjoint outlines, such as the strips of a blend, are separate polygons.
/**
 * @param {Pt[][]} rings
 * @returns {Pt[][][]}
 */
function nestPolygons(rings){
  const depth=rings.map((r,i)=>rings.reduce((n,s,j)=>n+(j!==i&&pointInRings([s],r[0])?1:0),0));
  /** @type {Pt[][][]} */ const polys=[];
  /** @type {Map<number, number>} */ const owner=new Map();
  rings.forEach((r,i)=>{if(depth[i]%2===0){owner.set(i,polys.length);polys.push([openRing(r)]);}});
  rings.forEach((r,i)=>
    {if(depth[i]%2===0)return;let best=-1,area=Infinity;
    rings.forEach((s,j)=>{const a=Math.abs(signedArea(s));if(j!==i&&depth[j]===depth[i]-1&&a<area&&pointInRings([s],r[0])){area=a;best=j;}});if(best>=0)polys[
  /** @type {number} */(owner.get(best))].push(openRing(r));});
  return polys;
}
/**
 * @param {Pt[][]} rings
 * @param {number} inset
 * @returns {Pt[][]|null}
 */
export function insetRings(rings,inset){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length||inset<=0)return closed.length?closed:null;
  // underlay does not need the exact outline: simplify first (0.1 mm) and use coarse circles, which makes the clipping several times faster
  try{const simple=closed.map(r=>{const o=openRing(r),q=rdp([...o,o[0]],.1);return closedRing(q.length>=4?q.slice(0,-1):o);}),poly=nestPolygons(simple),grown=
    bufferSegments(simple,inset,800,10),res=polygonClipping.difference(poly,...grown);const out=[];
    for(const polygon of res)for(const ring of polygon)out.push(ring);return out.length?out:null;}catch{return null;}
}
/**
 * @param {Pt[][]} closed
 * @param {Pt} p
 * @returns {boolean}
 */
export const pointInRings=(closed,p)=>
  {let inside=false;
  for(const ring of closed)for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
/** @type {(r: Pt[]) => number} */
export const ringLength=r=>{let L=0;for(let i=0;i<r.length;i++)L+=dist(r[i],r[(i+1)%r.length]);return L;};
/** @type {(r: Pt[]) => number} */
export const signedArea=r=>{let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
/**
 * @param {Pt[]} r
 * @param {Pt} p
 * @returns {number}
 */
export function nearestOnRing(r,p){let best=Infinity;
  for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?
  Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;best=Math.min(best,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t));}return best;}
// M points spaced evenly along a closed ring, starting at the ring vertex nearest to `near`.
/**
 * @param {Pt[]} r
 * @param {number} M
 * @param {Pt|null|undefined} near
 * @returns {Pt[]}
 */
export function resampleRing(r,M,near){
  const n=r.length,cum=[0];for(let i=0;i<n;i++)cum.push(cum[i]+dist(r[i],r[(i+1)%n]));const L=cum[n];let s0=0,bd=Infinity;
    if(near)r.forEach((p,i)=>{const d=dist(p,near);if(d<bd){bd=d;s0=cum[i];}});
  /** @type {Pt[]} */ const out=[];let seg=0;
    for(let m=0;m<M;m++){const s=(s0+L*m/M)%L;seg=0;while(seg<n-1&&cum[seg+1]<=s)seg++;const a=r[seg],b=r[(seg+1)%n],f=(s-cum[seg])/((cum[seg+1]-cum[seg])||1);
    out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}
  return out;
}
// Points along a dense polyline every `len` mm (the last point is kept).
/**
 * @param {Pt[]} pts
 * @param {number} len
 * @returns {Pt[]}
 */
export function respace(pts,len){const out=[pts[0]];let acc=0;
  for(let i=1;i<pts.length;i++){const d=dist(pts[i-1],pts[i]);acc+=d;if(acc>=len){out.push(pts[i]);acc=0;}}if(dist(last(out),last(pts))>1e-6)out.push(
  last(pts));return out;}
// Points along a straight line from a to b, at most maxLen apart, not including a.
/**
 * @param {Pt} a
 * @param {Pt} b
 * @param {number} [maxLen]
 * @returns {Pt[]}
 */
export function sampleLine(a,b,maxLen=2.5){const dist=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(dist/maxLen));
  /** @type {Pt[]} */
  const o=[];for(let i=1;i<=n;i++)o.push(/** @type {Pt} */([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]));return o;}

