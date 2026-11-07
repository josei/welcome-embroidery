// @ts-check
// Per-object stitch runs: the fill, satin and clipping passes that turn a shape's settings into needle runs, with the rails and
// the underlay choice. The engine imports them for its compile step and re-exports satinFromRails.
import {planFill,planContour,planFillUnderlay,planContourFill,planSpiralFill,planGuidedFill,planMeanderFill,planCrossStitch,planRippleFill,planPhoto,chainRuns,
  makeInside} from './stitchplan.js';
import {insetRings,sampleRun} from './stitchplan.js';
import {polygonClipping,closedRing} from './geom.js';
import {distP,pathOutline} from './pathGeometry.js';
import {motifFillRuns} from './embellishments.js';
import {blingFillRuns} from './embellishments.js';
import {objectBounds} from './transforms.js';
import {shapeArea} from './designChecks.js';

/** @typedef {import('./geom.js').Pt} Pt */
/**
 * The stitch settings a shape can carry, beside its geometry.
 * @typedef {{kind?: string, fillMethod?: string, angle?: number, spacing?: number, stitchLength?: number, stagger?: number, lengthVariance?: number,
  * underpath?: boolean, underlayType?: string, underlayInset?: number, underlaySpacing?: number, raised?: boolean, raisedSpacing?: number, raisedAngle?:
  * number, laydownSpacing?: number, blendThread?: string, blendPalette?: string[], blendStart?: number, blendEnd?: number, blendAngle?: number, startAt?: Pt,
  * endAt?: Pt, underlay?: boolean, endInset?: number, endInsetStart?: number, endInsetEnd?: number, guide?: Pt[], rippleCenter?: Pt, accordionStart?: number,
  * accordionEnd?: number, accordionEase?: string, motifSpacing?: number, motifSize?: number, motifWarp?: string, blingShape?: string, blingRings?: number,
  * crossSize?: number, pullRight?: number, pullLeft?: number}} Settings
 */
/** @typedef {import('./transforms.js').Obj & Settings} Item */
/** @typedef {{pts: Pt[], jump?: boolean, loop?: boolean}} Run */
/** @typedef {{objects: Item[], settings: Settings}} Design */
// Geometry clipping to a mask: closed outlines are intersected exactly; runs of stitches are cut where they leave the mask.
/** @type {(r: Pt[]) => Pt[]} */
export const closeRing=r=>{const q=r.map(([x,y])=>/** @type {Pt} */([x,y]));
if(q.length&&(q[0][0]!==q[q.length-1][0]||q[0][1]!==q[q.length-1][1]))q.push([...q[0]]);
return q;
};
/**
 * @param {Pt[][]} rings
 * @param {Pt} p
 * @returns {boolean}
 */
export function insideRings(rings,p){let inside=false;
for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];
if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;
}return inside;
}
// edgeClose: each cut end gets a short back-stitch over its last segment, so a cut run closes on the mask edge.
/**
 * @param {Run[]} runs
 * @param {Pt[][]} rings
 * @param {boolean} [edgeClose]
 * @returns {Run[]}
 */
