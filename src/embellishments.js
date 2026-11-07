// @ts-check
// Embellishments: the stitch runs for motifs, sequins, beads and bling (stones), along a line or filling a shape. The engine
// imports them for its fill and satin planners.
import {sampleRun,makeInside} from './stitchplan.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {{pts: Pt[], jump: boolean}} Run */

// Motif loops: a small closed loop every few mm along the path, sewn as one run.
// A loop ring at p: a circle, or a leaf whose long axis (ux,uy) follows the path so the motif warps with the curve.
/**
 * @param {Pt} p
 * @param {number} ux
 * @param {number} uy
 * @param {number} radius
 * @param {string} shape
 * @returns {Pt[]}
 */
function loopRing(p,ux,uy,radius,shape){
  return Array.from({length:13},(_,k)=>
  {const t=k/12*Math.PI*2;if(shape!=='leaf')return /** @type {Pt} */([p[0]+Math.cos(t)*radius,p[1]+Math.sin(t)*radius]);const x=Math.cos(t)*radius*1.6,y=
  Math.sin(t)*radius*.6;return /** @type {Pt} */([p[0]+x*ux-y*uy,p[1]+x*uy+y*ux]);});
}
/**
 * @param {Pt[]} pts
 * @returns {Pt[]}
 */
export function pathDirs(pts){
  return pts.map((p,i)=>{const q=pts[Math.min(i+1,pts.length-1)],r=pts[Math.max(i-1,0)],dx=q[0]-r[0],dy=q[1]-r[1],l=Math.hypot(dx,dy)||1;return [dx/l,dy/l];});
}
// Warp 'along' shrinks the loops from the start of the path to the end (to 40% at the end), the same pseudo-depth cue as a fill.
/**
 * @param {Pt[]} line
 * @param {number} [spacing]
 * @param {number} [radius]
 * @param {string} [shape]
 * @param {string} [warp]
 * @returns {Run[]}
 */
export function motifLoops(line,spacing=4,radius=.8,shape='circle',warp='none'){const pts=sampleRun(line,spacing),dirs=pathDirs(pts);
return pts.map((p,i)=>({pts:loopRing(p,dirs[i][0],dirs[i][1],warp==='along'?radius*(1-.6*i/Math.max(1,pts.length-1)):radius,shape),jump:false}));
}
// Paired motif loops: a loop on each side of the centre line, half the satin width away, every few mm.
/**
 * @param {Pt[]} line
 * @param {(t: number) => number} widthOf
 * @param {number} [spacing]
 * @param {number} [radius]
 * @param {string} [shape]
 * @param {string} [warp]
 * @returns {Run[]}
 */
export function motifPairLoops(line,widthOf,spacing=4,radius=.8,shape='circle',warp='none'){const pts=sampleRun(line,spacing);
/** @type {Run[]} */ const loops=[];
pts.forEach((p,i)=>
  {const q=pts[Math.min(i+1,pts.length-1)],r=pts[Math.max(i-1,0)],dx=q[0]-r[0],dy=q[1]-r[1],l=Math.hypot(dx,dy)||1,width=widthOf(i/Math.max(1,pts.length-1)),
  nx=-dy/l*width/2,ny=dx/l*width/2,rad=warp==='along'?radius*(1-.6*i/Math.max(1,pts.length-1)):radius;
  for(const s of [1,-1])loops.push({pts:loopRing([p[0]+s*nx,p[1]+s*ny],dx/l,dy/l,rad,shape),jump:false});});
return loops;
}
// Motif fill: one small loop on a staggered grid inside the shape, every row offset by half a spacing.
// Warp 'x' or 'y' shrinks the loops from the low to the high edge of the shape (to 40% at the far edge), a cheap pseudo-depth cue, not a surface.
/**
 * @param {Pt[][]} rings
 * @param {number} spacing
 * @param {number} [radius]
 * @param {string} [warp]
 * @param {boolean} [centre]
 * @returns {Run[]}
 */
export function motifFillRuns(rings,spacing,radius=.8,warp='none',centre=false){const inside=makeInside(rings);
let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
for(const r of rings)for(const [x,y] of r){x0=Math.min(x0,x);
y0=Math.min(y0,y);
x1=Math.max(x1,x);
y1=Math.max(y1,y);
}
/** @type {Run[]} */ const out=[];
let row=0;
for(let y=y0+spacing/2;y<=y1;y+=spacing,row++)for(let x=x0+(row%2?spacing/2:0);x<=x1;x+=spacing)if(inside([x,y],[x+.01,y])){const t=warp===
  'x'?(x-x0)/((x1-x0)||1):warp==='y'?(y-y0)/((y1-y0)||1):0,r=radius*(1-.6*t);
if(centre)out.push({pts:[[x,y],[x+.01,y]],jump:false});
out.push({pts:Array.from({length:13},(_,k)=>{const a=k/12*Math.PI*2;return [x+Math.cos(a)*r,y+Math.sin(a)*r];}),jump:false});
}return out;
}
// Sequins: a centre stitch with a fixing loop around it, every few mm along the path.
// Twin sequins: two side by side across the path, one either side of the centre line, centres a sequin's width apart so they touch.
/**
 * @param {Pt[]} line
 * @param {number} [spacing]
 * @param {number} [radius]
 * @param {boolean} [twin]
 * @returns {Run[]}
 */
