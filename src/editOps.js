// @ts-check
// Edits to objects and paths: array copies, corner rounding, simplify, split and join, reordering, redwork and thread replacement.
// The engine's document operations call these; it re-exports the names callers use.
import {geometry} from './outlines.js';
import {pathOutline,distP} from './pathGeometry.js';
import {refreshPathBounds,objectCenter,translateObject,normAngle} from './transforms.js';
import {rdp} from './geom.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {import('./transforms.js').Obj & {[key: string]: any}} Item */
/** @typedef {Item & {points: Pt[], thread: string, closed?: boolean, handles?: Array<{i: Pt, o: Pt}|null>, holes?: Pt[][]}} PathItem */
/** @typedef {{objects: Item[]}} Doc */

// Thread colour as a lower-case key. Objects reaching these edits have a thread.
/**
 * @param {Item} o
 * @returns {string}
 */
function threadKey(o){return /** @type {string} */(o.thread).toLowerCase();}

// Coordinates are stored to three decimals.
/**
 * @param {number} x
 * @param {number} y
 * @returns {Pt}
 */
function round3Pt(x,y){return [+x.toFixed(3),+y.toFixed(3)];}

// Replace each straight corner node by two nodes joined with a circular arc (cubic approximation) of the given radius; limited to half of each neighbouring
// segment.
/**
 * @param {PathItem} o
 * @param {number} radius
 * @param {number[]|null} [only]
 * @returns {void}
 */
export function roundPathCorners(o,radius,only=null){
  const n=o.points.length,pts=o.points.map(p=>/** @type {Pt} */([Number(p[0]),Number(p[1])]));
  /** @type {Array<{i: Pt, o: Pt}|null>} */
  const hs=o.handles?o.handles.map(h=>h||null):pts.map(()=>null);
  /** @type {Pt[]} */
  const outP=[];
  /** @type {Array<{i: Pt, o: Pt}|null>} */
  const outH=[];
  let changed=0;
  /** @type {(i: number) => boolean} */
  const straightOut=i=>{const h=hs[i];return !h||!h.o||(Math.abs(h.o[0]-pts[i][0])<1e-9&&Math.abs(h.o[1]-pts[i][1])<1e-9);};
  /** @type {(i: number) => boolean} */
  const straightIn=i=>{const h=hs[i];return !h||!h.i||(Math.abs(h.i[0]-pts[i][0])<1e-9&&Math.abs(h.i[1]-pts[i][1])<1e-9);};
  for(let i=0;i<n;i++){
    const inner=o.closed||(i>0&&i<n-1),pi=(i+n-1)%n,ni=(i+1)%n;
    if(!inner||(only&&!only.includes(i))||!straightIn(i)||!straightOut(i)||!straightOut(pi)||!straightIn(ni)){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const P=pts[i],A=pts[pi],B=pts[ni],l1=Math.hypot(A[0]-P[0],A[1]-P[1]),l2=Math.hypot(B[0]-P[0],B[1]-P[1]);
      if(l1<1e-6||l2<1e-6){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const u=[(A[0]-P[0])/l1,(A[1]-P[1])/l1],v=[(B[0]-P[0])/l2,(B[1]-P[1])/l2],cos=Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1])),th=Math.acos(cos);
    if(th<.06||th>Math.PI-.06){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const d=Math.min(radius/Math.tan(th/2),l1/2,l2/2),r=d*Math.tan(th/2),h=4/3*Math.tan((Math.PI-th)/4)*r,t1=[P[0]+u[0]*d,P[1]+u[1]*d],
      t2=[P[0]+v[0]*d,P[1]+v[1]*d];
    outP.push(round3Pt(t1[0],t1[1]),round3Pt(t2[0],t2[1]));
    outH.push({i:round3Pt(t1[0],t1[1]),o:round3Pt(t1[0]-u[0]*h,t1[1]-u[1]*h)},{i:round3Pt(t2[0]-v[0]*h,t2[1]-v[1]*h),o:round3Pt(t2[0],t2[1])});changed++;}
  if(!changed)throw Error('No straight corner nodes to round. Select a path with corners, or select the corner nodes.');
  if(outP.length>1000)throw Error('A path is limited to 1,000 points.');
  o.points=outP;o.handles=outH;refreshPathBounds(o);
}

