// Stitch planning: turns shapes into runs of needle positions.
//   run = {pts:[[x,y],...], jump?:true}  consecutive points are stitched; `jump` forces a thread break before the run.
// Fills use an auto-fill planner: parallel rows are chained into continuous strips, the strips are ordered by travel
// cost, and travel between strips follows the shape's outline (or a hole's edge) with ordinary stitches instead of jumping.
// Needle penetrations in neighbouring rows are staggered so they do not line up into visible ridges.
import {polygonClipping,bufferSegments,closedRing,openRing,rdp} from './geom.js';

const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

// Points along a polyline no further apart than maxLen (original vertices are kept).
export function sampleRun(pts,maxLen=2.5){
  const out=[];for(const p of pts){if(!out.length){out.push([p[0],p[1]]);continue;}const a=out.at(-1),d=dist(a,p);if(d<1e-6)continue;const n=Math.max(1,Math.ceil(d/maxLen-1e-9));for(let k=1;k<=n;k++)out.push([a[0]+(p[0]-a[0])*k/n,a[1]+(p[1]-a[1])*k/n]);}
  return out;
}

// ---- outline travel -----------------------------------------------------------------------------------------
export function buildBoundary(rings){
  const rs=rings.map(r=>{const pts=openRing(r),cum=[0];for(let i=1;i<=pts.length;i++)cum.push(cum[i-1]+dist(pts[i-1],pts[i%pts.length]));return {pts,cum,len:cum.at(-1)};}).filter(r=>r.len>0);
  function locate(p){let best=null;rs.forEach((r,ri)=>{const n=r.pts.length;for(let i=0;i<n;i++){const a=r.pts[i],b=r.pts[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0,d=Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);if(!best||d<best.d)best={ring:ri,d,s:r.cum[i]+Math.sqrt(l2)*t,i};}});return best;}
  // Shorter way round the ring from a to b, as vertices strictly between plus b itself; null when they are on different rings or too far.
  function walk(a,b,maxLen,tol=.3){const la=locate(a),lb=locate(b);if(!la||!lb||la.d>tol||lb.d>tol||la.ring!==lb.ring)return null;const r=rs[la.ring],L=r.len,fwd=((lb.s-la.s)%L+L)%L,back=L-fwd,forward=fwd<=back,d=Math.min(fwd,back);if(d>maxLen)return null;
    const out=[],n=r.pts.length;if(forward){for(let k=1;k<=n;k++){const idx=(la.i+k)%n,s=r.cum[idx],ds=((s-la.s)%L+L)%L;if(ds>1e-6&&ds<fwd-1e-6)out.push(r.pts[idx]);else if(ds>=fwd-1e-6)break;}}
    else{for(let k=0;k<n;k++){const idx=((la.i-k)%n+n)%n,s=r.cum[idx],ds=((la.s-s)%L+L)%L;if(ds>1e-6&&ds<back-1e-6)out.push(r.pts[idx]);else if(ds>=back-1e-6)break;}}
    return [...out,b];}
  return {walk,locate,rings:rs};
}

const rowHash=k=>((Math.imul((k+1)|0,2654435761)>>>0)%100003)/100003;
// ---- auto-fill ----------------------------------------------------------------------------------------------
const vdc=n=>{let v=0,f=.5;while(n>0){v+=(n&1)*f;n>>=1;f/=2;}return v;};   // 0, .5, .25, .75, ...
// Needle phase of row k as a fraction of the stitch length: 0, .5, .25, .75, ... (stagger = how many distinct phases; rounded up to a power of two).
export const rowOffset=(k,stagger)=>{if(stagger<=1)return 0;const P=1<<Math.ceil(Math.log2(stagger));return vdc(((k%P)+P)%P);};

