// @ts-check
// Row fills: the auto-fill planner, its contour underlays and the helpers they share.

/** @typedef {import('../stitchplan.js').Pt} Pt */
/** @typedef {import('../stitchplan.js').Run} Run */
/** @typedef {import('../stitchplan.js').Seg} Seg */
/** @typedef {import('../stitchplan.js').Opt} Opt */
/** @typedef {import('../stitchplan.js').Choice} Choice */
/** @typedef {import('../stitchplan.js').FillOptions} FillOptions */

import {closedRing, openRing} from '../geom.js';
import {last, dist, sampleRun, buildBoundary, insetRings} from './geometry.js';

/** @type {(k: number) => number} */
const rowHash=k=>((Math.imul((k+1)|0,2654435761)>>>0)%100003)/100003;
// ---- auto-fill ----------------------------------------------------------------------------------------------
/** @type {(n: number) => number} */
const vdc=n=>{let v=0,f=.5;while(n>0){v+=(n&1)*f;n>>=1;f/=2;}return v;};   // 0, .5, .25, .75, ...
// Needle phase of row k as a fraction of the stitch length: 0, .5, .25, .75, ... (stagger = how many distinct phases; rounded up to a power of two).
/** @type {(k: number, stagger: number) => number} */
export const rowOffset=(k,stagger)=>{if(stagger<=1)return 0;const P=1<<Math.ceil(Math.log2(stagger));return vdc(((k%P)+P)%P);};

// Needle x-positions (in the rotated frame) from x0 to x1: both ends plus interior points on a global grid shifted by `phase`.
/**
 * @param {number} x0
 * @param {number} x1
 * @param {number} len
 * @param {number} phase
 * @param {boolean} reverse
 * @returns {number[]}
 */
function rowXs(x0,x1,len,phase,reverse){
  const xs=[x0];let j=Math.ceil((x0+len*.35-phase)/len);for(let x=phase+j*len;x<x1-len*.35;x=phase+(++j)*len)xs.push(x);xs.push(x1);
  // no needle step longer than `len`: a gap up to 1.35 len (left by the grid at a row end) is split into equal pieces
  const out=[xs[0]];for(let i=1;i<xs.length;i++){const g=xs[i]-xs[i-1],n=Math.max(1,Math.ceil(g/len-1e-9));for(let k=1;k<=n;k++)out.push(xs[i-1]+g*k/n);}
  return reverse?out.reverse():out;
}

// Merge consecutive runs whose gap is at most maxGap (and for which okLine allows the straight connection) into one run.
/**
 * @param {Run[]} runs
 * @param {number} maxGap
 * @param {((a: Pt, b: Pt) => boolean)|null} [okLine]
 * @returns {Run[]}
 */
export function chainRuns(runs,maxGap,okLine=null){
  /** @type {Run[]} */ const out=[];
    for(const r of runs){const prev=out.at(-1);
    if(prev&&!r.jump){const a=last(prev.pts),b=r.pts[0],d=dist(a,b);
    if(d<=maxGap&&(!okLine||okLine(a,b))){prev.pts.push(...sampleRun([a,b],2.5).slice(1),...r.pts.slice(1));continue;}}out.push({...r,pts:[...r.pts]});
    }return out;}
/**
 * @param {Pt[][]} rings
 * @param {FillOptions} [opts]
 * @returns {Run[]}
 */