export function sequinRuns(line,spacing=8,radius=1.5,twin=false){const pts=sampleRun(line,spacing),dirs=pathDirs(pts);
/** @type {Run[]} */ const out=[];
pts.forEach((p,i)=>
  {const [ux,uy]=dirs[i],centres=twin?[/** @type {Pt} */([p[0]-uy*radius,p[1]+ux*radius]),/** @type {Pt} */([p[0]+uy*radius,p[1]-ux*radius])]:[p];
  for(const c of centres)out.push({pts:[c,/** @type {Pt} */([c[0]+.01,c[1]])],jump:false},
  {pts:Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;return /** @type {Pt} */([c[0]+Math.cos(t)*radius,c[1]+Math.sin(t)*radius]);}),jump:false});});
return out;
}
// Beads: one short pass across the path at each point, the way a bead is sewn on (a pass repeated over the same line adds stitches, not beads).
/**
 * @param {Pt[]} line
 * @param {number} [spacing]
 * @param {number} [length]
 * @param {string} [shape]
 * @param {boolean} [twin]
 * @returns {Run[]}
 */
export function beadRuns(line,spacing=6,length=2,shape='dash',twin=false){const pts=sampleRun(line,spacing);
/** @type {Run[]} */ const out=[];
pts.forEach((p,i)=>
  {const q=pts[Math.min(i+1,pts.length-1)],r=pts[Math.max(i-1,0)],dx=q[0]-r[0],dy=q[1]-r[1],l=Math.hypot(dx,dy)||1,tx=dx/l,ty=dy/l,nx=-ty,ny=tx;
  for(const o of twin?[-length/2,length/2]:[0]){const c=[p[0]+nx*o,p[1]+ny*o];
  if(shape==='dot')out.push(
  {pts:Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;return [c[0]+Math.cos(t)*length/2,c[1]+Math.sin(t)*length/2];}),jump:false});
  else out.push({pts:[[c[0]-tx*length/2,c[1]-ty*length/2],[c[0]+tx*length/2,c[1]+ty*length/2]],jump:false});}});
return out;
}
// Bling: a stone at each point, a centre stitch with two concentric fixing rings (round, or square of the same width: size is the stone's width).
// One bling stone at p in frame f (a stone is an outline; fixings 2 adds the inner fixing ring at two-thirds size). ovalF is the frame for oval and heart
// stones, which always follow the path.
/**
 * @param {Pt} p
 * @param {Pt} f
 * @param {string} shape
 * @param {number} size
 * @param {number} [fixings]
 * @param {Pt} [ovalF]
 * @returns {Run[]}
 */
function blingStones(p,f,shape,size,fixings=2,ovalF=f){
/** @type {(p: Pt, f: Pt, lx: number, ly: number) => Pt} */
const at=(p,[ux,uy],lx,ly)=>[p[0]+lx*ux-ly*uy,p[1]+lx*uy+ly*ux];
/** @type {(p: Pt, r: number) => Run} */
const ring=(p,r)=>({pts:Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;return [p[0]+Math.cos(t)*r,p[1]+Math.sin(t)*r];}),jump:false});
/** @type {(p: Pt, f: Pt, verts: Pt[]) => Run} */
const poly=(p,f,verts)=>({pts:[...verts,verts[0]].map(([x,y])=>at(p,f,x,y)),jump:false});
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const square=(p,f,s)=>{const h=s/2;
return poly(p,f,[[-h,-h],[h,-h],[h,h],[-h,h]]);
};
/** @type {(s: number) => Pt[]} */
const hexVerts=s=>Array.from({length:6},(_,k)=>{const t=k/6*Math.PI*2;return [Math.cos(t)*s/2,Math.sin(t)*s/2];});
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const heart=(p,f,s)=>(
  {pts:
  Array.from({length:21},(_,k)=>
  {const t=k/20*Math.PI*2,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t),u=s/32;return at(p,f,-(y+2.5)*u,x*u);}),jump:
  false});