// Needle x-positions (in the rotated frame) from x0 to x1: both ends plus interior points on a global grid shifted by `phase`.
function rowXs(x0,x1,len,phase,reverse){
  const xs=[x0];let j=Math.ceil((x0+len*.35-phase)/len);for(let x=phase+j*len;x<x1-len*.35;x=phase+(++j)*len)xs.push(x);xs.push(x1);
  // no needle step longer than `len`: a gap up to 1.35 len (left by the grid at a row end) is split into equal pieces
  const out=[xs[0]];for(let i=1;i<xs.length;i++){const g=xs[i]-xs[i-1],n=Math.max(1,Math.ceil(g/len-1e-9));for(let k=1;k<=n;k++)out.push(xs[i-1]+g*k/n);}
  return reverse?out.reverse():out;
}

// (a,b) => true when the straight line between two points stays inside the shape (even-odd over all rings).
export function makeInside(rings){const closed=rings.map(closedRing).filter(r=>r.length>=4);const pointIn=p=>{let inside=false;for(const ring of closed)for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;};return (a,b)=>{const n=Math.max(2,Math.ceil(dist(a,b)/.4));for(let i=0;i<=n;i++){const t=i/n;if(!pointIn([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]))return false;}return true;};}
// Merge consecutive runs whose gap is at most maxGap (and for which okLine allows the straight connection) into one run.
export function chainRuns(runs,maxGap,okLine=null){const out=[];for(const r of runs){const prev=out.at(-1);if(prev&&!r.jump){const a=prev.pts.at(-1),b=r.pts[0],d=dist(a,b);if(d<=maxGap&&(!okLine||okLine(a,b))){prev.pts.push(...sampleRun([a,b],2.5).slice(1),...r.pts.slice(1));continue;}}out.push({...r,pts:[...r.pts]});}return out;}
export function planFill(rings,{spacing=.4,angle=0,length=3,stagger=4,maxTravel=40,travelStep=2.2,linkTol=Math.max(3.5,spacing*3),insideTravel=8,from=null,rowPick=null,variance=0,underpath=false,accordion=null}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),rot=([x,y])=>[x*c+y*s,-x*s+y*c],un=([x,y])=>[x*c-y*s,x*s+y*c];
  const R=closed.map(r=>r.map(rot)),ys=R.flat().map(p=>p[1]),minY=Math.min(...ys),maxY=Math.max(...ys);
  const rowYs=[];
  // Accordion spacing: the row spacing changes from accordion[0] at the top of the fill (minY) to accordion[1] at the bottom (maxY), in the rotated frame, linearly or, when accordion[2] is true, along a smoothstep curve (slowest at both ends).
  if(accordion){const [a0,a1,ease]=accordion,CURVES={linear:c=>c,ease:c=>c*c*(3-2*c),easeIn:c=>c*c,easeOut:c=>1-(1-c)*(1-c)},curveFn=typeof ease==='string'?CURVES[ease]??CURVES.linear:(ease?CURVES.ease:CURVES.linear),curve=t=>curveFn(Math.max(0,Math.min(1,t))),gap=t=>a0+(a1-a0)*curve(t);let y=minY+gap(0)/2;while(y<maxY){rowYs.push(y);y+=gap((y-minY)/((maxY-minY)||1));}if(!rowYs.length)rowYs.push((minY+maxY)/2);}
  else if(maxY-minY<=spacing)rowYs.push((minY+maxY)/2);else for(let y=minY+spacing/2;y<maxY;y+=spacing)rowYs.push(y);
  // 1. grating: even-odd intersections of every row with every ring
  const segs=[],byRow=[];
  rowYs.forEach((y,k)=>{const xs=[];for(const ring of R)for(let i=0;i<ring.length-1;i++){const [x1,y1]=ring[i],[x2,y2]=ring[i+1];if((y1<=y&&y2>y)||(y2<=y&&y1>y))xs.push(x1+(y-y1)*(x2-x1)/(y2-y1));}xs.sort((a,b)=>a-b);
    const row=[];for(let i=0;i+1<xs.length;i+=2){if(xs[i+1]-xs[i]<.12)continue;const seg={k,y,x0:xs[i],x1:xs[i+1],prev:null,next:null,chain:-1};segs.push(seg);row.push(seg);}byRow.push(row);});
  if(!segs.length)return [];
  // 2. chain consecutive rows: each segment links to the best-overlapping unclaimed segment of the next row
  // rows that `rowPick` rejects are left out (another colour sews them); the remaining rows link to the next remaining row
  const kept=rowPick?byRow.filter((_,k)=>rowPick(k,rowYs[k],minY,maxY)):byRow;
  for(let k=0;k+1<kept.length;k++){const claimed=new Set();for(const a of kept[k]){let best=null,bestOv=.25;for(const b of kept[k+1]){if(claimed.has(b))continue;const ov=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);if(ov>bestOv&&Math.abs(a.x0-b.x0)<=linkTol&&Math.abs(a.x1-b.x1)<=linkTol){bestOv=ov;best=b;}}if(best){a.next=best;best.prev=a;claimed.add(best);}}}
  const keepSet=rowPick?new Set(kept.flat()):null,chains=[];for(const sg of segs)if(!sg.prev&&(!keepSet||keepSet.has(sg))){const list=[];for(let t=sg;t;t=t.next){t.chain=chains.length;list.push(t);}chains.push(list);}
  // 3. order the chains greedily by distance from where the needle is, trying both directions of each chain
  const boundary=buildBoundary(closed),pointsOf=(list,startLeft,reversed)=>{const seq=reversed?[...list].reverse():list,out=[];seq.forEach((sg,i)=>{const leftToRight=startLeft?i%2===0:i%2===1;const len=variance>0?length*(1+variance*(rowHash(sg.k)*2-1)):length;for(const x of rowXs(sg.x0,sg.x1,len,rowOffset(sg.k,stagger)*len,!leftToRight))out.push(un([x,sg.y]));});return out;};
  const options=chains.map((list,ci)=>{const o=[];for(const reversed of [false,true])for(const startLeft of [true,false]){const seg=reversed?list.at(-1):list[0];o.push({ci,reversed,startLeft,start:un([startLeft?seg.x0:seg.x1,seg.y])});}return o;});
  const pointIn=p=>{let inside=false;for(const ring of closed)for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
  const insideLine=(a,b)=>{const n=Math.max(2,Math.ceil(dist(a,b)/.4));for(let i=1;i<n;i++){const t=i/n;if(!pointIn([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]))return false;}return true;};
  // Underpath: a longer straight travel through the shape is allowed when it only crosses rows that are not sewn yet, because those rows will cover it.
  const usedChains=new Set(),crossesUsed=(a,b)=>{const ra=rot(a),rb=rot(b),y0=Math.min(ra[1],rb[1]),y1=Math.max(ra[1],rb[1]);if(y1-y0<1e-9)return false;for(let k=0;k<rowYs.length;k++){const y=rowYs[k];if(y<=y0||y>=y1)continue;const x=ra[0]+(y-ra[1])*(rb[0]-ra[0])/(rb[1]-ra[1]);for(const sg of byRow[k])if(usedChains.has(sg.chain)&&x>=sg.x0-.05&&x<=sg.x1+.05)return true;}return false;};
  const canUnder=(a,b)=>underpath&&dist(a,b)<=60&&insideLine(a,b)&&!crossesUsed(a,b);
  const remaining=new Set(chains.keys()),runs=[];let run=null,cur=null;
  while(remaining.size){let best=null;
    if(!cur&&from){for(const ci of remaining)for(const o of options[ci]){const d=dist(from,o.start);if(!best||d<best.key)best={o,key:d};}}
    else if(!cur){// first chain: the one touching the top-left corner of the shape in the rotated frame
      for(const ci of remaining)for(const o of options[ci]){const rs=rot(o.start),key=rs[1]*1000+rs[0];if(!best||key<best.key)best={o,key};}}
    else{// cheapest connection wins: stitching along the outline is nearly free, a straight line inside the shape costs a little, a jump costs a lot
      const near=[];for(const ci of remaining)for(const o of options[ci])near.push({o,d:dist(cur,o.start)});near.sort((x,y)=>x.d-y.d);
      for(const {o,d} of near.slice(0,10)){let cost;if(d<=spacing*2.5)cost=d;else{const w=boundary.walk(cur,o.start,maxTravel);if(w)cost=w.reduce((n,p,i)=>n+dist(i?w[i-1]:cur,p),0)*.9;else if(d<=insideTravel&&insideLine(cur,o.start))cost=d*2.5;else if(canUnder(cur,o.start))cost=d*1.3+3;else cost=60+d;}if(!best||cost<best.key)best={o,key:cost};}}
    const o=best.o;remaining.delete(o.ci);const pts=pointsOf(chains[o.ci],o.startLeft,o.reversed);
    if(!run){run=pts;}else{const d=dist(cur,pts[0]);let walked=null;if(d>spacing*2.5)walked=boundary.walk(cur,pts[0],maxTravel);
      if(walked)run.push(...sampleRun([cur,...walked],travelStep).slice(1),...pts.slice(1));else if(d<=3||(d<=insideTravel&&insideLine(cur,pts[0]))||(!walked&&canUnder(cur,pts[0])))run.push(...sampleRun([cur,pts[0]],travelStep).slice(1),...pts.slice(1));else{runs.push({pts:run});run=pts;}}
    cur=run.at(-1);usedChains.add(o.ci);}
  if(run)runs.push({pts:run});
  return runs;
}

