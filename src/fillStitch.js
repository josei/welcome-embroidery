// @ts-check
// Fill and satin planning: the run lists for a filled shape (its underlay, then the top fill, with colour blends) and for a satin column between two rails.
// The compile step calls these. The document and item records are read as any at this boundary, as in operations.js.
import {polygonClipping,closedRing} from './geom.js';
import {planRippleFill,planCrossStitch,planContourFill,planSpiralFill,planGuidedFill,planMeanderFill,planFill,planContour,planFillUnderlay,sampleRun,makeInside,chainRuns} from './stitchplan.js';
import {motifFillRuns,blingFillRuns} from './embellishments.js';
import {shapeArea} from './designChecks.js';
import {closeRing,clipRuns,satinFromRails,underlayTypes,orientRuns,pinPoint,reverseRuns} from './stitchRuns.js';
import {distP} from './pathGeometry.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {{pts: Pt[], jump?: boolean, loop?: boolean}} Run */
// One result shape for both fills and satin columns: the underlay and top runs, plus the second thread's runs (top2) or the per-colour groups (groups) where a blend or palette splits the fill, and bad when a satin column cannot be sewn.
/** @typedef {{under: Run[], top: Run[], top2?: Run[], groups?: Run[][], bad?: boolean}} FillResult */

/**
 * @param {Pt[][]} rings
 * @param {any} o
 * @param {any} doc
 * @param {number} comp
 * @param {Pt|null} [from]
 * @returns {FillResult}
 */
