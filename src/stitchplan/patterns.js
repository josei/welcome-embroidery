// @ts-check
// The other fill patterns: spiral, guided, meander, cross stitch, ripple and photo stitch.

/** @typedef {import('../stitchplan.js').Pt} Pt */
/** @typedef {import('../stitchplan.js').Run} Run */
/** @typedef {import('../stitchplan.js').FillOptions} FillOptions */

import {closedRing, openRing} from '../geom.js';
import {last, dist, sampleRun, pointInRings, ringLength, signedArea, nearestOnRing, resampleRing, respace, insetRings} from './geometry.js';
import {planFill} from './fill.js';

// Concentric inset levels of a shape, each a list of open rings.
/**
 * @param {Pt[][]} closed
 * @param {number} spacing
 * @param {number} maxLevels
 * @returns {Pt[][][]}
 */
function contourLevels(closed,spacing,maxLevels){
/** @type {Pt[][][]} */ const levels=[];
  for(let k=0;k<maxLevels;k++){const lv=insetRings(closed,spacing/2+k*spacing);if(!lv)break;const rs=
  lv.map(openRing).filter(r=>r.length>=3&&Math.abs(signedArea(r))>spacing*spacing&&2*Math.abs(signedArea(r))/ringLength(r)>spacing*.9);if(!rs.length)break;
  levels.push(rs);}return levels;}
// Spiral fill: each family of nested rings becomes one continuous spiral from the outside in. Between ring k and ring k+1 the needle
// path blends from one to the other over a single turn, so the turns stay one row spacing apart.
/**
 * @param {Pt[][]} rings
 * @param {{spacing?: number, length?: number, from?: Pt|null, maxLevels?: number}} [opts]
 * @returns {Run[]}
 */