// ---- underlay -----------------------------------------------------------------------------------------------
// Rings of the shape shrunk by `inset` mm (holes grow). Returns closed rings, or null when the shape is too small for the inset.
// Rings are outlines and holes by nesting depth (even-odd); disjoint outlines, such as the strips of a blend, are separate polygons.
function nestPolygons(rings){
  const depth=rings.map((r,i)=>rings.reduce((n,s,j)=>n+(j!==i&&pointInRings([s],r[0])?1:0),0)),polys=[],owner=new Map();
  rings.forEach((r,i)=>{if(depth[i]%2===0){owner.set(i,polys.length);polys.push([openRing(r)]);}});
  rings.forEach((r,i)=>{if(depth[i]%2===0)return;let best=-1,area=Infinity;rings.forEach((s,j)=>{const a=Math.abs(signedArea(s));if(j!==i&&depth[j]===depth[i]-1&&a<area&&pointInRings([s],r[0])){area=a;best=j;}});if(best>=0)polys[owner.get(best)].push(openRing(r));});
  return polys;
}
export function insetRings(rings,inset){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length||inset<=0)return closed.length?closed:null;
  // underlay does not need the exact outline: simplify first (0.1 mm) and use coarse circles, which makes the clipping several times faster
  try{const simple=closed.map(r=>{const o=openRing(r),q=rdp([...o,o[0]],.1);return closedRing(q.length>=4?q.slice(0,-1):o);}),poly=nestPolygons(simple),grown=bufferSegments(simple,inset,800,10),res=polygonClipping.difference(poly,...grown);const out=[];for(const polygon of res)for(const ring of polygon)out.push(ring);return out.length?out:null;}catch{return null;}
}
export function planContour(rings,{inset=.4,maxLen=2.5}={}){const r=insetRings(rings,inset);return r?r.map(ring=>({pts:sampleRun(ring,maxLen)})):[];}
export function planFillUnderlay(rings,{angle=0,spacing=2.2,length=3.5,inset=.6}={}){const r=insetRings(rings,inset);return r?planFill(r,{spacing,angle,length,stagger:1,maxTravel:20}):[];}

