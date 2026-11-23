// @ts-check
// Pure canvas geometry: element construction, point and segment tests, hit testing against an object's outline, snap
// candidates and the selection frame's local/world transforms and handle layout. Nothing here reads the viewport or the UI.
import {geometry,objectBounds,hoopSize} from './engine.js';

const SVG='http://www.w3.org/2000/svg';
export const el=(/** @type {any} */ tag,attrs={})=>{const n=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
export const union=(/** @type {any} */ bs)=>[Math.min(...bs.map((/** @type {any} */ b)=>b[0])),Math.min(...bs.map((/** @type {any} */ b)=>b[1])),
Math.max(...bs.map((/** @type {any} */ b)=>b[2])),Math.max(...bs.map((/** @type {any} */ b)=>b[3]))];
function pointInRing(/** @type {any} */ p,/** @type {any} */ ring){let inside=false;
for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];
if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;
}return inside;
}
function segDistance(/** @type {any} */ p,/** @type {any} */ a,/** @type {any} */ b){const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?
Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;
return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
}
// On a touch screen the handle marks are drawn at 6 px, so small lettering stays readable under them; their 44 px hit areas are unchanged.
export const touchPointer=()=>Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches);
// Candidates: ruler guides, the hoop centre and edges, and the edges/centres of the other objects.
export function snapCandidates(/** @type {any} */ d,/** @type {any} */ exclude){const hs=hoopSize(d),xs=[0,-hs.w/2,hs.w/2],ys=[0,-hs.h/2,hs.h/2];
for(const g of d.guides||[])(g.axis==='x'?xs:ys).push(g.pos);
  for(const o of d.objects){if(exclude.includes(o.id)||o.visible===false)continue;const b=objectBounds(o);xs.push(b[0],(b[0]+b[2])/2,b[2]);
    ys.push(b[1],(b[1]+b[3])/2,b[3]);if(o.kind==='path'&&Array.isArray(o.points))for(const q of o.points){xs.push(q[0]);ys.push(q[1]);}}return {xs,ys};}
export function bestDelta(/** @type {any} */ values,/** @type {any} */ cands,/** @type {any} */ tol){let best=null;
for(const v of values)for(const c of cands){const d=c-v;
if(Math.abs(d)<=tol&&(best===null||Math.abs(d)<Math.abs(best.d)))best={d,at:c};
}return best;
}
export function hitObject(/** @type {any} */ o,/** @type {any} */ p,/** @type {any} */ tol){
  if(o.kind==='stitch_layer'||o.kind==='text'){const b=objectBounds(o);return p[0]>=b[0]-tol&&p[0]<=b[2]+tol&&p[1]>=b[1]-tol&&p[1]<=b[3]+tol;}
  const lines=geometry(o);if(!lines.length)return false;
  const interior=o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed&&o.stitch==='fill');
  if(interior){let inside=false;for(const ring of lines)if(pointInRing(p,ring))inside=!inside;if(inside)return true;}
  const reach=Math.max(tol,(o.stitch==='satin'?(o.satinWidth??3)/2:0));
  for(const line of lines)for(let i=1;i<line.length;i++)if(segDistance(p,line[i-1],line[i])<=reach)return true;
  return false;
}
export const toWorld=(/** @type {any} */ f,/** @type {any} */ lx,/** @type {any} */ ly)=>{const co=Math.cos(f.rot),si=Math.sin(f.rot);
return [f.c[0]+lx*co-ly*si,f.c[1]+lx*si+ly*co];
};
export const toLocal=(/** @type {any} */ f,/** @type {any} */ p)=>{const co=Math.cos(f.rot),si=Math.sin(f.rot),dx=p[0]-f.c[0],dy=p[1]-f.c[1];
return [dx*co+dy*si,-dx*si+dy*co];
};
/** @type {Array<[string, number, number]>} */
export const HANDLES=[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]];
/** @type {Record<string, string>} */
export const HANDLE_LABEL=
  {nw:'Resize from north-west corner',n:'Resize from north edge',ne:'Resize from north-east corner',e:'Resize from east edge',se:
  'Resize from south-east corner',s:'Resize from south edge',sw:'Resize from south-west corner',w:'Resize from west edge',rot:'Rotate selection'};
