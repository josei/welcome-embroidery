// @ts-check
// Shape operations: boolean (union, intersect, subtract, xor), knife cuts, offset and stroke-to-shape on closed shapes. Each replaces
// its operands with the resulting polygons. The engine calls these from its document operations.
import {polygonClipping,bufferSegments,closedRing} from './geom.js';
import {geometry} from './outlines.js';
import {objectBounds,objById,refreshPathBounds} from './transforms.js';
import {shapeArea} from './designChecks.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {import('./transforms.js').Obj} Obj */
/** @typedef {import('./transforms.js').Doc} Doc */

// Boolean shape operations on closed shapes (rectangle, ellipse, closed path, with holes) using polygon-clipping.
// The result replaces the operands: the first result polygon keeps the first operand's id, further pieces get new ids.
/**
 * @param {Doc} doc
 * @param {string} mode
 * @param {string[]} ids
 * @returns {void}
 */
export function booleanShapes(doc,mode,ids){
  if(!['union','intersect','subtract','xor'].includes(mode))throw Error(`Unknown boolean mode: ${mode}`);if(!Array.isArray(ids)||ids.length<2||new Set(ids).size!==ids.length)throw Error('A boolean operation needs at least two different objects.');
  const objs=ids.map(id=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);if(o.kind==='text'||o.kind==='stitch_layer'||(o.kind==='path'&&!o.closed))throw Error('Boolean operations work on closed shapes: rectangle, ellipse or closed path.');return o;});
  /** @type {(r: Pt[]) => Pt[]} */
  const ring=r=>{const pts=r.map(([x,y])=>/** @type {Pt} */([x,y]));if(pts.length>1&&pts[0][0]===pts[pts.length-1][0]&&pts[0][1]===pts[pts.length-1][1])pts.pop();return pts;};
  const polys=objs.map(o=>geometry(o,0).map(ring)),[first,...rest]=polys;
  const result=(mode==='union'?polygonClipping.union:mode==='intersect'?polygonClipping.intersection:mode==='xor'?polygonClipping.xor:polygonClipping.difference)(first,...rest);
  if(!result.length)throw Error(mode==='intersect'?'The shapes do not overlap, so the intersection is empty.':'The result is empty.');
  replaceWithPolygons(doc,objs[0],objs,result);
}

// Knife: cut a closed shape along the straight line through two points. The cut is a thin strip (0.02 mm) along that line, extended past the shape's bounds, subtracted from the shape; the pieces then become separate objects, as with booleans. A line that does not cut the shape is refused.
// Knife: cut a closed shape along a polyline (two or more points). Each segment is a thin strip (0.02 mm wide), extended a little at both ends so the strips overlap at the joints, and the strips are subtracted from the shape; the pieces become separate objects, as with booleans. The first and last segments reach past the shape's bounds. A line that does not cut the shape is refused, and so is a polyline that crosses itself.
/** @type {(p1: Pt, p2: Pt, p3: Pt, p4: Pt) => boolean} */
const segmentsCross=(p1,p2,p3,p4)=>{
/** @type {(a: Pt, b: Pt, c: Pt) => number} */ const d=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const d1=d(p3,p4,p1),d2=d(p3,p4,p2),d3=d(p1,p2,p3),d4=d(p1,p2,p4);return d1*d2<0&&d3*d4<0;};

/**
 * @param {Doc} doc
 * @param {string} id
 * @param {Pt[]} points
 * @returns {void}
 */
export function knifeShape(doc,id,points){
  const o=objById(doc,id);
  if(!(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed)))throw Error('Knife cuts a closed shape: a rectangle, an ellipse or a closed path.');
  if(!Array.isArray(points)||points.length<2||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('The knife needs two or more points.');
  for(let i=1;i<points.length;i++)if(Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])<1e-6)throw Error('The knife needs two different points.');
  for(let i=0;i<points.length-1;i++)for(let j=i+2;j<points.length-1;j++)if(segmentsCross(points[i],points[i+1],points[j],points[j+1]))throw Error('The knife line crosses itself.');
  /** @type {(r: Pt[]) => Pt[]} */
  const ring=r=>{const pts=r.map(([x,y])=>/** @type {Pt} */([x,y]));if(pts.length>1&&pts[0][0]===pts[pts.length-1][0]&&pts[0][1]===pts[pts.length-1][1])pts.pop();return pts;};
  const poly=geometry(o,0).map(ring);
  const bb=objectBounds(o),ext=Math.hypot(bb[2]-bb[0],bb[3]-bb[1])+1,joint=.05,last=points.length-2;
  /** @type {Pt[][]} */ const strips=[];
  for(let i=0;i<=last;i++){const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy*.01,ny=ux*.01;
    const p0=i===0?[a[0]-ux*ext,a[1]-uy*ext]:[a[0]-ux*joint,a[1]-uy*joint],p1=i===last?[b[0]+ux*ext,b[1]+uy*ext]:[b[0]+ux*joint,b[1]+uy*joint];
    strips.push([[p0[0]+nx,p0[1]+ny],[p1[0]+nx,p1[1]+ny],[p1[0]-nx,p1[1]-ny],[p0[0]-nx,p0[1]-ny]]);}
  const result=polygonClipping.difference(poly,strips.map(strip=>[strip]));
  const before=shapeArea(poly),after=result.reduce((n,pg)=>n+shapeArea(pg),0);
  if(Math.abs(before-after)<1e-6*Math.max(1,before))throw Error('The knife line does not cut the shape.');
  if(!result.length)throw Error('The cut leaves nothing.');
  replaceWithPolygons(doc,o,[o],result);
}