// Contour fill (Ink/Stitch "contour fill"): concentric rings of the shape, one every `spacing` mm, sewn from the outside in.
// Each ring starts at the point nearest to where the needle is, so the step between rings stays about one row spacing.
export function planContourFill(rings,{spacing=.4,length=3,from=null,maxLevels=300}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const runs=[];let run=null,cur=from;
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

// ---- more fill patterns -------------------------------------------------------------------------------------
const pointInRings=(closed,p)=>{let inside=false;for(const ring of closed)for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
const ringLength=r=>{let L=0;for(let i=0;i<r.length;i++)L+=dist(r[i],r[(i+1)%r.length]);return L;};
const signedArea=r=>{let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
function nearestOnRing(r,p){let best=Infinity;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;best=Math.min(best,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t));}return best;}
// M points spaced evenly along a closed ring, starting at the ring vertex nearest to `near`.
function resampleRing(r,M,near){
  const n=r.length,cum=[0];for(let i=0;i<n;i++)cum.push(cum[i]+dist(r[i],r[(i+1)%n]));const L=cum[n];let s0=0,bd=Infinity;if(near)r.forEach((p,i)=>{const d=dist(p,near);if(d<bd){bd=d;s0=cum[i];}});
  const out=[];let seg=0;for(let m=0;m<M;m++){const s=(s0+L*m/M)%L;seg=0;while(seg<n-1&&cum[seg+1]<=s)seg++;const a=r[seg],b=r[(seg+1)%n],f=(s-cum[seg])/((cum[seg+1]-cum[seg])||1);out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}
  return out;
}
// Points along a dense polyline every `len` mm (the last point is kept).
function respace(pts,len){const out=[pts[0]];let acc=0;for(let i=1;i<pts.length;i++){const d=dist(pts[i-1],pts[i]);acc+=d;if(acc>=len){out.push(pts[i]);acc=0;}}if(dist(out.at(-1),pts.at(-1))>1e-6)out.push(pts.at(-1));return out;}
// Concentric inset levels of a shape, each a list of open rings.
function contourLevels(closed,spacing,maxLevels){const levels=[];for(let k=0;k<maxLevels;k++){const lv=insetRings(closed,spacing/2+k*spacing);if(!lv)break;const rs=lv.map(openRing).filter(r=>r.length>=3&&Math.abs(signedArea(r))>spacing*spacing&&2*Math.abs(signedArea(r))/ringLength(r)>spacing*.9);if(!rs.length)break;levels.push(rs);}return levels;}

// Spiral fill: each family of nested rings becomes one continuous spiral from the outside in. Between ring k and ring k+1 the needle
// path blends from one to the other over a single turn, so the turns stay one row spacing apart.
export function planSpiralFill(rings,{spacing=.4,length=3,from=null,maxLevels=300}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const levels=contourLevels(closed,spacing,maxLevels),lineages=[];
  levels.forEach((rs,k)=>{const open=lineages.filter(l=>l.last===k-1),used=new Set();
    for(const r of rs){const sample=r.filter((_,i)=>i%Math.max(1,Math.floor(r.length/24))===0);let best=null,bd=Infinity;for(const l of open){if(used.has(l)||Math.sign(signedArea(l.rings.at(-1)))!==Math.sign(signedArea(r)))continue;const d=sample.reduce((n,p)=>n+nearestOnRing(l.rings.at(-1),p),0)/sample.length;if(d<bd){bd=d;best=l;}}
      if(best&&bd<spacing*2.2){used.add(best);best.rings.push(r);best.last=k;}else lineages.push({rings:[r],last:k});}});
  const runs=[];let cur=from;const todo=lineages.map(l=>l.rings);
  while(todo.length){let bi=0,bd=Infinity;todo.forEach((rs,i)=>{const d=cur?nearestOnRing(rs[0],cur):rs[0][0][1]*1000+rs[0][0][0];if(d<bd){bd=d;bi=i;}});
    const rs=todo.splice(bi,1)[0].map(r=>signedArea(r)<0?[...r].reverse():r),M=Math.max(48,Math.min(2400,Math.ceil(ringLength(rs[0])/.3)));
    const rr=[];let near=cur;for(const r of rs){const s=resampleRing(r,M,near);rr.push(s);near=s[0];}
    const pts=[];for(let k=0;k+1<rr.length;k++)for(let m=0;m<M;m++){const t=m/M,a=rr[k][m],b=rr[k+1][m];pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    for(let m=0;m<=M;m++)pts.push(rr.at(-1)[m%M]);
    const run=respace(pts,length);runs.push({pts:run});cur=run.at(-1);}
  return runs;
}

// Guided fill: rows follow a guide line. The shape is straightened into (distance along the guide, distance across it),
// planned as ordinary rows there, and the needle positions are bent back, so the rows run parallel to the guide.
export function planGuidedFill(rings,guide,opts={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const g=guide.filter((p,i)=>!i||dist(p,guide[i-1])>1e-6);if(g.length<2)return planFill(rings,opts);
  const unit=(a,b)=>{const l=dist(a,b)||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];},d0=unit(g[0],g[1]),d1=unit(g.at(-2),g.at(-1)),EXT=2000;
  const line=[[g[0][0]-d0[0]*EXT,g[0][1]-d0[1]*EXT],...g,[g.at(-1)[0]+d1[0]*EXT,g.at(-1)[1]+d1[1]*EXT]],cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+dist(line[i-1],line[i]));
  const project=p=>{let best=null;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)),qx=a[0]+dx*t,qy=a[1]+dy*t,d=Math.hypot(p[0]-qx,p[1]-qy);if(!best||d<best.d){const l=Math.sqrt(l2);best={d,s:cum[i-1]+l*t,side:(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/l};}}return [best.s,best.side];};
  const unproject=([s,d])=>{let i=1;while(i<line.length-1&&cum[i]<s)i++;const a=line[i-1],b=line[i],l=cum[i]-cum[i-1]||1,ux=(b[0]-a[0])/l,uy=(b[1]-a[1])/l,t=s-cum[i-1];return [a[0]+ux*t-uy*d,a[1]+uy*t+ux*d];};
  const warped=closed.map(r=>sampleRun(r,.5).map(project));
  const runs=planFill(warped,{...opts,angle:0,from:opts.from?project(opts.from):null});
  // bending can stretch a stitch where the guide turns sharply: split any step longer than a stitch back into stitch-sized pieces
  return runs.map(r=>({...r,pts:sampleRun(r.pts.map(unproject),(opts.length||3)*1.34)}));
}

