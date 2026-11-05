// @ts-check
// Shape operations on closed shapes: boolean combine, appliqué from a group, and the knife. Polygons come from polygon-clipping.
import {polygonClipping} from './geom.js';
import {geometry,objectBounds,objById,refreshPathBounds,shapeArea} from './engine.js';
import {isClosedShape} from './pathGeometry.js';
// geom.js ships no types; polygon-clipping is reached through this one cast at the module boundary.
const clipping=/** @type {any} */ (polygonClipping);
// Boolean shape operations on closed shapes (rectangle, ellipse, closed path, with holes) using polygon-clipping.
// The result replaces the operands: the first result polygon keeps the first operand's id, further pieces get new ids.
export function booleanShapes(/** @type {any} */ doc,/** @type {any} */ mode,/** @type {any} */ ids){
  if(!['union','intersect','subtract','xor'].includes(mode))throw Error(`Unknown boolean mode: ${mode}`);if(!Array.isArray(ids)||ids.length<2||new Set(ids).size!==ids.length)throw Error('A boolean operation needs at least two different objects.');
  const objs=ids.map((/** @type {any} */ id)=>{const o=doc.objects.find((/** @type {any} */ v)=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);if(o.kind==='text'||o.kind==='stitch_layer'||(o.kind==='path'&&!o.closed))throw Error('Boolean operations work on closed shapes: rectangle, ellipse or closed path.');return o;});
  const ring=(/** @type {any} */ r)=>{const pts=r.map((/** @type {any[]} */ [x,y])=>[x,y]);if(pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();return pts;};
  const polys=objs.map((/** @type {any} */ o)=>geometry(o,0).map(ring)),[first,...rest]=polys;
  const result=(mode==='union'?clipping.union:mode==='intersect'?clipping.intersection:mode==='xor'?clipping.xor:clipping.difference)(first,...rest);
  if(!result.length)throw Error(mode==='intersect'?'The shapes do not overlap, so the intersection is empty.':'The result is empty.');
  replaceWithPolygons(doc,objs[0],objs,result);
}
// Appliqué from a group: the selected closed shapes become fills, and the bottom-most one (first in the object order) stays the fabric the others are laid on. Each other shape becomes an appliqué: its placement line, tack-down and satin cover, as a single object's appliqué already sews. Shapes are kept in their object order.
export function appliqueGroup(/** @type {any} */ doc,/** @type {any} */ ids){if(!Array.isArray(ids)||ids.length<2)throw Error('Appliqué from a group needs two or more closed shapes.');if(new Set(ids).size!==ids.length)throw Error('Each shape can be chosen once.');
  // Open paths, text and other objects in the selection are left as they are; only the closed shapes take part, and at least two must remain.
  const objs=ids.map((/** @type {any} */ id)=>objById(doc,id)).filter(isClosedShape);if(objs.length<2)throw Error('Appliqué from a group needs two or more closed shapes.');
  const ordered=doc.objects.filter((/** @type {any} */ o)=>objs.includes(o));const [base,...top]=ordered;
  for(const o of ordered)o.stitch='fill';
  delete base.applique;for(const o of top)o.applique=true;}
// Knife: cut a closed shape along the straight line through two points. The cut is a thin strip (0.02 mm) along that line, extended past the shape's bounds, subtracted from the shape; the pieces then become separate objects, as with booleans. A line that does not cut the shape is refused.
// Knife: cut a closed shape along a polyline (two or more points). Each segment is a thin strip (0.02 mm wide), extended a little at both ends so the strips overlap at the joints, and the strips are subtracted from the shape; the pieces become separate objects, as with booleans. The first and last segments reach past the shape's bounds. A line that does not cut the shape is refused, and so is a polyline that crosses itself.
const segmentsCross=(/** @type {any[]} */ p1,/** @type {any[]} */ p2,/** @type {any[]} */ p3,/** @type {any[]} */ p4)=>{const d=(/** @type {any[]} */ a,/** @type {any[]} */ b,/** @type {any[]} */ c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const d1=d(p3,p4,p1),d2=d(p3,p4,p2),d3=d(p1,p2,p3),d4=d(p1,p2,p4);return d1*d2<0&&d3*d4<0;};
export function knifeShape(/** @type {any} */ doc,/** @type {any} */ id,/** @type {any} */ points){
  const o=objById(doc,id);
  if(!(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed)))throw Error('Knife cuts a closed shape: a rectangle, an ellipse or a closed path.');
  if(!Array.isArray(points)||points.length<2||points.some((/** @type {any} */ p)=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('The knife needs two or more points.');
  for(let i=1;i<points.length;i++)if(Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])<1e-6)throw Error('The knife needs two different points.');
  for(let i=0;i<points.length-1;i++)for(let j=i+2;j<points.length-1;j++)if(segmentsCross(points[i],points[i+1],points[j],points[j+1]))throw Error('The knife line crosses itself.');
  const ring=(/** @type {any} */ r)=>{const pts=r.map((/** @type {any[]} */ [x,y])=>[x,y]);if(pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();return pts;};
  const poly=geometry(o,0).map(ring);
  const bb=objectBounds(o),ext=Math.hypot(bb[2]-bb[0],bb[3]-bb[1])+1,joint=.05,last=points.length-2,strips=[];
  for(let i=0;i<=last;i++){const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy*.01,ny=ux*.01;
    const p0=i===0?[a[0]-ux*ext,a[1]-uy*ext]:[a[0]-ux*joint,a[1]-uy*joint],p1=i===last?[b[0]+ux*ext,b[1]+uy*ext]:[b[0]+ux*joint,b[1]+uy*joint];
    strips.push([[p0[0]+nx,p0[1]+ny],[p1[0]+nx,p1[1]+ny],[p1[0]-nx,p1[1]-ny],[p0[0]-nx,p0[1]-ny]]);}
  const result=clipping.difference(poly,strips.map((/** @type {any[]} */ strip)=>[strip]));
  const before=shapeArea(poly),after=result.reduce((/** @type {number} */ n,/** @type {any} */ pg)=>n+shapeArea(pg),0);
  if(Math.abs(before-after)<1e-6*Math.max(1,before))throw Error('The knife line does not cut the shape.');
  if(!result.length)throw Error('The cut leaves nothing.');
  replaceWithPolygons(doc,o,[o],result);
}
// Replace `objs` by the polygons of a polygon-clipping result; the first piece keeps the base object's id, others get new ids.
export function replaceWithPolygons(/** @type {any} */ doc,/** @type {any} */ base,/** @type {any} */ objs,/** @type {any} */ result){
  const round=(/** @type {any} */ r)=>r.slice(0,-1).map((/** @type {any[]} */ [x,y])=>[+x.toFixed(3),+y.toFixed(3)]),made=/** @type {any[]} */ ([]);
  result.forEach((/** @type {any} */ poly,/** @type {number} */ k)=>{const [outer,...holes]=poly.map(round);if(outer.length<3||outer.length>1000||holes.length>20||holes.some((/** @type {any} */ h)=>h.length<3||h.length>200))throw Error('The result is too complex (outer ring up to 1,000 points, up to 20 holes of up to 200 points). Simplify the shapes first.');
    const o=k===0?base:{id:crypto.randomUUID(),name:`${base.name||'Shape'} ${k+1}`,thread:base.thread,stitch:base.stitch,...(base.border?{border:true,borderThread:base.borderThread}:{})};
    for(const key of ['rotation','smooth','handles','holes','satinWidth','text','font','along'])delete o[key];Object.assign(o,{kind:'path',points:outer,closed:true,stitch:base.stitch==='run'?'run':'fill',w:0,h:0,x:0,y:0});if(holes.length)o.holes=holes;refreshPathBounds(o);made.push(o);});
  doc.objects=doc.objects.filter((/** @type {any} */ o)=>!objs.includes(o)||o===base);const baseAt=doc.objects.indexOf(base);doc.objects.splice(baseAt+1,0,...made.slice(1));
}