// Position of a path node as a fraction (0..1) of the path's length.
/**
 * @param {PathItem} o
 * @param {number} index
 * @returns {number}
 */
export function nodeFraction(o,index){const line=pathOutline(o),P=o.points[index];
  /** @type {number[]} */
  const cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+distP(line[i],line[i-1]));const total=cum[cum.length-1]||1;let best=Infinity,at=0;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,u=l2?
    Math.max(0,Math.min(1,((P[0]-a[0])*dx+(P[1]-a[1])*dy)/l2)):0,d=Math.hypot(P[0]-a[0]-dx*u,P[1]-a[1]-dy*u);
    if(d<best-1e-9){best=d;at=cum[i-1]+Math.sqrt(l2)*u;}}return at/total;}

/**
 * @param {Item} src
 * @param {Pt|null} center
 * @param {Pt|null} pivot
 * @param {number} degrees
 * @param {{next: () => string}} ids
 * @returns {Item}
 */
function placeCopy(src,center,pivot,degrees,ids){const copy=structuredClone(src);delete copy.groupId;copy.id=ids.next();copy.name=`${src.name||'Object'} copy`;
  const c0=objectCenter(src),th=degrees*Math.PI/180;let target=/** @type {Pt} */(center);
  if(pivot){const dx=c0[0]-pivot[0],dy=c0[1]-pivot[1];target=[pivot[0]+dx*Math.cos(th)-dy*Math.sin(th),pivot[1]+dx*Math.sin(th)+dy*Math.cos(th)];}
  translateObject(copy,target[0]-c0[0],target[1]-c0[1]);if(degrees)copy.rotation=normAngle((Number(src.rotation)||0)+degrees);return copy;}

/**
 * @param {{ids?: unknown}} op
 * @param {number} [n]
 * @returns {{next: () => string}}
 */
function makeIds(op,n){const given=Array.isArray(op.ids)?op.ids:[];let i=0;return {next:()=>given[i++]||crypto.randomUUID()};}

/**
 * @param {Doc} doc
 * @param {Record<string, any>} op
 * @returns {void}
 */
export function arrayCopies(doc,op){const src=doc.objects.find(v=>v.id===op.id);if(!src)throw Error(`Unknown object: ${op.id}`);const n=
  Math.round(Number(op.count));if(!Number.isInteger(n)||n<2||n>60)throw Error('An array needs 2–60 copies in total (including the original).');
  if(doc.objects.length+n-1>100)throw Error('The array would exceed the 100-object limit.');
  const ids=makeIds(op);
  /** @type {Item[]} */
  const made=[];
  if(op.mode==='linear'){const dx=Number(op.dx),dy=Number(op.dy);
    if(![dx,dy].every(Number.isFinite)||(!dx&&!dy))throw Error('A linear array needs a non-zero dx/dy step in mm.');const c0=objectCenter(src);
    for(let k=1;k<n;k++)made.push(placeCopy(src,[c0[0]+dx*k,c0[1]+dy*k],null,0,ids));}
  else if(op.mode==='radial'){const pivot=/** @type {Pt} */([Number(op.cx),Number(op.cy)]),total=op.angle===undefined?360:Number(op.angle);
    if(![...pivot,total].every(Number.isFinite)||!total)throw Error('A radial array needs a centre (cx, cy) and a non-zero total angle.');const step=
    Math.abs(total)>=360?total/n:total/(n-1);for(let k=1;k<n;k++)made.push(placeCopy(src,null,pivot,step*k,ids));}
  else if(op.mode==='along'){const path=doc.objects.find(v=>v.id===op.pathId);
    if(!path||path.kind!=='path')throw Error(`The array path must be a path object: ${op.pathId}`);const ring=geometry(path,0)[0],cum=[0];
    for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const total=cum[cum.length-1];
    if(total<1e-6)throw Error('The path has no length.');
    /** @type {(t: number) => {p: Pt, deg: number}} */
    const at=t=>
      {let i=1;while(i<cum.length-1&&cum[i]<t)i++;const seg=cum[i]-cum[i-1]||1,f=(t-cum[i-1])/seg,a=ring[i-1],b=ring[i];
      return {p:/** @type {Pt} */([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]),deg:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI};};
    const rotate=op.rotate!==false,steps=path.closed?n:n-1;
    for(let k=0;k<n;k++){const {p,deg}=at(Math.min(total,total*k/steps));
      if(k===0){const c0=objectCenter(src);translateObject(src,p[0]-c0[0],p[1]-c0[1]);if(rotate)src.rotation=normAngle(deg);}else made.push(
      placeCopy(Object.assign(structuredClone(src),{id:src.id,rotation:rotate?0:src.rotation}),p,null,0,ids));
      if(k>0&&rotate)made[made.length-1].rotation=normAngle(deg);}}
  else throw Error(`Unknown array mode: ${op.mode}`);
  doc.objects.splice(doc.objects.indexOf(src)+1,0,...made);}

