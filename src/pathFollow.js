// @ts-check
// Things that follow a path: lettering attached to a path keeps its outline, and edge travel walks the short way round a fill's outline.
// The engine's document refresh and fill steps call these.
import {geometry} from './outlines.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {import('./transforms.js').Obj & {[key: string]: any}} Item */
/** @typedef {Item & {along?: {pathId?: string, sig?: string, points?: Pt[], closed?: boolean}}} TextItem */
/** @typedef {{objects: TextItem[]}} Doc */

// Lettering attached to a path keeps following it: the path's outline is re-read whenever the path changes (moving the lettering itself does not reattach it).
/** @type {(p: Item) => string} */
export const pathSig=p=>JSON.stringify([p.points,p.handles,p.closed,p.smooth,p.rotation]);
/**
 * @param {Item} p
 * @returns {Pt[]}
 */
export function alongPoints(p){const raw=geometry(p,0)[0];
  /** @type {Pt[]} */
  const pts=[];
    for(const q of raw)if(!pts.length||Math.hypot(q[0]-pts[pts.length-1][0],q[1]-pts[pts.length-1][1])>
    1e-6)pts.push(/** @type {Pt} */([+q[0].toFixed(3),+q[1].toFixed(3)]));
    if(p.closed&&pts.length>1&&pts[0][0]===pts[pts.length-1][0]&&pts[0][1]===pts[pts.length-1][1])pts.pop();
    if(pts.length<2||pts.length>1500)throw Error('The path needs 2–1,500 points after smoothing.');return pts;}

/**
 * @param {Doc} doc
 * @returns {void}
 */
export function refreshAlong(doc){
  for(const t of doc.objects){if(t.kind!=='text'||!t.along?.pathId)continue;const along=/** @type {NonNullable<TextItem['along']>} */(t.along);const p=
  doc.objects.find(v=>v.id===along.pathId);if(!p||p.kind!=='path'){delete t.along.pathId;delete t.along.sig;continue;}const sig=pathSig(p);
  if(t.along.sig!==sig){try{t.along.points=alongPoints(p);t.along.closed=Boolean(p.closed);t.along.sig=sig;}catch{}}}}

// Edge travel for fills: when two points lie on the same outline (outer edge or hole edge), walk the shorter way round it
// with running stitches instead of jumping, but only for short detours (≤ 10 mm); long ones stay jumps because edge stitches would clutter the fill. The route
// follows the border, where later rows or the border pass cover it.
/**
 * @param {Pt[]} ring
 * @param {Pt} p
 * @param {number} [eps]
 * @returns {number|null}
 */
function locateOnRing(ring,p,eps=.05){let arc=0;
  for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy,len=Math.sqrt(len2);
  if(len2>0){const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2));if(Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)<=eps)return arc+len*t;}arc+=len;
  }return null;}

/**
 * @param {Pt[][]} rings
 * @param {Pt} p
 * @param {Pt} q
 * @param {number} [maxLength]
 * @returns {Pt[]|null}
 */
export function ringRoute(rings,p,q,maxLength=10){
  for(const ring of rings){const s1=locateOnRing(ring,p),s2=locateOnRing(ring,q);if(s1===null||s2===null)continue;
  const cum=[0];for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const L=cum[cum.length-1];
    if(L<=0)continue;
  const fwd=(s2-s1+L)%L,back=L-fwd,forward=fwd<=back,dist=Math.min(fwd,back);if(dist>maxLength)return null;
  /** @type {Array<{pos: number, pt: Pt}>} */
  const out=[];
    if(forward){for(let i=0;i<ring.length-1;i++){const pos=(cum[i]-s1+L)%L;if(pos>1e-6&&pos<fwd-1e-6)out.push({pos,pt:ring[i]});}}else{
    for(let i=ring.length-2;i>=0;i--){const pos=(s1-cum[i]+L)%L;if(pos>1e-6&&pos<back-1e-6)out.push({pos,pt:ring[i]});}}
  out.sort((a,b)=>a.pos-b.pos);return [...out.map(o=>o.pt),q];}return null;}
