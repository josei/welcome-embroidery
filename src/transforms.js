// @ts-check
// Object transforms: move, rotate, flip, scale and convert objects, with their bounds and centre. The engine re-exports objectBounds
// and imports the rest for its document operations.
import {geometry,textPrimitives} from './outlines.js';
import {isRegistryFont,getFont} from './fonts.js';
import {rdp} from './geom.js';

/** @typedef {import('./geom.js').Pt} Pt */
/**
 * @typedef {{id: string, name?: string, kind: string, x: number, y: number, w: number, h: number, rotation?: number, locked?: boolean, bold?: number,
  * tracking?: number, wordSpacing?: number, points?: Pt[], holes?: Pt[][], handles?: Array<{i: Pt, o: Pt}|null>, closed?: boolean, along?: {points: Pt[],
  * closed?: boolean, offset?: number}, font?: string, text?: string, thread?: string, stitch?: string, groupId?: string, visible?: boolean, border?: boolean,
  * borderThread?: string, angle?: number, spacing?: number, satinWidth?: number, satinWidthEnd?: number, radius?: number, radii?: number[], widthStops?:
  * Array<[number, number]>, applique?: boolean, joinKind?: string}} Obj
 * @typedef {{objects: Obj[]}} Doc
 */

/**
 * @param {Obj} o
 * @param {number} dx
 * @param {number} dy
 * @returns {void}
 */
export function translateObject(o,dx,dy){o.x+=dx;
o.y+=dy;
if(o.along)o.along.points=o.along.points.map(([x,y])=>[x+dx,y+dy]);
if(o.kind==='path')mapPathPoints(o,([x,y])=>[x+dx,y+dy]);
}
/**
 * @param {Obj} o
 * @returns {Pt}
 */
export function objectCenter(o){const unrotated={...o};
delete unrotated.rotation;
const pts=geometry(unrotated).flat();
if(o.kind==='stitch_layer'||!pts.length)return [o.x+o.w/2,o.y+o.h/2];
const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
}
/** @type {(a: number) => number} */
export const normAngle=a=>{let r=((a%360)+360)%360;
return r>180?r-360:r;
};
// ---- Direct-manipulation transforms (selection handles, nudging, flip, convert to path) ---------------------
/** @type {(p: Pt, c: Pt, th: number) => Pt} */
const rotatePoint=(p,c,th)=>{const dx=p[0]-c[0],dy=p[1]-c[1],co=Math.cos(th),si=Math.sin(th);
return [c[0]+dx*co-dy*si,c[1]+dx*si+dy*co];
};
/**
 * @param {Obj} o
 * @returns {void}
 */
function bakeRotation(o){if(!o.rotation||o.kind!=='path')return;
const c=objectCenter(o),th=o.rotation*Math.PI/180;
mapPathPoints(o,p=>rotatePoint(p,c,th));
delete o.rotation;
refreshPathBounds(o);
}
/**
 * @param {Doc} doc
 * @param {string} id
 * @returns {Obj}
 */
export function objById(doc,id){const o=doc.objects.find(v=>v.id===id);
if(!o)throw Error(`Unknown object: ${id}`);
return o;
}
/**
 * @param {Obj} o
 * @returns {{points: Pt[], handles: Array<{i: Pt, o: Pt}>}}
 */