/**
 * @param {PathItem} o
 * @param {number} tol
 * @returns {void}
 */
export function simplifyPath(o,tol){if(o?.kind!=='path')throw Error('Simplify needs a path.');const t=Number(tol);
  if(!Number.isFinite(t)||t<=0||t>10)throw Error('Simplify tolerance must be between 0 and 10 mm.');const pts=o.points,min=o.closed?3:2;
  const out=o.closed?(()=>{const ring=[...pts,pts[0]],r=rdp(ring,t).slice(0,-1);return r;})():rdp(pts,t);if(out.length<min)return;o.points=
    out.map(([x,y])=>round3Pt(x,y));delete o.handles;refreshPathBounds(o);}

/**
 * @param {Doc} doc
 * @param {string} id
 * @param {number} index
 * @returns {void}
 */
export function splitPath(doc,id,index){const o=/** @type {PathItem} */(doc.objects.find(v=>v.id===id));
  if(!o||o.kind!=='path'||!Number.isInteger(index)||!o.points[index])throw Error(`Unknown path point: ${id}[${index}].`);const pts=o.points;
  if(o.closed){const rot=[...pts.slice(index),...pts.slice(0,index),pts[index]];Object.assign(o,{points:rot,closed:false,stitch:'run'});delete o.holes;
    delete o.handles;refreshPathBounds(o);return;}
  if(index===0||index===pts.length-1)throw Error('Split at an interior node of an open path.');const second=
    {...structuredClone(o),id:crypto.randomUUID(),name:`${o.name||'Path'} 2`,points:pts.slice(index)};delete second.handles;delete second.groupId;o.points=
    pts.slice(0,index+1);delete o.handles;refreshPathBounds(o);refreshPathBounds(second);doc.objects.splice(doc.objects.indexOf(o)+1,0,second);}

/**
 * @param {Doc} doc
 * @param {string[]} ids
 * @param {boolean} [close]
 * @returns {void}
 */
export function joinPaths(doc,ids,close){
  /** @type {PathItem[]} */
  const objs=(ids||[]).map(id=>
    {const o=/** @type {PathItem} */(doc.objects.find(v=>v.id===id));if(!o||o.kind!=='path'||o.closed)throw Error('Join works on open paths.');return o;});
  if(objs.length<2||new Set(ids).size!==ids.length)throw Error('Join needs at least two different open paths.');
  /** @type {(u: Pt, v: Pt) => number} */
  const d=(u,v)=>Math.hypot(u[0]-v[0],u[1]-v[1]);
  /** @type {(pts: Pt[]) => Pt[]} */
  const dedupe=pts=>pts.filter((p,i)=>!i||d(p,pts[i-1])>1e-6);
  let pts=[...objs[0].points];
  for(const o of objs.slice(1)){const q=o.points,rq=[...q].reverse(),
    best=[{dist:d(pts[pts.length-1],q[0]),out:[...pts,...q]},{dist:d(pts[pts.length-1],q[q.length-1]),out:[...pts,...rq]},
    {dist:d(pts[0],q[q.length-1]),out:[...q,...pts]},{dist:d(pts[0],q[0]),out:[...rq,...pts]}].sort((a,b)=>a.dist-b.dist)[0];pts=dedupe(best.out);}
  const first=objs[0];first.points=pts.map(([x,y])=>round3Pt(x,y));delete first.handles;
    if(close&&first.points.length>=4){first.closed=true;if(d(first.points[0],first.points[first.points.length-1])<1e-6)first.points.pop();}
  if(first.points.length>1000)throw Error('The joined path would exceed 1,000 points.');refreshPathBounds(first);doc.objects=
    doc.objects.filter(o=>o===first||!objs.includes(/** @type {PathItem} */(o)));}