export function planFill(rings,
  {spacing=.4,angle=0,length=3,stagger=4,maxTravel=40,travelStep=2.2,linkTol=Math.max(3.5,spacing*3),insideTravel=8,from=null,rowPick=null,variance=0,underpath=
  false,accordion=null}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
  /** @type {(p: Pt) => Pt} */
  const rot=([x,y])=>[x*c+y*s,-x*s+y*c];
  /** @type {(p: Pt) => Pt} */
  const un=([x,y])=>[x*c-y*s,x*s+y*c];
  const R=closed.map(r=>r.map(rot)),ys=R.flat().map(p=>p[1]),minY=Math.min(...ys),maxY=Math.max(...ys);
  /** @type {number[]} */
  const rowYs=[];
  // Accordion spacing: the row spacing changes from accordion[0] at the top of the fill (minY) to accordion[1] at the bottom (maxY), in the rotated frame,
  // linearly or, when accordion[2] is true, along a smoothstep curve (slowest at both ends).
  if(accordion){
    const [a0,a1,ease]=accordion;
    /** @type {Record<string, (c: number) => number>} */
    const CURVES={linear:c=>c,ease:c=>c*c*(3-2*c),easeIn:c=>c*c,easeOut:c=>1-(1-c)*(1-c)};
    const curveFn=typeof ease==='string'?CURVES[ease]??CURVES.linear:(ease?CURVES.ease:CURVES.linear);
    /** @param {number} t */
    const curve=t=>curveFn(Math.max(0,Math.min(1,t)));
    /** @param {number} t */
    const gap=t=>a0+(a1-a0)*curve(t);
    let y=minY+gap(0)/2;while(y<maxY){rowYs.push(y);y+=gap((y-minY)/((maxY-minY)||1));}if(!rowYs.length)rowYs.push((minY+maxY)/2);}
  else if(maxY-minY<=spacing)rowYs.push((minY+maxY)/2);else for(let y=minY+spacing/2;y<maxY;y+=spacing)rowYs.push(y);
  // 1. grating: even-odd intersections of every row with every ring
  /** @type {Seg[]} */ const segs=[];
  /** @type {Seg[][]} */ const byRow=[];
  rowYs.forEach((y,k)=>
    {const xs=[];
    for(const ring of R)for(let i=0;i<ring.length-1;i++){const [x1,y1]=ring[i],[x2,y2]=ring[i+1];
    if((y1<=y&&y2>y)||(y2<=y&&y1>y))xs.push(x1+(y-y1)*(x2-x1)/(y2-y1));}xs.sort((a,b)=>a-b);
    const row=[];
      for(let i=0;i+1<xs.length;i+=2){if(xs[i+1]-xs[i]<.12)continue;const seg={k,y,x0:xs[i],x1:xs[i+1],prev:null,next:null,chain:-1};segs.push(seg);
      row.push(seg);}byRow.push(row);});
  if(!segs.length)return [];
  // 2. chain consecutive rows: each segment links to the best-overlapping unclaimed segment of the next row
  // rows that `rowPick` rejects are left out (another colour sews them); the remaining rows link to the next remaining row
  const kept=rowPick?byRow.filter((_,k)=>rowPick(k,rowYs[k],minY,maxY)):byRow;
  for(let k=0;k+1<kept.length;k++){const claimed=new Set();
    for(const a of kept[k]){let best=null,bestOv=.25;
    for(const b of kept[k+1]){if(claimed.has(b))continue;const ov=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);
    if(ov>bestOv&&Math.abs(a.x0-b.x0)<=linkTol&&Math.abs(a.x1-b.x1)<=linkTol){bestOv=ov;best=b;}}if(best){a.next=best;best.prev=a;claimed.add(best);}}}
  const keepSet=rowPick?new Set(kept.flat()):null;
  /** @type {Seg[][]} */ const chains=[];for(const sg of segs)if(!sg.prev&&(!keepSet||keepSet.has(sg))){
  /** @type {Seg[]} */ const list=[];for(let t=
  /** @type {Seg|null} */(sg);t;t=t.next){t.chain=chains.length;list.push(t);}chains.push(list);}
  // 3. order the chains greedily by distance from where the needle is, trying both directions of each chain
  const boundary=buildBoundary(closed);
  /** @type {(list: Seg[], startLeft: boolean, reversed: boolean) => Pt[]} */
  const pointsOf=(list,startLeft,reversed)=>{const seq=reversed?[...list].reverse():list;
  /** @type {Pt[]} */ const out=[];
    seq.forEach((sg,i)=>
    {const leftToRight=startLeft?i%2===0:i%2===1;const len=variance>0?length*(1+variance*(rowHash(sg.k)*2-1)):length;
    for(const x of rowXs(sg.x0,sg.x1,len,rowOffset(sg.k,stagger)*len,!leftToRight))out.push(un([x,sg.y]));});return out;};
  const options=
    chains.map((list,ci)=>
    {const o=[];
    for(const reversed of [false,true])for(const startLeft of [true,false]){const seg=reversed?last(list):list[0];
    o.push({ci,reversed,startLeft,start:un([startLeft?seg.x0:seg.x1,seg.y])});}return o;});
  /** @type {(p: Pt) => boolean} */
  const pointIn=p=>
    {let inside=false;
    for(const ring of closed)for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
  /** @type {(a: Pt, b: Pt) => boolean} */
  const insideLine=(a,b)=>
    {const n=Math.max(2,Math.ceil(dist(a,b)/.4));
    for(let i=1;i<n;i++){const t=i/n;if(!pointIn([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]))return false;}return true;};
  // Underpath: a longer straight travel through the shape is allowed when it only crosses rows that are not sewn yet, because those rows will cover it.
  /** @type {Set<number>} */ const usedChains=new Set();
  /** @type {(a: Pt, b: Pt) => boolean} */
  const crossesUsed=(a,b)=>
    {const ra=rot(a),rb=rot(b),y0=Math.min(ra[1],rb[1]),y1=Math.max(ra[1],rb[1]);if(y1-y0<1e-9)return false;
    for(let k=0;k<rowYs.length;k++){const y=rowYs[k];if(y<=y0||y>=y1)continue;const x=ra[0]+(y-ra[1])*(rb[0]-ra[0])/(rb[1]-ra[1]);
    for(const sg of byRow[k])if(usedChains.has(sg.chain)&&x>=sg.x0-.05&&x<=sg.x1+.05)return true;}return false;};
  /** @type {(a: Pt, b: Pt) => boolean} */
  const canUnder=(a,b)=>underpath&&dist(a,b)<=60&&insideLine(a,b)&&!crossesUsed(a,b);
  /** @type {Set<number>} */ const remaining=new Set(chains.keys());
  /** @type {Run[]} */ const runs=[];
  /** @type {Pt[]|null} */ let run=null;
  /** @type {Pt|null|undefined} */ let cur=null;
  while(remaining.size){
    /** @type {{o: {ci: number, reversed: boolean, startLeft: boolean, start: Pt}, key: number}|null} */
    let best=null;
    if(!cur&&from){for(const ci of remaining)for(const o of options[ci]){const d=dist(from,o.start);if(!best||d<best.key)best={o,key:d};}}
    else if(!cur){// first chain: the one touching the top-left corner of the shape in the rotated frame
      for(const ci of remaining)for(const o of options[ci]){const rs=rot(o.start),key=rs[1]*1000+rs[0];if(!best||key<best.key)best={o,key};}}
    else{// cheapest connection wins: stitching along the outline is nearly free, a straight line inside the shape costs a little, a jump costs a lot
      const here=cur;
      /** @type {{o: {ci: number, reversed: boolean, startLeft: boolean, start: Pt}, d: number}[]} */
      const near=[];for(const ci of remaining)for(const o of options[ci])near.push({o,d:dist(cur,o.start)});near.sort((x,y)=>x.d-y.d);
      for(const {o,d} of near.slice(0,10)){
      /** @type {number} */ let cost;if(d<=spacing*2.5)cost=d;
        else{const w=boundary.walk(cur,o.start,maxTravel);if(w)cost=w.reduce((n,p,i)=>n+dist(i?w[i-1]:here,p),0)*.9;
        else if(d<=insideTravel&&insideLine(cur,o.start))cost=d*2.5;else if(canUnder(cur,o.start))cost=d*1.3+3;else cost=60+d;}if(!best||cost<best.key)best=
        {o,key:cost};}}
    const o=
    /** @type {Choice} */(best).o;remaining.delete(o.ci);const pts=pointsOf(chains[o.ci],o.startLeft,o.reversed);
    if(!run||!cur){run=pts;}else{const d=dist(cur,pts[0]);let walked=null;if(d>spacing*2.5)walked=boundary.walk(cur,pts[0],maxTravel);
      if(walked)run.push(...sampleRun([cur,...walked],travelStep).slice(1),...pts.slice(1));
        else if(d<=3||(d<=insideTravel&&insideLine(cur,pts[0]))||(!walked&&canUnder(cur,pts[0])))run.push(...sampleRun([cur,pts[0]],travelStep).slice(1),
        ...pts.slice(1));else{runs.push({pts:run});run=pts;}}
    cur=run.at(-1);usedChains.add(o.ci);}
  if(run)runs.push({pts:run});
  return runs;
}