function ellipseToPath(o){const cx=o.x+o.w/2,cy=o.y+o.h/2,rx=o.w/2,ry=o.h/2,k=.5522847498,th=(Number(o.rotation)||0)*Math.PI/180,c=/** @type {Pt} */([cx,cy]);
  /** @type {(p: Pt) => Pt} */
  const R=p=>th?rotatePoint(p,c,th):p;
const nodes=/** @type {Pt[]} */([[cx+rx,cy],[cx,cy+ry],[cx-rx,cy],[cx,cy-ry]]),
  hs=[[[cx+rx,cy-ry*k],[cx+rx,cy+ry*k]],[[cx+rx*k,cy+ry],[cx-rx*k,cy+ry]],[[cx-rx,cy+ry*k],[cx-rx,cy-ry*k]],[[cx-rx*k,cy-ry],[cx+rx*k,cy-ry]]];
return {points:nodes.map(R),handles:hs.map(([i,out])=>({i:R(/** @type {Pt} */(i)),o:R(/** @type {Pt} */(out))}))};
}
// Convert a rectangle, ellipse or text into editable path(s). Rotation is baked into the points; the first result keeps the object's id.
/**
 * @param {Doc} doc
 * @param {string} id
 * @returns {void}
 */
export function toPathObject(doc,id){
const o=objById(doc,id),at=doc.objects.indexOf(o);
if(o.kind==='path')return;
if(o.kind==='stitch_layer')throw Error('Imported stitch layers cannot be converted to a path.');
const common=
  {thread:o.thread,stitch:o.stitch==='satin'?'fill':o.stitch,...(o.border?{border:true,borderThread:o.borderThread}:{}),...(o.groupId?{groupId:o.groupId}:{}),
  ...(o.visible===false?{visible:false}:{}),...(o.locked?{locked:true}:{})};
const keep=Object.fromEntries(/** @type {Array<'angle'|'spacing'>} */(['angle','spacing']).filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
if(o.kind==='rect'||o.kind==='ellipse'){
const base={id:o.id,name:o.name,kind:'path',x:0,y:0,w:0,h:0,closed:true,...common,...keep};
if(o.kind==='rect'){const ring=geometry(o)[0].slice(0,-1).map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]);
Object.assign(base,{points:ring});
}
else{const e=ellipseToPath(o);
Object.assign(base,{points:e.points.map(p=>p.map(v=>+v.toFixed(3))),handles:e.handles.map(h=>({i:h.i.map(v=>+v.toFixed(3)),o:h.o.map(v=>+v.toFixed(3))}))});
}
doc.objects[at]=base;
refreshPathBounds(base);
return;
}
// lettering -> one path per stitch primitive, grouped
let prims;
if(o.kind==='text'&&isRegistryFont(o.font)){prims=textPrimitives(/** @type {import('./outlines.js').Lettering} */(o));
if(!prims)throw Error('Load the font before converting this text.');
}
else prims=geometry(o).map(pts=>/** @type {import('./textlayout.js').Prim} */({t:'r',pts}));
/** @type {(r: Pt[]) => Pt[]} */
  const tidy=r=>{let pts=r.map(([x,y])=>/** @type {Pt} */([+x.toFixed(3),+y.toFixed(3)]));
if(pts.length>1&&pts[0][0]===pts[pts.length-1][0]&&pts[0][1]===pts[pts.length-1][1])pts.pop();
return pts;
};
/** @type {(pts: Pt[], max: number) => Pt[]} */
  const limited=(pts,max)=>{let r=pts,tol=.02;
while(r.length>max&&tol<2){r=simplifyRing(pts,tol);
tol*=1.8;
}return r;
};
/** @type {Array<Partial<Obj>>} */ const made=[];
const gid=crypto.randomUUID();
for(const pr of prims){
if(pr.t==='f'){const [outer,...holes]=pr.rings.map(tidy).map((r,i)=>limited(r,i?200:1000));
if(outer.length<3)continue;
made.push(
  {kind:'path',points:outer,closed:true,...(holes.length?{holes:holes.filter(h=>h.length>=3).slice(0,20)}:{}),...common,stitch:o.stitch==='run'?'run':'fill'});
}
else if(pr.t==='s'){const band=tidy([...pr.a,...[...pr.b].reverse()]);
if(band.length>=3)made.push({kind:'path',points:limited(band,1000),closed:true,...common,stitch:'fill'});
}
else if(pr.pts.length>=2)made.push(
  {kind:'path',points:limitedOpen(pr.pts.map(([x,y])=>/** @type {Pt} */([+x.toFixed(3),+y.toFixed(3)]))),closed:false,...common,stitch:'run'});
}
if(!made.length)throw Error('This text has no outlines to convert.');
if(doc.objects.length-1+made.length>100)throw Error(`Converting would create ${made.length} objects and exceed the 100-object limit; shorten the text first.`);
made.forEach((m,i)=>
  {m.id=i?crypto.randomUUID():o.id;m.name=`${(o.name||'Text').replace(/^(Text|Lettering): /,'')} ${i+1}`;m.w=0;m.h=0;m.x=0;m.y=0;
  if(made.length>1&&!m.groupId)m.groupId=gid;refreshPathBounds(/** @type {Obj} */(m));});