// Teardrop: a circle with its tangents meeting at a point ahead of it, which follows the path like the heart. Baguette: a long rectangle with chamfered ends,
// turned like the square.
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const drop=(p,f,s)=>
  {const r=s/3,d=s*.8,b=Math.acos(r/d),N=16,arc=
  Array.from({length:N+1},(_,k)=>{const psi=Math.PI+b+(2*Math.PI-2*b)*k/N;return [r*Math.sin(psi),r*Math.cos(psi)];});
return {pts:[...arc,[0,-d],arc[0]].map(([u,v])=>at(p,f,-v,u)),jump:false};
};
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const baguette=(p,f,s)=>{const L=s,W=s/2.4,c=W/3;
return poly(p,f,[[-L/2,-W/2+c],[-L/2+c,-W/2],[L/2-c,-W/2],[L/2,-W/2+c],[L/2,W/2-c],[L/2-c,W/2],[-L/2+c,W/2],[-L/2,W/2-c]]);
};
// Marquise: a pointed oval. The half-width along the long axis is b(1-u^2)^0.6, which meets zero with a vertical tangent at each end, so both ends come to a
// point. Turns with the path, like the square.
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const marquise=(p,f,s)=>{const N=12;
/** @type {Pt[]} */ const top=[];
/** @type {Pt[]} */ const bottom=[];
for(let k=0;k<=N;k++){const u=-1+2*k/N,h=(s/3)*(1-u*u)**0.6;
top.push([s/2*u,h]);
bottom.push([s/2*u,-h]);
}return poly(p,f,[...top,...bottom.reverse()]);
};
// Pear: one end is the marquise's pointed end (u below 0), the other a round end with half-width b*sqrt(1-u^2). The two halves meet at the middle, where both
// give b. Turns with the path, like the marquise.
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const pear=(p,f,s)=>{const N=12;
/** @type {Pt[]} */ const top=[];
/** @type {Pt[]} */ const bottom=[];
for(let k=0;k<=N;k++){const u=-1+2*k/N,h=(s/3)*(u<=0?(1-u*u)**0.6:Math.sqrt(1-u*u));
top.push([s/2*u,h]);
bottom.push([s/2*u,-h]);
}return poly(p,f,[...top,...bottom.reverse()]);
};
// Cushion: a superellipse with exponent 4 (x = h·sgn(cos t)·|cos t|^0.5, y likewise with sin t), so its corners are rounded and its sides bulge slightly, and
// it is s across on each axis. Turns with the path, like the square.
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const cushion=(p,f,s)=>{const N=48;
/** @type {Pt[]} */ const verts=[];
for(let k=0;k<N;k++){const t=k/N*Math.PI*2,c=Math.cos(t),sn=Math.sin(t);
verts.push([Math.sign(c)*Math.abs(c)**0.5*s/2,Math.sign(sn)*Math.abs(sn)**0.5*s/2]);
}return poly(p,f,verts);
};
/** @type {(s: number) => Pt[]} */
const starVerts=s=>Array.from({length:10},(_,k)=>{const t=k/10*Math.PI*2,R=k%2?s/4:s/2;return [Math.cos(t)*R,Math.sin(t)*R];});
/** @type {(p: Pt, f: Pt, s: number) => Run} */
const oval=(p,f,s)=>({pts:Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;return at(p,f,Math.cos(t)*s/2,Math.sin(t)*s/3);}),jump:false});
/** @type {(sz: number) => Run} */
const stone=sz=>shape==='square'?square(p,f,sz):shape==='oval'?oval(p,ovalF,sz):shape==='hexagon'?poly(p,f,hexVerts(sz)):shape==='star'?poly(p,f,starVerts(sz)):
  shape==='heart'?heart(p,ovalF,sz):shape==='teardrop'?drop(p,ovalF,sz):shape==='baguette'?baguette(p,f,sz):shape==='marquise'?marquise(p,f,sz):shape==='pear'?
  pear(p,f,sz):shape==='cushion'?cushion(p,f,sz):ring(p,sz/2);
return fixings===2?[stone(size),stone(size*2/3)]:[stone(size)];
}
/**
 * @param {Pt[]} line
 * @param {number} [spacing]
 * @param {number} [size]
 * @param {string} [shape]
 * @param {boolean} [turn]
 * @param {number} [rings]
 * @returns {Run[]}
 */
export function blingRuns(line,spacing=8,size=4,shape='round',turn=true,rings=2){const pts=sampleRun(line,spacing),dirs=pathDirs(pts);
return pts.flatMap((p,i)=>
  {const f=turn?dirs[i]:/** @type {Pt} */([1,0]);return [{pts:[p,/** @type {Pt} */([p[0]+.01,p[1]])],jump:false},...blingStones(p,f,shape,size,rings,f)];});
}
// Bling fill: stones on the sequin fill's staggered grid inside a closed shape, every row offset by half a spacing, in a fixed orientation.
/**
 * @param {Pt[][]} rings
 * @param {number} [spacing]
 * @param {number} [size]
 * @param {string} [shape]
 * @param {number} [fixings]
 * @returns {Run[]}
 */
export function blingFillRuns(rings,spacing=8,size=4,shape='round',fixings=2){const inside=makeInside(rings);
let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
for(const r of rings)for(const [x,y] of r){x0=Math.min(x0,x);
y0=Math.min(y0,y);
x1=Math.max(x1,x);
y1=Math.max(y1,y);
}
/** @type {Run[]} */ const out=[];
let row=0;
for(let y=y0+spacing/2;y<=y1;y+=spacing,row++)for(let x=x0+(row%2?spacing/2:0);x<=x1;x+=spacing)if(inside([x,y],[x+.01,y]))out.push(
  {pts:[[x,y],[x+.01,y]],jump:false},...blingStones([x,y],[1,0],shape,size,fixings));
return out;
}