// Replace `objs` by the polygons of a polygon-clipping result; the first piece keeps the base object's id, others get new ids.
/**
 * @param {Doc} doc
 * @param {Obj} base
 * @param {Obj[]} objs
 * @param {Pt[][][]} result
 * @returns {void}
 */
function replaceWithPolygons(doc,base,objs,result){
  /** @type {(r: Pt[]) => Pt[]} */
  const round=r=>r.slice(0,-1).map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]);
  /** @type {Obj[]} */ const made=[];
  result.forEach((poly,k)=>{const [outer,...holes]=poly.map(round);if(outer.length<3||outer.length>1000||holes.length>20||holes.some(h=>h.length<3||h.length>200))throw Error('The result is too complex (outer ring up to 1,000 points, up to 20 holes of up to 200 points). Simplify the shapes first.');
    const o=/** @type {Obj} */(k===0?base:{id:crypto.randomUUID(),name:`${base.name||'Shape'} ${k+1}`,thread:base.thread,stitch:base.stitch,...(base.border?{border:true,borderThread:base.borderThread}:{})});
    for(const key of /** @type {Array<keyof Obj>} */(['rotation','smooth','handles','holes','satinWidth','text','font','along']))delete o[key];Object.assign(o,{kind:'path',points:outer,closed:true,stitch:base.stitch==='run'?'run':'fill',w:0,h:0,x:0,y:0});if(holes.length)o.holes=holes;refreshPathBounds(o);made.push(o);});
  doc.objects=doc.objects.filter(o=>!objs.includes(o)||o===base);const baseAt=doc.objects.indexOf(base);doc.objects.splice(baseAt+1,0,...made.slice(1));
}

// ---- Inkscape-style path tools -------------------------------------------------------------------------------
// Offset and stroke-to-shape build a buffer as the union of "capsules" (a segment grown by a radius, round caps and joins).
/**
 * @param {Doc} doc
 * @param {string} id
 * @returns {Obj}
 */
function closedShapeOrThrow(doc,id){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);if(o.kind==='text'||o.kind==='stitch_layer'||(o.kind==='path'&&!o.closed))throw Error('This works on closed shapes: rectangle, ellipse or closed path.');return o;}

/**
 * @param {Doc} doc
 * @param {string} id
 * @param {number} distance
 * @returns {void}
 */
export function offsetShape(doc,id,distance){const o=closedShapeOrThrow(doc,id),d=Number(distance);if(!Number.isFinite(d)||d===0||Math.abs(d)>50)throw Error('Offset distance must be a non-zero number of mm, at most 50 in either direction.');
  const rings=geometry(o,0).map(closedRing),poly=rings.map(r=>r.slice(0,-1)),grown=bufferSegments(rings,Math.abs(d));
  const result=d>0?polygonClipping.union(poly,...grown):polygonClipping.difference(poly,...grown);if(!result.length)throw Error('The inset removes the whole shape; use a smaller distance.');replaceWithPolygons(doc,o,[o],result);}

/**
 * @param {Doc} doc
 * @param {string} id
 * @param {number} width
 * @returns {void}
 */
export function strokeToShape(doc,id,width){const o=doc.objects.find(v=>v.id===id);if(!o||o.kind!=='path')throw Error(`Stroke to shape needs a path: ${id}`);const w=Number(width);if(!Number.isFinite(w)||w<=0||w>40)throw Error('Stroke width must be between 0 and 40 mm.');
  const ring=geometry(o,0)[0],grown=bufferSegments([ring],w/2);if(!grown.length)throw Error('The path has no length.');replaceWithPolygons(doc,Object.assign(o,{stitch:'fill'}),[o],grown);}