// Meander fill: a maze-like path that covers the shape in one winding line (Ink/Stitch "meander fill"). A random spanning tree over a grid of cells is
// walked all the way around, out along one side of each branch and back along the other, which gives lines one `scale` x row spacing apart.
export function planMeanderFill(rings,{spacing=.4,length=3,from=null,scale=3}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const all=closed.flat(),x0=Math.min(...all.map(p=>p[0])),y0=Math.min(...all.map(p=>p[1])),x1=Math.max(...all.map(p=>p[0])),y1=Math.max(...all.map(p=>p[1]));
  let cell=Math.max(spacing*scale,.9)*2;while(((x1-x0)/cell+1)*((y1-y0)/cell+1)>4000)cell*=1.3;
  const nx=Math.ceil((x1-x0)/cell)+1,ny=Math.ceil((y1-y0)/cell)+1,OX=[.25,.75,.75,.25],OY=[.25,.25,.75,.75];
  const corner=(i,j,k)=>[x0+(i+OX[k])*cell,y0+(j+OY[k])*cell],valid=new Map();
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){if([0,1,2,3].every(k=>pointInRings(closed,corner(i,j,k)))&&pointInRings(closed,[x0+(i+.5)*cell,y0+(j+.5)*cell]))valid.set(i+','+j,[i,j]);}
  let seed=2463534242;const rnd=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
  const DI=[0,1,0,-1],DJ=[-1,0,1,0],children=new Map(),seen=new Set(),roots=[];
  for(const [key,[ci,cj]] of valid){if(seen.has(key))continue;roots.push([ci,cj]);seen.add(key);const stack=[[ci,cj]];
    while(stack.length){const [i,j]=stack.at(-1),order=[0,1,2,3].sort(()=>rnd()-.5);let moved=false;
      for(const s of order){const ni=i+DI[s],nj=j+DJ[s],nk=ni+','+nj;if(valid.has(nk)&&!seen.has(nk)){seen.add(nk);const ck=i+','+j,m=children.get(ck)||children.set(ck,[]).get(ck);m[s]=[ni,nj];stack.push([ni,nj]);moved=true;break;}}
      if(!moved)stack.pop();}}
  const runs=[];let cur=from;
  const tour=(i,j,c0,isRoot,out)=>{const kids=children.get(i+','+j)||[];for(let t=0;t<4;t++){const k=(c0+t)%4;out.push(corner(i,j,k));if(t<3||isRoot){const kid=kids[k];if(kid)tour(kid[0],kid[1],(k+3)%4,false,out);}}};
  for(const [i,j] of roots){const pts=[];tour(i,j,0,true,pts);let s=0;if(cur){let bd=Infinity;pts.forEach((p,n)=>{const d=dist(p,cur);if(d<bd){bd=d;s=n;}});}
    const rot=[...pts.slice(s),...pts.slice(0,s),pts[s]],run=sampleRun(rot,length);runs.push({pts:run});cur=run.at(-1);}
  return runs;
}