export function fillRuns(rings,o,doc,comp,from=null){
  const sPt=pinPoint(o,o.startAt),ePt=pinPoint(o,o.endAt);if(sPt)from=sPt;
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return {under:[],top:[]};
  const sp=o.spacing??doc.settings.spacing,an=o.angle??doc.settings.angle,L=o.stitchLength??doc.settings.stitchLength??3,st=o.stagger??doc.settings.stagger??4,area=shapeArea(closed),perimeter=closed.reduce((n,r)=>n+r.reduce((m,p,i)=>i?m+distP(p,r[i-1]):0,0),0),meanWidth=perimeter?2*area/perimeter:0,types=meanWidth<1.4?new Set():underlayTypes(o,doc,'fill',area),under=[];
  if(types.has('contour'))under.push(...planContour(closed,{inset:(o.underlayInset??.4)+comp}));
  if(types.has('fill'))under.push(...planFillUnderlay(closed,{angle:an+90,spacing:o.underlaySpacing??2.2,length:3.5,inset:(o.underlayInset??.6)+comp}));
  // Laydown: a light fill at wide 4 mm rows, across the grain of the top fill, to flatten the pile of towelling and fleece.
  if(types.has('laydown'))under.push(...planFillUnderlay(closed,{angle:an+90,spacing:o.laydownSpacing??4,length:3.5,inset:(o.underlayInset??.6)+comp}));
  // Raised fill: a second tatami underlay at 2 mm rows, at the same 90° as the top fill's underlay, so the fill stands up.
  if(o.raised)under.push(...planFillUnderlay(closed,{angle:an+(o.raisedAngle??90),spacing:o.raisedSpacing??2,length:3.5,inset:(o.underlayInset??.6)+comp}));
  const oriented=orientRuns(under,from),last=oriented[oriented.length-1]?.pts.at(-1)??from,inside=makeInside(closed),fillOpts=/** @type {any} */({spacing:sp,angle:an,length:L,stagger:st,variance:o.lengthVariance??0,underpath:o.underpath??true,accordion:o.accordionStart!==undefined?[o.accordionStart,o.accordionEnd,o.accordionEase??'linear']:null});
  const guide=o.fillMethod==='guided'&&o.guide?o.guide.map((/** @type {any} */ f)=>pinPoint(o,f)).filter(Boolean):null,
    planTop=(/** @type {any} */ at,rs=closed)=>{switch(o.fillMethod){case 'contour':return planContourFill(rs,{spacing:sp,length:L,from:at});case 'spiral':return planSpiralFill(rs,{spacing:sp,length:L,from:at});case 'meander':return planMeanderFill(rs,{spacing:sp,length:L,from:at});case 'ripple':{const rc=pinPoint(o,o.rippleCenter||[.5,.5]);return clipRuns(planRippleFill(rs,{spacing:sp,length:L,center:rc,from:at}),rs.map(closeRing));}case 'cross':return planCrossStitch(rs,{size:o.crossSize??2.5,from:at});case 'motif':return motifFillRuns(rs,o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifWarp);case 'sequin':return motifFillRuns(rs,o.motifSpacing??8,(o.motifSize??3)/2,'none',true);case 'bling':return blingFillRuns(rs,o.motifSpacing??8,o.motifSize??4,o.blingShape??'round',o.blingRings??2);case 'guided':return guide&&guide.length>=2?planGuidedFill(rs,guide,{...fillOpts,from:at}):planFill(rs,{...fillOpts,from:at});default:return planFill(rs,{...fillOpts,from:at});}};
  // Colour blend: the rows are shared between two threads by an ordered dither whose share of the second thread grows across the rows (from blendStart to blendEnd of the shape's height).
  const rowBlend=Boolean(o.blendThread)&&(!o.fillMethod||o.fillMethod==='rows')&&o.blendAngle===undefined,bandBlend=(Boolean(o.blendThread)&&!rowBlend)||Boolean(o.blendPalette);
  const blended=rowBlend;
  const isB=(/** @type {any} */ k,/** @type {any} */ y,/** @type {any} */ y0,/** @type {any} */ y1)=>{const s0=o.blendStart??0,s1=o.blendEnd??1,u=(y1>y0?(y-y0)/(y1-y0):.5),t=Math.max(0,Math.min(1,s1===s0?(u>=s0?1:0):(u-s0)/(s1-s0))),g=((k+1)*0.6180339887)%1;return g<t;};
  // Band blend (any direction, any pattern): the shape is cut into thin strips across the blend direction and the strips are shared between the two threads by the same ordered dither.
  if(bandBlend){const ang=((o.blendAngle??(an+90))*Math.PI/180),dir=[Math.cos(ang),Math.sin(ang)],perp=[-dir[1],dir[0]],pts=closed.flat(),us=pts.map(p=>p[0]*dir[0]+p[1]*dir[1]),vs=pts.map(p=>p[0]*perp[0]+p[1]*perp[1]),u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs)-1,v1=Math.max(...vs)+1,bw=Math.max(.8,sp*2),nb=Math.max(1,Math.ceil((u1-u0)/bw)),polys=[];
    if(o.blendPalette){const N=o.blendPalette.length,groups=o.blendPalette.map(()=>[]),shape=closed.map(closeRing);
      for(let i=0;i<nb;i++){const t0=o.blendStart??0,t1=o.blendEnd??1,u=(i+.5)/nb,t=Math.max(0,Math.min(1,t1===t0?(u>=t0?1:0):(u-t0)/(t1-t0))),g=((i+1)*0.6180339887)%1,p=t*(N-1),lo=Math.min(N-2,Math.floor(p)),a=u0+i*bw,b=Math.min(u1+1e-6,u0+(i+1)*bw+.02),P=(/** @type {any} */ uu,/** @type {any} */ vv)=>[dir[0]*uu+perp[0]*vv,dir[1]*uu+perp[1]*vv];groups[g<p-lo?lo+1:lo].push([[P(a,v0),P(b,v0),P(b,v1),P(a,v1),P(a,v0)]]);}
      let at=last;const runs=groups.map((/** @type {any} */ strips)=>{let rs=/** @type {any[]} */([]);try{rs=strips.length?polygonClipping.intersection(shape,polygonClipping.union(...strips)).flatMap(pg=>pg):[];}catch{rs=[];}const r=rs.length?planTop(at,rs):[];at=r[r.length-1]?.pts.at(-1)??at;return chainRuns(r,28,inside);});
      return {under:[],top:chainRuns(oriented,28,inside),groups:runs};}
    for(let i=0;i<nb;i++){const t0=o.blendStart??0,t1=o.blendEnd??1,u=(i+.5)/nb,t=Math.max(0,Math.min(1,t1===t0?(u>=t0?1:0):(u-t0)/(t1-t0))),g=((i+1)*0.6180339887)%1;if(g>=t)continue;const a=u0+i*bw,b=Math.min(u1+1e-6,u0+(i+1)*bw+.02),P=(/** @type {any} */ uu,/** @type {any} */ vv)=>[dir[0]*uu+perp[0]*vv,dir[1]*uu+perp[1]*vv];polys.push([[P(a,v0),P(b,v0),P(b,v1),P(a,v1),P(a,v0)]]);}
    let Brs=/** @type {any[]} */([]),Ars=closed;if(polys.length){try{const mask=/** @type {any} */(polygonClipping.union(.../** @type {any} */(polys))),shape=/** @type {any} */(closed.map(closeRing));Brs=polygonClipping.intersection(shape,mask).flatMap(pg=>pg);Ars=polygonClipping.difference(shape,mask).flatMap(pg=>pg);}catch{Brs=[];Ars=closed;}}
    const A=Ars.length?planTop(last,Ars):[],endA=A[A.length-1]?.pts.at(-1)??last,B=Brs.length?planTop(endA,Brs):[];
    return {under:[],top:chainRuns([...oriented,...A],28,inside),top2:chainRuns(B,28,inside)};}
  if(blended){const A=planFill(closed,{...fillOpts,from:last,rowPick:(k,y,a,b)=>!isB(k,y,a,b)}),endA=A[A.length-1]?.pts.at(-1)??last,B=planFill(closed,{...fillOpts,from:endA,rowPick:isB});
    return {under:[],top:chainRuns([...oriented,...A],28,inside),top2:chainRuns(B,28,inside)};}
  let topPlan=planTop(last);
  // End point: plan from the end point and reverse (it then finishes there); keep whichever plan starts and ends closer to what was asked for.
  if(ePt&&topPlan.length){const alt=reverseRuns(planTop(ePt)),score=(/** @type {any} */ r)=>(last?distP(r[0].pts[0],last)*(sPt?3:.25):0)+distP(r[r.length-1].pts.at(-1),ePt)*3;if(alt.length&&score(alt)<score(topPlan))topPlan=alt;}
  return {under:[],top:chainRuns([...oriented,...topPlan],28,inside)};
}
// Satin between two rails: [centre walk] [contour walk] [zigzag] underlay, then the column itself.
/**
 * @param {Pt[]} a
 * @param {Pt[]} b
 * @param {Array<[Pt, Pt]>} rungs
 * @param {any} o
 * @param {any} doc
 * @param {number} spacing
 * @param {number} comp
 * @param {Pt|null} [from]
 * @returns {FillResult}
 */
