// @ts-check
// Path geometry and clipping: corner rounding, a node's position along a path, clipping to a mask, lettering on a path, and translation.
import {polygonClipping} from './geom.js';
import {geometry,mapPathPoints,pathOutline,refreshPathBounds,distP} from './engine.js';
// Replace each straight corner node by two nodes joined with a circular arc (cubic approximation) of the given radius; limited to half of each neighbouring segment.
export function roundPathCorners(/** @type {any} */ o,/** @type {any} */ radius,/** @type {any} */ only=null){
  const n=o.points.length,pts=o.points.map((/** @type {any} */ p)=>[Number(p[0]),Number(p[1])]),hs=o.handles?o.handles.map((/** @type {any} */ h)=>h||null):pts.map(()=>null),outP=[],outH=[];let changed=0;
  const straightOut=(/** @type {any} */ i)=>!hs[i]||!hs[i].o||(Math.abs(hs[i].o[0]-pts[i][0])<1e-9&&Math.abs(hs[i].o[1]-pts[i][1])<1e-9),straightIn=(/** @type {any} */ i)=>!hs[i]||!hs[i].i||(Math.abs(hs[i].i[0]-pts[i][0])<1e-9&&Math.abs(hs[i].i[1]-pts[i][1])<1e-9);
  for(let i=0;i<n;i++){
    const inner=o.closed||(i>0&&i<n-1),pi=(i+n-1)%n,ni=(i+1)%n;
    if(!inner||(only&&!only.includes(i))||!straightIn(i)||!straightOut(i)||!straightOut(pi)||!straightIn(ni)){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const P=pts[i],A=pts[pi],B=pts[ni],l1=Math.hypot(A[0]-P[0],A[1]-P[1]),l2=Math.hypot(B[0]-P[0],B[1]-P[1]);if(l1<1e-6||l2<1e-6){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const u=[(A[0]-P[0])/l1,(A[1]-P[1])/l1],v=[(B[0]-P[0])/l2,(B[1]-P[1])/l2],cos=Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1])),th=Math.acos(cos);
    if(th<.06||th>Math.PI-.06){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const d=Math.min(radius/Math.tan(th/2),l1/2,l2/2),r=d*Math.tan(th/2),h=4/3*Math.tan((Math.PI-th)/4)*r,t1=[P[0]+u[0]*d,P[1]+u[1]*d],t2=[P[0]+v[0]*d,P[1]+v[1]*d],q=(/** @type {any} */ x)=>+x.toFixed(3);
    outP.push([q(t1[0]),q(t1[1])],[q(t2[0]),q(t2[1])]);
    outH.push({i:[q(t1[0]),q(t1[1])],o:[q(t1[0]-u[0]*h),q(t1[1]-u[1]*h)]},{i:[q(t2[0]-v[0]*h),q(t2[1]-v[1]*h)],o:[q(t2[0]),q(t2[1])]});changed++;}
  if(!changed)throw Error('No straight corner nodes to round. Select a path with corners, or select the corner nodes.');
  if(outP.length>1000)throw Error('A path is limited to 1,000 points.');
  o.points=outP;o.handles=outH;refreshPathBounds(o);
}
// Position of a path node as a fraction (0..1) of the path's length.
export function nodeFraction(/** @type {any} */ o,/** @type {any} */ index){const line=pathOutline(o),P=o.points[index],cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+distP(line[i],line[i-1]));const total=cum.at(-1)||1;let best=Infinity,at=0;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,u=l2?Math.max(0,Math.min(1,((P[0]-a[0])*dx+(P[1]-a[1])*dy)/l2)):0,d=Math.hypot(P[0]-a[0]-dx*u,P[1]-a[1]-dy*u);if(d<best-1e-9){best=d;at=cum[i-1]+Math.sqrt(l2)*u;}}return at/total;}
export function decodeBase64(/** @type {any} */ s){const B=/** @type {any} */ (globalThis).Buffer;if(typeof B!=='undefined')return new Uint8Array(B.from(s,'base64'));const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
// Geometry clipping to a mask: closed outlines are intersected exactly; runs of stitches are cut where they leave the mask.
export const closeRing=(/** @type {any} */ r)=>{const q=r.map((/** @type {any[]} */ [x,y])=>[x,y]);if(q.length&&(q[0][0]!==q.at(-1)[0]||q[0][1]!==q.at(-1)[1]))q.push([...q[0]]);return q;};
export function clipLines(/** @type {any} */ lines,/** @type {any} */ maskLines){const poly=(/** @type {any} */ ls)=>ls.filter((/** @type {any} */ l)=>l.length>=3).map(closeRing),a=poly(lines),b=poly(maskLines);if(!a.length||!b.length)return [];
  try{return /** @type {any} */ (polygonClipping).intersection(a,b).flatMap((/** @type {any} */ pg)=>pg.map((/** @type {any} */ r)=>r.map((/** @type {any[]} */ [x,y])=>[x,y])));}catch{return [];}}
export function insideRings(/** @type {any} */ rings,/** @type {any} */ p){let inside=false;for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
// edgeClose: each cut end gets a short back-stitch over its last segment, so a cut run closes on the mask edge.
export function clipRuns(/** @type {any} */ runs,/** @type {any} */ rings,edgeClose=false){
  const edges=[];for(const r of rings)for(let i=1;i<r.length;i++)edges.push([r[i-1],r[i]]);const out=/** @type {any[]} */ ([]);
  for(const run of runs){let cur=/** @type {any} */ (null),first=true;const flush=()=>{if(cur&&cur.length>1){const pts=edgeClose&&cur.length>2?[...cur,...cur.slice(-3,-1).reverse()]:cur;out.push({...run,pts,jump:first?run.jump:true});}first=false;cur=null;};
    const pts=run.pts;if(pts.length<2)continue;
    if(insideRings(rings,pts[0])){cur=[pts[0]];}
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],ts=[0,1],dx=b[0]-a[0],dy=b[1]-a[1];
      for(const [c,d] of edges){const ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;if(t>1e-9&&t<1-1e-9&&u>=0&&u<=1)ts.push(t);}
      ts.sort((x,y)=>x-y);
      for(let k=1;k<ts.length;k++){const t0=ts[k-1],t1=ts[k];if(t1-t0<1e-9)continue;const p0=[a[0]+dx*t0,a[1]+dy*t0],p1=[a[0]+dx*t1,a[1]+dy*t1],mid=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2];
        if(insideRings(rings,mid)){if(!cur)cur=[p0];cur.push(p1);}else flush();}}
    flush();}
  return out;}