export function planSpiralFill(rings,{spacing=.4,length=3,from=null,maxLevels=300}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const levels=contourLevels(closed,spacing,maxLevels);
  /** @type {{rings: Pt[][], last: number}[]} */ const lineages=[];
  levels.forEach((rs,k)=>{const open=lineages.filter(l=>l.last===k-1),used=new Set();
    for(const r of rs){const sample=r.filter((_,i)=>i%Math.max(1,Math.floor(r.length/24))===0);
    /** @type {{rings: Pt[][], last: number}|null} */ let best=null;let bd=Infinity;
      for(const l of open){if(used.has(l)||Math.sign(signedArea(last(l.rings)))!==Math.sign(signedArea(r)))continue;const d=
      sample.reduce((n,p)=>n+nearestOnRing(last(l.rings),p),0)/sample.length;if(d<bd){bd=d;best=l;}}
      if(best&&bd<spacing*2.2){used.add(best);best.rings.push(r);best.last=k;}else lineages.push({rings:[r],last:k});}});
  /** @type {Run[]} */ const runs=[];
  /** @type {Pt|null|undefined} */ let cur=from;
  const todo=lineages.map(l=>l.rings);
  while(todo.length){let bi=0,bd=Infinity;todo.forEach((rs,i)=>{const d=cur?nearestOnRing(rs[0],cur):rs[0][0][1]*1000+rs[0][0][0];if(d<bd){bd=d;bi=i;}});
    const rs=todo.splice(bi,1)[0].map(r=>signedArea(r)<0?[...r].reverse():r),M=Math.max(48,Math.min(2400,Math.ceil(ringLength(rs[0])/.3)));
    /** @type {Pt[][]} */ const rr=[];let near=cur;for(const r of rs){const s=resampleRing(r,M,near);rr.push(s);near=s[0];}
    /** @type {Pt[]} */ const pts=[];
      for(let k=0;k+1<rr.length;k++)for(let m=0;m<M;m++){const t=m/M,a=rr[k][m],b=rr[k+1][m];pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    for(let m=0;m<=M;m++)pts.push(last(rr)[m%M]);
    const run=respace(pts,length);runs.push({pts:run});cur=run.at(-1);}
  return runs;
}

// Guided fill: rows follow a guide line. The shape is straightened into (distance along the guide, distance across it),
// planned as ordinary rows there, and the needle positions are bent back, so the rows run parallel to the guide.
/**
 * @param {Pt[][]} rings
 * @param {Pt[]} guide
 * @param {FillOptions} [opts]
 * @returns {Run[]}
 */
export function planGuidedFill(rings,guide,opts={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const g=guide.filter((p,i)=>!i||dist(p,guide[i-1])>1e-6);if(g.length<2)return planFill(rings,opts);
  /** @type {(a: Pt, b: Pt) => Pt} */
  const unit=(a,b)=>{const l=dist(a,b)||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
  const d0=unit(g[0],g[1]),d1=unit(g[g.length-2],last(g)),EXT=2000;
  /** @type {Pt[]} */ const line=[[g[0][0]-d0[0]*EXT,g[0][1]-d0[1]*EXT],...g,[last(g)[0]+d1[0]*EXT,last(g)[1]+d1[1]*EXT]];const cum=[0];
    for(let i=1;i<line.length;i++)cum.push(cum[i-1]+dist(line[i-1],line[i]));
  /** @type {(p: Pt) => [number, number]} */
  const project=p=>{let best=
  /** @type {{d: number, s: number, side: number}|null} */(null);
    for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=
    Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)),qx=a[0]+dx*t,qy=a[1]+dy*t,d=Math.hypot(p[0]-qx,p[1]-qy);
    if(!best||d<best.d){const l=Math.sqrt(l2);best={d,s:cum[i-1]+l*t,side:(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/l};}}const b=
  /** @type {{d: number, s: number, side: number}} */(best);return [b.s,b.side];};
  /** @type {(p: [number, number]) => Pt} */
  const unproject=([s,d])=>
    {let i=1;while(i<line.length-1&&cum[i]<s)i++;const a=line[i-1],b=line[i],l=cum[i]-cum[i-1]||1,ux=(b[0]-a[0])/l,uy=(b[1]-a[1])/l,t=s-cum[i-1];
    return [a[0]+ux*t-uy*d,a[1]+uy*t+ux*d];};
  const warped=closed.map(r=>sampleRun(r,.5).map(project));
  const runs=planFill(warped,{...opts,angle:0,from:opts.from?project(opts.from):null});
  // bending can stretch a stitch where the guide turns sharply: split any step longer than a stitch back into stitch-sized pieces
  return runs.map(r=>({...r,pts:sampleRun(r.pts.map(unproject),(opts.length||3)*1.34)}));
}

// Meander fill: a maze-like path that covers the shape in one winding line (Ink/Stitch "meander fill"). A random spanning tree over a grid of cells is
// walked all the way around, out along one side of each branch and back along the other, which gives lines one `scale` x row spacing apart.
/**
 * @param {Pt[][]} rings
 * @param {{spacing?: number, length?: number, from?: Pt|null, scale?: number}} [opts]
 * @returns {Run[]}
 */
export function planMeanderFill(rings,{spacing=.4,length=3,from=null,scale=3}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const all=closed.flat(),x0=Math.min(...all.map(p=>p[0])),y0=Math.min(...all.map(p=>p[1])),x1=Math.max(...all.map(p=>p[0])),y1=Math.max(...all.map(p=>p[1]));
  let cell=Math.max(spacing*scale,.9)*2;while(((x1-x0)/cell+1)*((y1-y0)/cell+1)>4000)cell*=1.3;
  const nx=Math.ceil((x1-x0)/cell)+1,ny=Math.ceil((y1-y0)/cell)+1,OX=[.25,.75,.75,.25],OY=[.25,.25,.75,.75];
  /** @type {(i: number, j: number, k: number) => Pt} */
  const corner=(i,j,k)=>[x0+(i+OX[k])*cell,y0+(j+OY[k])*cell];
  /** @type {Map<string, [number, number]>} */ const valid=new Map();
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    if([0,1,2,3].every(k=>pointInRings(closed,corner(i,j,k)))&&pointInRings(closed,[x0+(i+.5)*cell,y0+(j+.5)*cell]))valid.set(i+','+j,[i,j]);}
  let seed=2463534242;const rnd=()=>
    {seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
  const DI=[0,1,0,-1],DJ=[-1,0,1,0];
  /** @type {Map<string, [number, number][]>} */ const children=new Map();
  const seen=new Set();
  /** @type {[number, number][]} */ const roots=[];
  for(const [key,[ci,cj]] of valid){if(seen.has(key))continue;roots.push([ci,cj]);seen.add(key);
  /** @type {[number, number][]} */ const stack=[[ci,cj]];
    while(stack.length){const [i,j]=last(stack),order=[0,1,2,3].sort(()=>rnd()-.5);let moved=false;
      for(const s of order){const ni=i+DI[s],nj=j+DJ[s],nk=ni+','+nj;
        if(valid.has(nk)&&!seen.has(nk)){seen.add(nk);const ck=i+','+j;let m=children.get(ck);if(!m){m=[];children.set(ck,m);}m[s]=[ni,nj];stack.push([ni,nj]);
        moved=true;break;}}
      if(!moved)stack.pop();}}
  /** @type {Run[]} */ const runs=[];
  /** @type {Pt|null|undefined} */ let cur=from;
  /**
   * @param {number} i
   * @param {number} j
   * @param {number} c0
   * @param {boolean} isRoot
   * @param {Pt[]} out
   */
  const tour=(i,j,c0,isRoot,out)=>
    {const kids=children.get(i+','+j)||[];
    for(let t=0;t<4;t++){const k=(c0+t)%4;out.push(corner(i,j,k));if(t<3||isRoot){const kid=kids[k];if(kid)tour(kid[0],kid[1],(k+3)%4,false,out);}}};
  for(const [i,j] of roots){
  /** @type {Pt[]} */ const pts=[];tour(i,j,0,true,pts);let s=0;const here=cur;
    if(here){let bd=Infinity;pts.forEach((p,n)=>{const d=dist(p,here);if(d<bd){bd=d;s=n;}});}
    const rot=[...pts.slice(s),...pts.slice(0,s),pts[s]],run=sampleRun(rot,length);runs.push({pts:run});cur=run.at(-1);}
  return runs;
}

// Cross stitch fill: the shape is covered with a grid of `size` mm cells (those that lie inside it); each row of neighbouring cells is sewn as a pass of
// "/" diagonals and a pass of "\" diagonals back, so every cell ends up as an X.
/**
 * @param {Pt[][]} rings
 * @param {{size?: number, from?: Pt|null}} [opts]
 * @returns {Run[]}
 */
export function planCrossStitch(rings,{size=2.5,from=null}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const all=closed.flat(),x0=Math.min(...all.map(p=>p[0])),y0=Math.min(...all.map(p=>p[1])),x1=Math.max(...all.map(p=>p[0])),y1=Math.max(...all.map(p=>p[1]));
  const nx=Math.ceil((x1-x0)/size),ny=Math.ceil((y1-y0)/size);
  /** @type {Run[]} */ const runs=[];
  /** @type {(i: number, j: number) => boolean} */
  const inCell=(i,j)=>{const pts=[[.5,.5],[.12,.12],[.88,.12],[.12,.88],[.88,.88]].map(([u,v])=>
  /** @type {Pt} */([x0+(i+u)*size,y0+(j+v)*size]));return pointInRings(closed,pts[0])&&pts.slice(1).filter(p=>pointInRings(closed,p)).length>=3;};
  for(let j=0;j<ny;j++){let i=0;
  /** @type {number[][]} */ const row=[];while(i<nx){if(!inCell(i,j)){i++;continue;}let e=i;while(e+1<nx&&inCell(e+1,j))e++;row.push([i,e]);i=e+1;}
    const ordered=j%2?row.slice().reverse():row;
    for(const [a,b] of ordered){
    /** @type {(k: number) => number} */ const X=k=>x0+k*size;const Y0=y0+j*size,Y1=Y0+size;
    /** @type {Pt[]} */ const pts=[[X(a),Y1]];
      for(let k=a;k<=b;k++){pts.push([X(k+1),Y0]);if(k<b)pts.push([X(k+1),Y1]);}             // "/" pass: bottom-left to top-right of each cell
      pts.push([X(b+1),Y1]);                                                                        // down the right edge
      for(let k=b;k>=a;k--){pts.push([X(k),Y0]);if(k>a)pts.push([X(k),Y1]);}                        // "\" pass back: bottom-right to top-left
      runs.push({pts});}}
  return runs;
}

// Ripple fill (Ink/Stitch "ripple"): scaled copies of the outline shrinking towards a centre point, sewn from the outside in as one winding line.
// The copies can leave a concave shape, so the caller clips the runs to the shape.
/**
 * @param {Pt[][]} rings
 * @param {{spacing?: number, length?: number, center?: Pt|null, from?: Pt|null, maxCopies?: number}} [opts]
 * @returns {Run[]}
 */
export function planRippleFill(rings,{spacing=.4,length=3,center=null,from=null,maxCopies=400}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const all=closed.flat(),c=center||
  /** @type {Pt} */([(Math.min(...all.map(p=>p[0]))+Math.max(...all.map(p=>p[0])))/2,(Math.min(...all.map(p=>p[1]))+Math.max(...all.map(p=>p[1])))/2]);
  const R=Math.max(...all.map(p=>dist(p,c))),N=Math.max(2,Math.min(maxCopies,Math.ceil(R/spacing)));
  /** @type {Run[]} */ const runs=[];
  /** @type {Pt[]|null} */ let run=null;
  /** @type {Pt|null|undefined} */ let cur=from;
  for(let k=0;k<N;k++){const f=1-(k+.5)/N,pending=closed.map(r=>openRing(r).map(p=>
  /** @type {Pt} */([c[0]+(p[0]-c[0])*f,c[1]+(p[1]-c[1])*f]))).filter(r=>r.length>=3);
    while(pending.length){let bi=0,bk=0,bd=Infinity;
      pending.forEach((r,i)=>r.forEach((p,j)=>{const d=cur?dist(cur,p):(p[1]*1000+p[0]);if(d<bd){bd=d;bi=i;bk=j;}}));
      const r=pending.splice(bi,1)[0],rot=[...r.slice(bk),...r.slice(0,bk),r[bk]],pts=sampleRun(rot,length);
      if(run&&cur&&dist(cur,pts[0])<=Math.max(spacing*3,R/N*3))run.push(...pts);else{if(run)runs.push({pts:run});run=pts;}
      cur=run.at(-1);}}
  if(run)runs.push({pts:run});
  return runs;
}

// Photo stitch: horizontal rows across the picture, each sewn as a zigzag whose width follows how dark the picture is under it, one continuous line (rows
// alternate direction).
// gray: pw*ph bytes (0 black .. 255 white). box: {x,y,w,h} in mm. Returns one run.
/**
 * @param {Uint8Array|number[]} gray
 * @param {number} pw
 * @param {number} ph
 * @param {{x: number, y: number, w: number, h: number}} box
 * @param {{spacing?: number, contrast?: number, invert?: boolean, pitch?: number, cutoff?: number, minGap?: number, tone?: string}} [opts]
 * @returns {Run[]}
 */
export function planPhoto(gray,pw,ph,box,{spacing=.7,contrast=1.4,invert=false,pitch=.45,cutoff=.06,minGap=3,tone='full'}={}){
  /** @type {(u: number, v: number) => number} */
  const at=(u,v)=>
    {const x=Math.max(0,Math.min(pw-1,u*pw-.5)),y=Math.max(0,Math.min(ph-1,v*ph-.5)),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(pw-1,x0+1),y1=
    Math.min(ph-1,y0+1),fx=x-x0,fy=y-y0,g=
  /** @type {(i: number, j: number) => number} */((i,j)=>gray[j*pw+i]);return (g(x0,y0)*(1-fx)+g(x1,y0)*fx)*(1-fy)+(g(x0,y1)*(1-fx)+g(x1,y1)*fx)*fy;};
  /** @type {(u: number, v: number) => number} */
  const dark=(u,v)=>
    {let d=1-at(u,v)/255;if(invert)d=1-d;const val=Math.max(0,Math.min(1,(d-.5)*contrast+.5));return tone==='light'?Math.min(1,val*1.7):tone==='mid'?
    Math.max(0,1-Math.abs(val-.5)/.38):tone==='dark'?Math.max(0,(val-.5)/.5):tone==='light-mid'?Math.max(0,1-Math.abs(val-.3)/.3):tone==='mid-dark'?
    Math.max(0,1-Math.abs(val-.7)/.3):val;};
  const rows=Math.max(1,Math.floor(box.h/spacing)),n=Math.max(2,Math.ceil(box.w/pitch)),gapN=Math.max(2,Math.round(minGap/pitch));
  /** @type {Run[]} */ const runs=[];
  for(let j=0;j<rows;j++){const y=box.y+(j+.5)*box.h/rows,v=(j+.5)/rows,ltr=j%2===0;
  /** @type {{u: number, d: number}[]} */ const samples=[];
    for(let i=0;i<=n;i++){const u=ltr?i/n:1-i/n;samples.push({u,d:dark(u,v)});}
    // light stretches of at least minGap mm are not sewn: the row is cut there (the machine jumps across)
    const skip=new Array(samples.length).fill(false);
      for(let i=0;i<samples.length;){if(samples[i].d>=cutoff){i++;continue;}let e=i;while(e<samples.length&&samples[e].d<cutoff)e++;
      if(e-i>=gapN)for(let k=i;k<e;k++)skip[k]=true;i=e;}
    /** @type {Pt[]|null} */ let cur=null;let k=0;
      for(let i=0;i<samples.length;i++){if(skip[i]){cur=null;continue;}const {u,d}=samples[i],amp=d*spacing*.48,off=amp<.03?0:(k++%2?amp:-amp);
      if(!cur){cur=[];runs.push({pts:cur});}cur.push([box.x+u*box.w,y+off]);}}
  return runs.filter(r=>r.pts.length>=2);
}