export function satinRuns(a,b,rungs,o,doc,spacing,comp,from=null){
  const sPt=pinPoint(o,o.startAt),ePt=pinPoint(o,o.endAt);if(sPt)from=sPt;
  const {zig,pairs}=satinFromRails(a,b,spacing,o.pullRight??comp,rungs,o.pullLeft??comp);if(zig.length<2)return {under:[],top:[]};
  // Rails that cannot be paired sensibly (stitches longer than a machine accepts) are reported so the caller can sew the column as a fill instead.
  if(zig.some((p,i)=>i&&distP(p,zig[i-1])>12.2))return {bad:true,under:[],top:[]};
  // Satin end inset: the first and last needle move inward along the column by endInset, so the end stitches are shorter. zig and pairs have one entry per needle pair.
  const insetStart=o.endInsetStart??o.endInset??0,insetEnd=o.endInsetEnd??o.endInset??0;
  if((insetStart>0||insetEnd>0)&&zig.length>2){const mid=(/** @type {any} */ k)=>/** @type {Pt} */([(pairs[k][0][0]+pairs[k][1][0])/2,(pairs[k][0][1]+pairs[k][1][1])/2]),unit=(/** @type {any} */ from,/** @type {any} */ to)=>{const l=distP(from,to)||1;return [(to[0]-from[0])/l,(to[1]-from[1])/l];},n=zig.length-1,inward=(/** @type {any} */ k)=>{for(let j=k?k-1:k+1;j>=0&&j<=n;j+=k?-1:1)if(distP(mid(j),mid(k))>1e-3)return unit(mid(k),mid(j));return [0,0];},d0=inward(0),dn=inward(n);zig[0]=[zig[0][0]+d0[0]*insetStart,zig[0][1]+d0[1]*insetStart];zig[n]=[zig[n][0]+dn[0]*insetEnd,zig[n][1]+dn[1]*insetEnd];}
  const widths=pairs.map(([p,q])=>distP(p,q)).sort((x,y)=>x-y),w=widths[Math.floor(widths.length/2)]||0,types=underlayTypes(o,doc,'satin',w),inset=Math.min(o.underlayInset??.35,w*.22),towards=(/** @type {any} */ p,/** @type {any} */ q,/** @type {any} */ d)=>{const l=distP(p,q)||1;return [p[0]+(q[0]-p[0])/l*d,p[1]+(q[1]-p[1])/l*d];};
  const under=[];
  if(types.has('center'))under.push({pts:sampleRun(pairs.map(([p,q])=>[(p[0]+q[0])/2,(p[1]+q[1])/2]),2.5)});
  if(types.has('contour')){const A=pairs.map(([p,q])=>towards(p,q,inset)),B=pairs.map(([p,q])=>towards(q,p,inset));under.push({pts:sampleRun(/** @type {Pt[]} */([...A,...B.reverse()]),2.5),loop:true});}
  if(types.has('zigzag')){const step=Math.max(.8,o.underlaySpacing??2),pts=/** @type {Pt[]} */([]);let acc=step,flip=0;pairs.forEach(([p,q],i)=>{if(i)acc+=distP(pairs[i-1][0],p);if(i===0||acc>=step||i===pairs.length-1){if(i)acc=0;pts.push(/** @type {Pt} */(flip++%2?towards(q,p,inset):towards(p,q,inset)));}});if(pts.length>1)under.push({pts});}
  // A requested start or end point fixes the sewing direction of the column: the underlay starts at the top's first end and open underlay runs go there and back, so the top starts where the underlay stops.
  if(sPt||ePt){const fwd=(sPt?distP(zig[0],sPt):0)+(ePt?distP(zig[zig.length-1],ePt):0),bwd=(sPt?distP(zig[zig.length-1],sPt):0)+(ePt?distP(zig[0],ePt):0),top=bwd<fwd?[...zig].reverse():zig,oriented=orientRuns(under,top[0],true).map(r=>r.loop||distP(r.pts[0],/** @type {Pt} */(r.pts.at(-1)))<1e-6?r:{...r,pts:[...r.pts,...r.pts.slice(0,-1).reverse()]});return {under:[],top:chainRuns([...oriented,{pts:top}],8)};}
  const oriented=orientRuns(under,from),end=oriented[oriented.length-1]?.pts.at(-1)??from,top=end&&distP(end,zig[0])>distP(end,zig[zig.length-1])?[...zig].reverse():zig;
  return {under:[],top:chainRuns([...oriented,{pts:top}],8)};
}