/**
 * @param {Pt[][]} rings
 * @param {{inset?: number, maxLen?: number}} [opts]
 * @returns {Run[]}
 */
export function planContour(rings,{inset=.4,maxLen=2.5}={}){const r=insetRings(rings,inset);return r?r.map(ring=>({pts:sampleRun(ring,maxLen)})):[];}
/**
 * @param {Pt[][]} rings
 * @param {{angle?: number, spacing?: number, length?: number, inset?: number}} [opts]
 * @returns {Run[]}
 */
export function planFillUnderlay(rings,{angle=0,spacing=2.2,length=3.5,inset=.6}={}){const r=insetRings(rings,inset);return r?
  planFill(r,{spacing,angle,length,stagger:1,maxTravel:20}):[];}
// Contour fill (Ink/Stitch "contour fill"): concentric rings of the shape, one every `spacing` mm, sewn from the outside in.
// Each ring starts at the point nearest to where the needle is, so the step between rings stays about one row spacing.
/**
 * @param {Pt[][]} rings
 * @param {{spacing?: number, length?: number, from?: Pt|null, maxLevels?: number}} [opts]
 * @returns {Run[]}
 */
export function planContourFill(rings,{spacing=.4,length=3,from=null,maxLevels=300}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  /** @type {Run[]} */ const runs=[];
  /** @type {Pt[]|null} */ let run=null;
  /** @type {Pt|null|undefined} */ let cur=from;
  for(let k=0;k<maxLevels;k++){
    const level=insetRings(closed,spacing/2+k*spacing);if(!level)break;
    const pending=level.map(r=>openRing(r)).filter(r=>r.length>=3);
    while(pending.length){
      let bi=0,bk=0,bd=Infinity;pending.forEach((r,i)=>r.forEach((p,j)=>{const d=cur?dist(cur,p):(p[1]*1000+p[0]);if(d<bd){bd=d;bi=i;bk=j;}}));
      const r=pending.splice(bi,1)[0],rot=[...r.slice(bk),...r.slice(0,bk),r[bk]],pts=sampleRun(rot,length);
      if(run&&cur&&dist(cur,pts[0])<=spacing*2.5)run.push(...pts.slice(1));else{if(run)runs.push({pts:run});run=pts;}
      cur=run.at(-1);}
  }
  if(run)runs.push({pts:run});
  return runs;
}