export function clipRuns(runs,rings,edgeClose=false){
/** @type {Array<[Pt, Pt]>} */ const edges=[];
for(const r of rings)for(let i=1;i<r.length;i++)edges.push([r[i-1],r[i]]);
/** @type {Run[]} */ const out=[];
for(const run of runs){
/** @type {Pt[]|null} */ let cur=null;let first=true;
/** @type {() => void} */
const flush=()=>{if(cur&&cur.length>1){const pts=edgeClose&&cur.length>2?[...cur,...cur.slice(-3,-1).reverse()]:cur;
out.push({...run,pts,jump:first?run.jump:true});
}first=false;
cur=null;
};
const pts=run.pts;
if(pts.length<2)continue;
if(insideRings(rings,pts[0])){cur=[pts[0]];
}
for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],ts=[0,1],dx=b[0]-a[0],dy=b[1]-a[1];
for(const [c,d] of edges){const ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;
if(Math.abs(den)<1e-12)continue;
const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;
if(t>1e-9&&t<1-1e-9&&u>=0&&u<=1)ts.push(t);
}
ts.sort((x,y)=>x-y);
for(let k=1;k<ts.length;k++){const t0=ts[k-1],t1=ts[k];
if(t1-t0<1e-9)continue;
const p0=/** @type {Pt} */([a[0]+dx*t0,a[1]+dy*t0]),p1=/** @type {Pt} */([a[0]+dx*t1,a[1]+dy*t1]),mid=/** @type {Pt} */([(p0[0]+p1[0])/2,(p0[1]+p1[1])/2]);
if(insideRings(rings,mid)){if(!cur)cur=[p0];
cur.push(p1);
}else flush();
}}
flush();
}
return out;
}
// Two-rail satin: needles alternate between the rails every `spacing` mm of rail length; pull compensation widens the column.
/**
 * @param {Pt[]} a
 * @param {Pt[]} b
 * @param {number} spacing
 * @param {number} comp
 * @param {Array<[Pt, Pt]>} [rungs]
 * @param {number} [compB]
 * @returns {{zig: Pt[], centre: Pt[], pairs: Array<[Pt, Pt]>}}
 */
export function satinFromRails(a,b,spacing,comp,rungs=[],compB=comp){
/** @type {(r: Pt[]) => number[]} */
const cum=r=>{const c=[0];
for(let i=1;i<r.length;i++)c.push(c[i-1]+Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1]));
return c;
},ca=cum(a),cb=cum(b),La=ca[ca.length-1],Lb=cb[cb.length-1];
if(Math.max(La,Lb)<.2)return {zig:[],centre:[],pairs:[]};
/** @type {(r: Pt[], c: number[], t: number) => Pt} */
const at=(r,c,t)=>{let i=1;
while(i<c.length-1&&c[i]<t)i++;
const seg=c[i]-c[i-1]||1,f=Math.max(0,Math.min(1,(t-c[i-1])/seg));
return [r[i-1][0]+(r[i][0]-r[i-1][0])*f,r[i-1][1]+(r[i][1]-r[i-1][1])*f];
};
// Rungs pair a position on rail A with one on rail B; between two rungs the rails advance in proportion, so letters whose rails differ in length do not twist.
// A rung end can sit close to several parts of a rail (bends, rings), so each end keeps every plausible position and a small dynamic program picks the sequence
// that is nearest overall while advancing along the rail.
/** @type {(r: Pt[], c: number[], p: Pt) => Array<[number, number]>} */
const options=(r,c,p)=>{
/** @type {Array<[number, number]>} */ const out=[];
for(let i=1;i<r.length;i++){const dx=r[i][0]-r[i-1][0],dy=r[i][1]-r[i-1][1],l2=dx*dx+dy*dy,u=l2?
  Math.max(0,Math.min(1,((p[0]-r[i-1][0])*dx+(p[1]-r[i-1][1])*dy)/l2)):0;
out.push([c[i-1]+Math.sqrt(l2)*u,Math.hypot(p[0]-r[i-1][0]-dx*u,p[1]-r[i-1][1]-dy*u)]);
}const best=Math.min(...out.map(v=>v[1]));
const keep=out.filter(v=>v[1]<=best*1.6+.8).sort((u,v)=>u[0]-v[0]);
/** @type {Array<[number, number]>} */ const res=[];
for(const v of keep){const last=res.at(-1);
if(last&&v[0]-last[0]<.05){if(v[1]<last[1])res[res.length-1]=v;
}else res.push(v);
}return res;
};
// Rungs usually overshoot the rails, so the rail position of a rung is where the rung crosses the rail; only a rung that misses a rail falls back to the
// nearest point of that rail.
/** @type {(r: Pt[], c: number[], p: Pt, q: Pt) => Array<[number, number]>} */
const crossings=(r,c,p,q)=>{
/** @type {Array<[number, number]>} */ const out=[];const rx=q[0]-p[0],ry=q[1]-p[1];
for(let i=1;i<r.length;i++){const sx=r[i][0]-r[i-1][0],sy=r[i][1]-r[i-1][1],den=rx*sy-ry*sx;
if(Math.abs(den)<1e-9)continue;
const t=((r[i-1][0]-p[0])*sy-(r[i-1][1]-p[1])*sx)/den,u=((r[i-1][0]-p[0])*ry-(r[i-1][1]-p[1])*rx)/den;
if(t>=0&&t<=1&&u>=0&&u<=1)out.push([c[i-1]+Math.hypot(sx,sy)*u,0]);
}return out;
};
/** @type {(r: Pt[], c: number[], p: Pt, q: Pt, end: Pt) => Array<[number, number]>} */
const railOptions=(r,c,p,q,end)=>{const x=crossings(r,c,p,q);
return x.length?x:options(r,c,end);
};
/** @type {(sets: Array<Array<[number, number]>>) => number[]} */
const monotone=sets=>{const n=sets.length,cost=sets.map(s=>s.map(()=>0)),from=sets.map(s=>s.map(()=>-1));
sets[0]?.forEach((v,j)=>{cost[0][j]=v[1];});
for(let k=1;k<n;k++)sets[k].forEach((v,j)=>
  {let bestC=Infinity,bestI=-1;sets[k-1].forEach((u,i)=>{const c=cost[k-1][i]+Math.max(0,u[0]-v[0])*3;if(c<bestC){bestC=c;bestI=i;}});cost[k][j]=bestC+v[1];
  from[k][j]=bestI;});
/** @type {number[]} */ const out=Array(n);
if(!n)return out;
let j=cost[n-1].indexOf(Math.min(...cost[n-1]));
for(let k=n-1;k>=0;k--){out[k]=sets[k][j][0];
j=from[k][j];
}return out;
};
const sides=rungs.map(([p,q])=>{
/** @type {(r: Pt[], v: Pt) => number} */ const d=(r,v)=>Math.min(...r.map(w=>Math.hypot(w[0]-v[0],w[1]-v[1])));return d(a,p)+d(b,q)<=d(a,q)+d(b,p)?[p,q]:[q,p];
  });
