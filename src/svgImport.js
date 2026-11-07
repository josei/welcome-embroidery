// @ts-check
// SVG import: decides whether a filled <path> imports as fill objects (its counters become holes and islands) or stays an
// outline, and turns the text of a safe SVG file into a document. The engine re-exports the fill rule.
import {insideRings} from './stitchRuns.js';
import {parseSvgPath} from './lettering.js';
import {validateDocument} from './validate.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {{fill: boolean, note: string|null, holes: number, islands: number, depths: number[]}} SvgFill */
/** @typedef {{doc: any, notes: string[]}} SvgImport */

// SVG <path> fill rule. A path with a fill (not none) and no stroke imports as fill objects when its subpaths are closed rings and nest at most two levels: one
// outer ring (depth 0), holes inside it (depth 1, up to 20 of up to 200 points), and islands inside a hole (depth 2, each its own fill object, up to 1,000
// points). Deeper nesting, or several outer rings, keeps the running-outline import and the note says why. Returns {fill, note, holes, islands, depths}: depths
// gives each subpath's depth, and holes and islands count the depth 1 and depth 2 rings.
/**
 * @param {string|null|undefined} fill
 * @param {string|null|undefined} stroke
 * @param {Pt[][]} subpaths
 * @returns {SvgFill}
 */
export function svgPathFill(fill,stroke,subpaths){const filled=fill!==null&&fill!==undefined&&fill!=='none',stroked=stroke!==null&&stroke!==undefined&&stroke!==
  'none';const none={fill:false,note:null,holes:0,islands:0,depths:[]};if(!filled||stroked)return none;
/** @type {(pts: Pt[]) => boolean} */
const closedRing=pts=>pts.length>=3&&Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<1e-9;
/** @type {(text: string) => SvgFill} */
const outlineNote=(text)=>({...none,note:text});
if(!subpaths.every(closedRing))return outlineNote(subpaths.length===1?'A filled path that is not closed imports as an outline.':
  'A filled path with several subpaths, some not closed, imports as an outline.');
const rings=subpaths.map(r=>r.slice(0,-1));
const depths=rings.map((r,i)=>rings.reduce((n,q,j)=>n+(j!==i&&insideRings([q],r[0])?1:0),0));
if(depths.filter(d=>d===0).length!==1)return outlineNote(
  'A filled path with several outer shapes imports as an outline: its counters would otherwise fill in.');
const holes=depths.filter(d=>d===1).length,islands=depths.filter(d=>d===2).length;
const deep=depths.some(d=>d>2);const tooBig=rings.some((r,i)=>(depths[i]===1&&r.length>200)||(depths[i]===2&&r.length>1000))||holes>20||islands>20;
if(deep||tooBig)return outlineNote('A filled path with counters nested deeper than an island in a hole, or too many points, imports as an outline.');
return {fill:true,note:null,holes,islands,depths};}

/** The attributes each supported SVG element may carry. A group keeps only its id; a transform or a style is refused. */
/** @type {Record<string, Set<string>>} */
const shapeAttributes={
 rect:new Set(['id','x','y','width','height','rx','ry','fill','stroke']),
 ellipse:new Set(['id','cx','cy','rx','ry','fill','stroke']),
 line:new Set(['id','x1','y1','x2','y2','fill','stroke','stroke-width']),
 polyline:new Set(['id','points','fill','stroke','stroke-width']),
 path:new Set(['id','d','fill','stroke','stroke-width']),
};
const groupAttributes=new Set(['id']);

/**
 * Imports the text of an SVG file as a document: the safe subset of shapes (rectangles, ellipses, lines, polylines and
 * paths) in a 110 mm hoop, with the same limits as before. Returns the document and the notes to show the user, such as a
 * filled path that kept its outline.
 * @param {string} source
 * @returns {SvgImport}
 */
