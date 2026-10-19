// Shared polygon helpers (buffering, simplification) used by the engine and the stitch planner.
import polygonClipping from './vendor/polygon-clipping.js';
export {polygonClipping};

export function rdp(points,tol){if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);let idx=-1,dmax=0;for(let i=1;i<points.length-1;i++){const p=points[i],d=len?Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/len:Math.hypot(p[0]-a[0],p[1]-a[1]);if(d>dmax){dmax=d;idx=i;}}if(dmax<=tol)return [a,b];return [...rdp(points.slice(0,idx+1),tol).slice(0,-1),...rdp(points.slice(idx),tol)];}
export const closedRing=r=>{const pts=r.map(([x,y])=>[x,y]);if(pts.length>1&&(pts[0][0]!==pts.at(-1)[0]||pts[0][1]!==pts.at(-1)[1]))pts.push(pts[0]);return pts;};
export const openRing=r=>{const pts=r.map(([x,y])=>[x,y]);if(pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();return pts;};

// Buffer = union of one quad per segment plus one regular polygon (circle) per vertex. Trying a few circle phases keeps the
// sweep-line clipper away from exactly coincident edges, which can otherwise make it fail on tangent arcs.
export function bufferSegments(rings,r,maxEdges=500,sides=24){
  const edges=[],verts=[];for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i];if(!verts.some(v=>Math.abs(v[0]-a[0])<1e-9&&Math.abs(v[1]-a[1])<1e-9))verts.push(a);if(i){const b=ring[i-1];if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-9)edges.push([b,a]);}}
  if(!edges.length)return [];if(edges.length>maxEdges)throw Error(`The outline has too many segments for this operation (limit ${maxEdges}). Simplify it first.`);
  let lastError;for(const phase of [.13,.37,.61,.83]){try{
    const N=sides,R=r/Math.cos(Math.PI/N),circle=c=>Array.from({length:N},(_,k)=>{const t=(k+phase)*Math.PI*2/N;return [c[0]+R*Math.cos(t),c[1]+R*Math.sin(t)];});
    const quad=([a,b])=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),nx=-dy/l*r,ny=dx/l*r;return [[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];};
    const polys=[...edges.map(e=>[quad(e)]),...verts.map(v=>[circle(v)])];return polygonClipping.union(polys[0],...polys.slice(1));}catch(error){lastError=error;}}
  throw Error(`Could not compute the offset outline (${lastError?.message||'geometry too degenerate'}). Try simplifying the shape first.`);}