const order=sides.map((sd,i)=>[(railOptions(a,ca,rungs[i][0],rungs[i][1],sd[0])[0]||[0])[0],i]).sort((u,v)=>u[0]-v[0]).map(v=>v[1]),ta=
  monotone(order.map(i=>railOptions(a,ca,rungs[i][0],rungs[i][1],sides[i][0]))),tb=
  monotone(order.map(i=>railOptions(b,cb,rungs[i][0],rungs[i][1],sides[i][1])));
/** @type {Array<[number, number]>} */ const anchors=[[0,0]];
order.forEach((_,k)=>anchors.push([ta[k],tb[k]]));
anchors.sort((u,v)=>u[0]-v[0]);
anchors.push([La,Lb]);
for(let i=1;i<anchors.length;i++)anchors[i][1]=Math.max(anchors[i][1],anchors[i-1][1]);
if(/** @type {any} */(globalThis).__dbgAnchors)/** @type {any} */(globalThis).__dbgAnchors(anchors,ca,cb);
/** @type {Pt[]} */ const zig=[];
/** @type {Pt[]} */ const centre=[];
/** @type {Array<[Pt, Pt]>} */ const pairs=[];
let flip=0;
for(let s=1;s<anchors.length;s++){const [a0,b0]=anchors[s-1],[a1,b1]=anchors[s],len=Math.max(a1-a0,b1-b0);
if(len<1e-6&&s<anchors.length-1)continue;
const n=Math.max(1,Math.ceil(len/spacing));
for(let k=(s===1?0:1);k<=n;k++){const f=k/n,pa=at(a,ca,a0+(a1-a0)*f),pb=at(b,cb,b0+(b1-b0)*f),dx=pa[0]-pb[0],dy=pa[1]-pb[1],l=Math.hypot(dx,dy)||1;
pairs.push([pa,pb]);
centre.push([(pa[0]+pb[0])/2,(pa[1]+pb[1])/2]);
zig.push(flip++%2?[pb[0]-dx/l*compB,pb[1]-dy/l*compB]:[pa[0]+dx/l*comp,pa[1]+dy/l*comp]);
}}
return {zig,centre,pairs};
}
/**
 * @param {Item} o
 * @param {Design} doc
 * @param {string} kind
 * @param {number} metric
 * @returns {Set<string>}
 */