doc.objects.splice(at,1,.../** @type {Obj[]} */(made));
}
/** @type {(pts: Pt[], tol: number) => Pt[]} */
const simplifyRing=(pts,tol)=>{const r=rdp([...pts,pts[0]],tol).slice(0,-1);
return r.length>=3?r:pts;
};
/**
 * @param {Pt[]} pts
 * @returns {Pt[]}
 */
function limitedOpen(pts){let r=pts,tol=.02;
while(r.length>1000&&tol<2){r=rdp(pts,tol);
tol*=1.8;
}return r;
}
/**
 * @param {Obj} o
 * @returns {number[]}
 */
function textRange(o){if(isRegistryFont(o.font)){const f=getFont(o.font);
return f?[f.size*f.minScale,f.size*f.maxScale]:[2,200];
}return o.font==='neon-blinking/1'?[20,60]:[4,16];
}
// Scale objects about (ox,oy). Rotated rectangles/ellipses are converted to paths for non-uniform scaling so the result is exact.
/**
 * @param {Doc} doc
 * @param {string[]} ids
 * @param {number} sx
 * @param {number} sy
 * @param {number} ox
 * @param {number} oy
 * @returns {void}
 */
export function scaleObjects(doc,ids,sx,sy,ox,oy){
if(![sx,sy,ox,oy].every(Number.isFinite)||Math.abs(sx)<.01||Math.abs(sy)<.01||Math.abs(sx)>100||Math.abs(sy)>100)throw Error(
  'Scale factors must be between 0.01 and 100 (not zero).');
if(!Array.isArray(ids)||!ids.length)throw Error('Nothing to scale.');
/** @type {(x: number, y: number) => Pt} */
  const f=(x,y)=>[ox+(x-ox)*sx,oy+(y-oy)*sy],uniform=Math.abs(Math.abs(sx)-Math.abs(sy))<1e-6,ax=Math.abs(sx),ay=Math.abs(sy);
for(const id of ids){let o=objById(doc,id);
if((o.kind==='rect'||o.kind==='ellipse')&&o.rotation&&!uniform){toPathObject(doc,id);
o=objById(doc,id);
}
if(o.kind==='path'){bakeRotation(o);
mapPathPoints(o,([x,y])=>f(x,y));
if(o.satinWidth)o.satinWidth=Math.max(.5,Math.min(12,o.satinWidth*Math.sqrt(ax*ay)));
if(o.satinWidthEnd)o.satinWidthEnd=Math.max(.5,Math.min(12,o.satinWidthEnd*Math.sqrt(ax*ay)));
refreshPathBounds(o);
}
else if(o.kind==='rect'||o.kind==='ellipse'||o.kind==='stitch_layer'){const [cx,cy]=f(o.x+o.w/2,o.y+o.h/2);
o.w=o.w*ax;
o.h=o.h*ay;
o.x=cx-o.w/2;
o.y=cy-o.h/2;
if(o.radius)o.radius=+(o.radius*Math.min(ax,ay)).toFixed(3);
if(Array.isArray(o.radii))o.radii=o.radii.map(v=>+((Number(v)||0)*Math.min(ax,ay)).toFixed(3));
}
else if(o.kind==='text'){const [lo,hi]=textRange(o),h=Math.max(lo,Math.min(hi,o.h*ay)),np=f(o.x,o.y);
if(o.along)o.along.points=o.along.points.map(([x,y])=>f(x,y));
o.w=Math.min(1000,Math.max(.5,o.w*ax));
o.h=+h.toFixed(3);
o.x=np[0];
o.y=np[1];
for(const k of /** @type {Array<'tracking'|'wordSpacing'>} */(['tracking','wordSpacing']))if(o[k])o[k]*=ax;
if(o.bold)o.bold=Math.min(3,o.bold*ay);
}
}
}
/**
 * @param {Doc} doc
 * @param {string[]} ids
 * @param {number} angle
 * @param {number} cx
 * @param {number} cy
 * @returns {void}
 */