// Cross stitch fill: the shape is covered with a grid of `size` mm cells (those that lie inside it); each row of neighbouring cells is sewn as a pass of
// "/" diagonals and a pass of "\" diagonals back, so every cell ends up as an X.
export function planCrossStitch(rings,{size=2.5,from=null}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const all=closed.flat(),x0=Math.min(...all.map(p=>p[0])),y0=Math.min(...all.map(p=>p[1])),x1=Math.max(...all.map(p=>p[0])),y1=Math.max(...all.map(p=>p[1]));
  const nx=Math.ceil((x1-x0)/size),ny=Math.ceil((y1-y0)/size),runs=[],inCell=(i,j)=>{const pts=[[.5,.5],[.12,.12],[.88,.12],[.12,.88],[.88,.88]].map(([u,v])=>[x0+(i+u)*size,y0+(j+v)*size]);return pointInRings(closed,pts[0])&&pts.slice(1).filter(p=>pointInRings(closed,p)).length>=3;};
  for(let j=0;j<ny;j++){let i=0;const row=[];while(i<nx){if(!inCell(i,j)){i++;continue;}let e=i;while(e+1<nx&&inCell(e+1,j))e++;row.push([i,e]);i=e+1;}
    const ordered=j%2?row.slice().reverse():row;
    for(const [a,b] of ordered){const X=k=>x0+k*size,Y0=y0+j*size,Y1=Y0+size,pts=[[X(a),Y1]];
      for(let k=a;k<=b;k++){pts.push([X(k+1),Y0]);if(k<b)pts.push([X(k+1),Y1]);}             // "/" pass: bottom-left to top-right of each cell
      pts.push([X(b+1),Y1]);                                                                        // down the right edge
      for(let k=b;k>=a;k--){pts.push([X(k),Y0]);if(k>a)pts.push([X(k),Y1]);}                        // "\" pass back: bottom-right to top-left
      runs.push({pts});}}
  return runs;
}