export function underlayTypes(o,doc,kind,metric){
let t=o.underlayType;
if(t===undefined)t=doc.settings.underlay===false?'none':(doc.settings.underlayType??'auto');
const set=t==='none'?new Set():t==='auto'?
  new Set(kind==='fill'?(metric>=40?['contour','fill']:['contour']):(metric<2?['center']:metric<4.5?['contour']:['contour','zigzag'])):
  new Set(String(t).split('+').filter(x=>(kind==='fill'?['contour','fill','laydown']:['center','contour','zigzag']).includes(x)));
if(o.raised&&kind==='satin')for(const x of ['center','zigzag'])set.add(x);
return set;
}
// Open runs start at their nearer end; closed rings (contour underlay) are rotated to start at their point nearest to the needle.
/** @type {(runs: Run[], from: Pt|null, rotateLoops?: boolean) => Run[]} */
export const orientRuns=(runs,from,rotateLoops=false)=>{let cur=from;
return runs.map(r=>
  {let pts=r.pts;
  if(cur&&rotateLoops&&r.loop&&pts.length>3){let k=0,best=Infinity;pts.forEach((p,i)=>{const d=distP(/** @type {Pt} */(cur),p);if(d<best){best=d;k=i;}});
  pts=[...pts.slice(k),...pts.slice(0,k)];}else if(cur&&pts.length>3&&distP(pts[0],pts[pts.length-1])<1e-6){let k=0,best=Infinity;
  pts.forEach((p,i)=>{const d=distP(/** @type {Pt} */(cur),p);if(d<best){best=d;k=i;}});if(k&&k<pts.length-1)pts=[...pts.slice(k,-1),...pts.slice(0,k+1)];
  }else if(cur&&distP(cur,pts[0])>distP(cur,pts[pts.length-1]))pts=[...pts].reverse();cur=pts[pts.length-1];return {...r,pts};});
};
// Fill: [contour underlay] -> [tatami underlay at 90°] -> top fill planned as a routed auto-fill. All parameters can be set per object.
/** @type {WeakMap<object, number[]>} */
const pinCache=new WeakMap();
// startAt / endAt are fractions of the object's bounding box, so they follow the object when it moves or scales. Lettering sews glyph by glyph and ignores
// them.
/**
 * @param {Item} o
 * @param {Pt|null|undefined} f
 * @returns {Pt|null}
 */
export function pinPoint(o,f){if(!f||o.kind==='text')return null;
let b=pinCache.get(o);
if(!b){b=objectBounds(o);
pinCache.set(o,b);
}return [b[0]+f[0]*(b[2]-b[0]),b[1]+f[1]*(b[3]-b[1])];
}
/** @type {(runs: Run[]) => Run[]} */
export const reverseRuns=runs=>[...runs].reverse().map(r=>({...r,pts:[...r.pts].reverse()}));

// Bar tack across the end of a buttonhole: a short zigzag between the two rails, stepping outwards from the column.
/**
 * @param {Pt} a
 * @param {Pt} b
 * @param {Pt} na
 * @param {Pt} nb
 * @param {boolean} [jump]
 * @returns {Run[]}
 */
export function bartack(a,b,na,nb,jump){const dx=a[0]-na[0],dy=a[1]-na[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;
  /** @type {Pt[]} */
  const pts=[];for(let k=0;k<6;k++){const p=k%2?b:a,s=Math.floor(k/2)*.35;pts.push(/** @type {Pt} */([p[0]+ux*s,p[1]+uy*s]));}return [{pts,jump}];}