// Clipping masks: a clipped object is sewn only inside its mask (a closed shape that is itself not sewn). Dangling links are cleaned up after every edit.
// A closed shape: a rectangle, an ellipse or a closed path. Clip masks and appliqué from a group use only these.
export const isClosedShape=(/** @type {any} */ o)=>Boolean(o)&&(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed));
export function refreshClips(/** @type {any} */ doc){const ids=new Set(doc.objects.map((/** @type {any} */ o)=>o.id));for(const o of doc.objects)if(o.clipId&&(!ids.has(o.clipId)||o.clipId===o.id||!isClosedShape(doc.objects.find((/** @type {any} */ v)=>v.id===o.clipId))))delete o.clipId;const used=new Set(doc.objects.map((/** @type {any} */ o)=>o.clipId).filter(Boolean));for(const o of doc.objects){if(o.mask&&!used.has(o.id))delete o.mask;else if(!o.mask&&used.has(o.id))o.mask=true;}}
// Lettering attached to a path keeps following it: the path's outline is re-read whenever the path changes (moving the lettering itself does not reattach it).
export const pathSig=(/** @type {any} */ p)=>JSON.stringify([p.points,p.handles,p.closed,p.smooth,p.rotation]);
export function alongPoints(/** @type {any} */ p){const raw=geometry(p,0)[0],/** @type {any[]} */ pts=[];for(const q of raw)if(!pts.length||Math.hypot(q[0]-pts.at(-1)[0],q[1]-pts.at(-1)[1])>1e-6)pts.push([+q[0].toFixed(3),+q[1].toFixed(3)]);if(p.closed&&pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();if(pts.length<2||pts.length>1500)throw Error('The path needs 2–1,500 points after smoothing.');return pts;}
export function refreshAlong(/** @type {any} */ doc){for(const t of doc.objects){if(t.kind!=='text'||!t.along?.pathId)continue;const p=doc.objects.find((/** @type {any} */ v)=>v.id===t.along.pathId);if(!p||p.kind!=='path'){delete t.along.pathId;delete t.along.sig;continue;}const sig=pathSig(p);if(t.along.sig!==sig){try{t.along.points=alongPoints(p);t.along.closed=Boolean(p.closed);t.along.sig=sig;}catch{}}}}
export function translateObject(/** @type {any} */ o,/** @type {any} */ dx,/** @type {any} */ dy){o.x+=dx;o.y+=dy;if(o.along)o.along.points=o.along.points.map((/** @type {any[]} */ [x,y])=>[x+dx,y+dy]);if(o.kind==='path')mapPathPoints(o,(/** @type {any[]} */ [x,y])=>[x+dx,y+dy]);}
// Edge travel for fills: when two points lie on the same outline (outer edge or hole edge), walk the shorter way round it
// with running stitches instead of jumping, but only for short detours (≤ 10 mm); long ones stay jumps because edge stitches would clutter the fill. The route follows the border, where later rows or the border pass cover it.
export function locateOnRing(/** @type {any} */ ring,/** @type {any} */ p,eps=.05){let arc=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy,len=Math.sqrt(len2);if(len2>0){const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2));if(Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)<=eps)return arc+len*t;}arc+=len;}return null;}
export function ringRoute(/** @type {any} */ rings,/** @type {any} */ p,/** @type {any} */ q,maxLength=10){for(const ring of rings){const s1=locateOnRing(ring,p),s2=locateOnRing(ring,q);if(s1===null||s2===null)continue;
  const cum=[0];for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const L=/** @type {number} */ (cum.at(-1));if(L<=0)continue;
  const fwd=(s2-s1+L)%L,back=L-fwd,forward=fwd<=back,dist=Math.min(fwd,back);if(dist>maxLength)return null;
  const out=[];if(forward){for(let i=0;i<ring.length-1;i++){const pos=(cum[i]-s1+L)%L;if(pos>1e-6&&pos<fwd-1e-6)out.push({pos,pt:ring[i]});}}else{for(let i=ring.length-2;i>=0;i--){const pos=(s1-cum[i]+L)%L;if(pos>1e-6&&pos<back-1e-6)out.push({pos,pt:ring[i]});}}
  out.sort((a,b)=>a.pos-b.pos);return [...out.map(o=>o.pt),q];}return null;}