/**
 * @param {Doc} doc
 * @param {string} id
 * @param {string} to
 * @param {number} [index]
 * @returns {void}
 */
export function reorderObject(doc,id,to,index){const i=doc.objects.findIndex(v=>v.id===id);if(i<0)throw Error(`Unknown object: ${id}`);
  if(index!==undefined){if(!Number.isInteger(index)||index<0||index>=doc.objects.length)throw Error('Reorder index is outside the object list.');const [m]=
  doc.objects.splice(i,1);doc.objects.splice(index,0,m);return;}const [o]=doc.objects.splice(i,1),n=doc.objects.length;const at=to==='front'?n:to==='back'?0:
  to==='forward'?Math.min(n,i+1):to==='backward'?Math.max(0,i-1):-1;
  if(at<0){doc.objects.splice(i,0,o);throw Error(`Unknown reorder target: ${to}`);}doc.objects.splice(at,0,o);}

// Redwork by colour: each selected path becomes a redwork run (run stitch, out and back), and the selected paths are moved together, grouped by thread in the
// order their threads first appear, at the place of the first one. Sewing follows object order, so each thread then sews as one block.
/**
 * @param {Doc} doc
 * @param {string[]} ids
 * @returns {void}
 */
export function redworkGroup(doc,ids){if(!Array.isArray(ids)||!ids.length)throw Error('Nothing to redwork.');const chosen=new Set(ids);
  if(chosen.size!==ids.length)throw Error('Each object can be chosen once.');const objs=doc.objects.filter(o=>chosen.has(o.id));
  if(objs.length!==chosen.size)throw Error('Unknown object in the redwork selection.');
  for(const o of objs){if(o.kind!=='path')throw Error('Redwork by colour needs paths: draw the outline as a path, or use Redwork outline on a closed shape.');
  o.stitch='run';o.runStyle='redwork';}
  /** @type {string[]} */
  const colours=[];for(const o of objs)if(!colours.includes(threadKey(o)))colours.push(threadKey(o));const grouped=
    colours.flatMap(c=>objs.filter(o=>threadKey(o)===c));const first=doc.objects.findIndex(o=>chosen.has(o.id));
    doc.objects=[...doc.objects.slice(0,first).filter(o=>!chosen.has(o.id)),...grouped,...doc.objects.slice(first).filter(o=>!chosen.has(o.id))];}

// Replace a thread everywhere: every object sewn in `from` (matched without case) takes `to`. Stitch layers keep the colours they were imported with.
/**
 * @param {Doc} doc
 * @param {string} from
 * @param {string} to
 * @returns {void}
 */
export function replaceThread(doc,from,to){const hex=/^#[0-9a-fA-F]{6}$/;
  if(typeof from!=='string'||typeof to!=='string'||!hex.test(from)||!hex.test(to))throw Error('Replace thread needs two colours as #rrggbb.');const f=
  from.toLowerCase(),t=to.toLowerCase();for(const o of doc.objects)if(o.kind!=='stitch_layer'&&o.thread&&o.thread.toLowerCase()===f)o.thread=t;}

/**
 * @param {Doc} doc
 * @returns {void}
 */
export function sortByColor(doc){
  /** @type {string[]} */
  const order=[];for(const o of doc.objects)if(!order.includes(threadKey(o)))order.push(threadKey(o));doc.objects=
    order.flatMap(c=>doc.objects.filter(o=>threadKey(o)===c));}