export function rotateObjects(doc,ids,angle,cx,cy){
if(![angle,cx,cy].every(Number.isFinite))throw Error('Rotation needs an angle and a pivot.');
const th=angle*Math.PI/180;
for(const id of ids){const o=objById(doc,id),c0=objectCenter(o),c1=rotatePoint(c0,[cx,cy],th);
translateObject(o,c1[0]-c0[0],c1[1]-c0[1]);
o.rotation=normAngle((Number(o.rotation)||0)+angle);
}
}
/**
 * @param {Doc} doc
 * @param {string[]} ids
 * @param {string} axis
 * @param {number|null} [pivotRaw]
 * @returns {void}
 */
export function flipObjects(doc,ids,axis,pivotRaw){
if(axis!=='horizontal'&&axis!=='vertical')throw Error('Flip axis must be horizontal or vertical.');
const objs=ids.map(id=>objById(doc,id));
for(const o of objs)if(o.kind==='text'||o.kind==='stitch_layer')throw Error(
  'Text and imported stitch layers cannot be flipped; convert text to paths first.');
const bs=objs.map(objectBounds),pivot=
  pivotRaw??(axis==='horizontal'?(Math.min(...bs.map(b=>b[0]))+Math.max(...bs.map(b=>b[2])))/2:(Math.min(...bs.map(b=>b[1]))+Math.max(...bs.map(b=>b[3])))/2);
/** @type {(p: Pt) => Pt} */
  const m=([x,y])=>axis==='horizontal'?[2*pivot-x,y]:[x,2*pivot-y];
for(const o of objs){if(o.kind==='path'){bakeRotation(o);
mapPathPoints(o,m);
refreshPathBounds(o);
}else{const c=/** @type {Pt} */([o.x+o.w/2,o.y+o.h/2]),nc=m(c);
o.x=nc[0]-o.w/2;
o.y=nc[1]-o.h/2;
if(o.rotation)o.rotation=normAngle(-o.rotation);
}}
}
/**
 * @param {Obj} o
 * @param {(p: Pt) => Pt} fn
 * @returns {void}
 */
export function mapPathPoints(o,fn){o.points=/** @type {Pt[]} */(o.points).map(p=>fn(p));
if(o.holes)o.holes=o.holes.map(h=>h.map(p=>fn(p)));
if(o.handles)o.handles=o.handles.map(h=>h?{i:fn(h.i),o:fn(h.o)}:h);
}
/**
 * @param {Obj} o
 * @returns {void}
 */
export function refreshPathBounds(o){const xs=/** @type {Pt[]} */(o.points).map(p=>p[0]),ys=/** @type {Pt[]} */(o.points).map(p=>p[1]);
o.x=Math.min(...xs);
o.y=Math.min(...ys);
o.w=Math.max(...xs)-o.x;
o.h=Math.max(...ys)-o.y;
}
/**
 * @param {Obj} o
 * @returns {number[]}
 */
export function objectBounds(o){const pts=geometry(o).flat();
if(!pts.length)return [o.x,o.y,o.x+o.w,o.y+o.h];
return [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];
}