export function importSvg(source){
 /** @type {string[]} */
 const notes=[];
 if(source.length>1_000_000||/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('SVG files must be under 1 MB and cannot declare entities.');
 const xml=new DOMParser().parseFromString(source,'image/svg+xml');
 if(xml.querySelector('parsererror'))throw Error('Invalid SVG XML.');
 const root=xml.documentElement;
 if(root.localName!=='svg')throw Error('SVG root element is required.');
 const rootAllowed=new Set(['xmlns','viewBox','width','height','version','id']);
 for(const a of [...root.attributes]){
  if(!rootAllowed.has(a.name))throw Error(`SVG root attribute ${a.name} is unsupported; transforms and inherited styles are rejected.`);
 }
 const vb=(root.getAttribute('viewBox')||'0 0 100 100').trim().split(/[ ,]+/).map(Number);
 if(vb.length!==4||vb.some(v=>!Number.isFinite(v))||vb[2]<=0||vb[3]<=0||vb[2]>100000||vb[3]>100000){
  throw Error('SVG needs a finite, positive viewBox no larger than 100,000 units.');
 }
 const scale=Math.min(110/vb[2],110/vb[3]),ox=-(vb[0]+vb[2]/2)*scale,oy=-(vb[1]+vb[3]/2)*scale;
 /** @type {any[]} */
 const objects=[];
 let pointTotal=0;
 for(const el of [...root.querySelectorAll('*')]){
  const tag=el.localName;
  const allowed=tag==='g'?groupAttributes:shapeAttributes[tag];
  if(!allowed)throw Error(`SVG element <${tag}> is outside the supported safe subset.`);
  for(const a of [...el.attributes]){
   if(!allowed.has(a.name)||/^on/i.test(a.name))throw Error(`SVG attribute ${a.name} is unsupported; transforms and inherited styles are rejected.`);
  }
  if(tag==='g')continue;
  const fill=el.getAttribute('fill'),stroke=el.getAttribute('stroke'),raw=fill&&fill!=='none'?fill:stroke||'#527461';
  if(!/^#[0-9a-f]{6}$/i.test(raw))throw Error('SVG colors must be six-digit hexadecimal values.');
  const thread=raw.toLowerCase();
  if(tag==='rect'||tag==='ellipse'){
   const isEllipse=tag==='ellipse',cx=Number(el.getAttribute('cx')||0),cy=Number(el.getAttribute('cy')||0);
   const rx=Number(el.getAttribute('rx')||0),ry=Number(el.getAttribute('ry')||0);
   const x=isEllipse?cx-rx:Number(el.getAttribute('x')||0),y=isEllipse?cy-ry:Number(el.getAttribute('y')||0);
   const w=Number(el.getAttribute(isEllipse?'rx':'width')||0)*(isEllipse?2:1),h=Number(el.getAttribute(isEllipse?'ry':'height')||0)*(isEllipse?2:1);
   if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)throw Error('SVG shapes require finite positive dimensions.');
   objects.push({id:crypto.randomUUID(),name:'Imported '+(tag==='rect'?'rectangle':'ellipse'),kind:tag==='rect'?'rect':'ellipse',
    x:x*scale+ox,y:y*scale+oy,w:w*scale,h:h*scale,thread,stitch:fill&&fill!=='none'?'fill':'run'});
  }else{
   /** @type {Pt[][]} */
   let paths=[];
   if(tag==='path'){
    const d=el.getAttribute('d')||'';
    if(d.length>200000)throw Error('SVG path data exceeds 200,000 characters.');
    paths=parseSvgPath(d);
   }else{
    const rawpts=tag==='line'
     ?[el.getAttribute('x1')||0,el.getAttribute('y1')||0,el.getAttribute('x2')||0,el.getAttribute('y2')||0].map(Number)
     :(el.getAttribute('points')||'').trim().split(/[ ,]+/).map(Number);
    if(rawpts.length<4||rawpts.length%2||rawpts.some(v=>!Number.isFinite(v)))throw Error('SVG line and polyline coordinates are invalid.');
    paths=[Array.from({length:rawpts.length/2},(_,i)=>/** @type {Pt} */(rawpts.slice(i*2,i*2+2)))];
   }
   // A stroke-only path with a stroke-width of 0.3 mm or more (after the viewBox scale) sews as a satin column of that
   // width; without a stroke-width it stays a running stitch, as before.
   const swAttr=el.getAttribute('stroke-width'),strokeMm=swAttr===null?NaN:Number(swAttr)*scale;
   const strokeOnly=(fill===null||fill==='none')&&stroke!==null&&stroke!=='none',satinStroke=strokeOnly&&strokeMm>=.3;
   const fillRule=tag==='path'?svgPathFill(fill,stroke,paths):{fill:false,note:null,holes:0,islands:0,depths:[]};
   if(fillRule.note&&!notes.includes(fillRule.note))notes.push(fillRule.note);
   if(fillRule.fill){
    /** @type {(pts: Pt[]) => Pt[]} */
    const toMm=pts=>pts.slice(0,-1).map(([x,y])=>[x*scale+ox,y*scale+oy]);
    const outerAt=fillRule.depths.indexOf(0),mm=toMm(paths[outerAt]);
    pointTotal+=paths.reduce((n,r)=>n+r.length,0);
    if(pointTotal>5000)throw Error('SVG import is limited to 5,000 path points.');
    /** @type {(pts: Pt[], holeList: Pt[][]) => any} */
    const fillAt=(pts,holeList)=>{
     const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
     return {id:crypto.randomUUID(),name:'Imported fill',kind:'path',x:Math.min(...xs),y:Math.min(...ys),w:0,h:0,
      points:pts,thread,closed:true,stitch:'fill',...(holeList.length?{holes:holeList}:{})};
    };
    const holeRings=paths.filter((_,i)=>fillRule.depths[i]===1).map(toMm);
    objects.push(fillAt(mm,holeRings));
    paths.forEach((r,i)=>{if(fillRule.depths[i]===2)objects.push(fillAt(toMm(r),[]));});
   }else{
    for(const points of paths){
     if(points.length<2)continue;
     pointTotal+=points.length;
     if(points.length>1000||pointTotal>5000)throw Error('SVG import is limited to 5,000 path points.');
     const mm=points.map(([x,y])=>/** @type {Pt} */([x*scale+ox,y*scale+oy]));
     const xs=mm.map(p=>p[0]),ys=mm.map(p=>p[1]);
     objects.push({id:crypto.randomUUID(),name:'Imported path',kind:'path',x:Math.min(...xs),y:Math.min(...ys),w:0,h:0,
      points:mm,thread,...(satinStroke?{stitch:'satin',satinWidth:Math.max(.5,Math.min(12,strokeMm))}:{stitch:'run'})});
    }
   }
  }
  if(objects.length>100)throw Error('SVG import is limited to 100 editable objects.');
 }
 const d={schema:'welcome/1',name:'Imported SVG',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:true,compensation:.2},objects};
 validateDocument(d);
 return {doc:d,notes};
}