// Ripple fill (Ink/Stitch "ripple"): scaled copies of the outline shrinking towards a centre point, sewn from the outside in as one winding line.
// The copies can leave a concave shape, so the caller clips the runs to the shape.
export function planRippleFill(rings,{spacing=.4,length=3,center=null,from=null,maxCopies=400}={}){
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return [];
  const all=closed.flat(),c=center||[(Math.min(...all.map(p=>p[0]))+Math.max(...all.map(p=>p[0])))/2,(Math.min(...all.map(p=>p[1]))+Math.max(...all.map(p=>p[1])))/2];
  const R=Math.max(...all.map(p=>dist(p,c))),N=Math.max(2,Math.min(maxCopies,Math.ceil(R/spacing))),runs=[];let run=null,cur=from;
  for(let k=0;k<N;k++){const f=1-(k+.5)/N,pending=closed.map(r=>openRing(r).map(p=>[c[0]+(p[0]-c[0])*f,c[1]+(p[1]-c[1])*f])).filter(r=>r.length>=3);
    while(pending.length){let bi=0,bk=0,bd=Infinity;pending.forEach((r,i)=>r.forEach((p,j)=>{const d=cur?dist(cur,p):(p[1]*1000+p[0]);if(d<bd){bd=d;bi=i;bk=j;}}));
      const r=pending.splice(bi,1)[0],rot=[...r.slice(bk),...r.slice(0,bk),r[bk]],pts=sampleRun(rot,length);
      if(run&&cur&&dist(cur,pts[0])<=Math.max(spacing*3,R/N*3))run.push(...pts);else{if(run)runs.push({pts:run});run=pts;}
      cur=run.at(-1);}}
  if(run)runs.push({pts:run});
  return runs;
}

// Photo stitch: horizontal rows across the picture, each sewn as a zigzag whose width follows how dark the picture is under it, one continuous line (rows alternate direction).
// gray: pw*ph bytes (0 black .. 255 white). box: {x,y,w,h} in mm. Returns one run.
export function planPhoto(gray,pw,ph,box,{spacing=.7,contrast=1.4,invert=false,pitch=.45,cutoff=.06,minGap=3,tone='full'}={}){
  const at=(u,v)=>{const x=Math.max(0,Math.min(pw-1,u*pw-.5)),y=Math.max(0,Math.min(ph-1,v*ph-.5)),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(pw-1,x0+1),y1=Math.min(ph-1,y0+1),fx=x-x0,fy=y-y0,g=(i,j)=>gray[j*pw+i];return (g(x0,y0)*(1-fx)+g(x1,y0)*fx)*(1-fy)+(g(x0,y1)*(1-fx)+g(x1,y1)*fx)*fy;};
  const dark=(u,v)=>{let d=1-at(u,v)/255;if(invert)d=1-d;const val=Math.max(0,Math.min(1,(d-.5)*contrast+.5));return tone==='light'?Math.min(1,val*1.7):tone==='mid'?Math.max(0,1-Math.abs(val-.5)/.38):tone==='dark'?Math.max(0,(val-.5)/.5):tone==='light-mid'?Math.max(0,1-Math.abs(val-.3)/.3):tone==='mid-dark'?Math.max(0,1-Math.abs(val-.7)/.3):val;};
  const rows=Math.max(1,Math.floor(box.h/spacing)),n=Math.max(2,Math.ceil(box.w/pitch)),gapN=Math.max(2,Math.round(minGap/pitch)),runs=[];
  for(let j=0;j<rows;j++){const y=box.y+(j+.5)*box.h/rows,v=(j+.5)/rows,ltr=j%2===0,samples=[];
    for(let i=0;i<=n;i++){const u=ltr?i/n:1-i/n;samples.push({u,d:dark(u,v)});}
    // light stretches of at least minGap mm are not sewn: the row is cut there (the machine jumps across)
    const skip=new Array(samples.length).fill(false);for(let i=0;i<samples.length;){if(samples[i].d>=cutoff){i++;continue;}let e=i;while(e<samples.length&&samples[e].d<cutoff)e++;if(e-i>=gapN)for(let k=i;k<e;k++)skip[k]=true;i=e;}
    let cur=null,k=0;for(let i=0;i<samples.length;i++){if(skip[i]){cur=null;continue;}const {u,d}=samples[i],amp=d*spacing*.48,off=amp<.03?0:(k++%2?amp:-amp);if(!cur){cur=[];runs.push({pts:cur});}cur.push([box.x+u*box.w,y+off]);}}
  return runs.filter(r=>r.pts.length>=2);
}
