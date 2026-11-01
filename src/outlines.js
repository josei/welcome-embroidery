// @ts-check
// Object outlines: the lines an object sews or prints along, from its shape, its path, its lettering (on a path too) and its
// corner radii. The engine re-exports geometry, textPrimitives and cornerRadii, so callers keep importing them from engine.js.
import {closedRing,bufferSegments,polygonClipping} from './geom.js';
import {pathOutline} from './pathGeometry.js';
import {textLines} from './lettering.js';
import {getFont,isRegistryFont} from './fonts.js';
import {layoutText,mapPrimitives,resamplePrimitives,primitiveLines} from './textlayout.js';

/** @typedef {import('./geom.js').Pt} Pt */
/**
 * @typedef {{x: number, y: number, along: {points: Pt[], closed?: boolean, offset?: number}}} Along
 * @typedef {{font: string, text?: string, x: number, y: number, w?: number, h?: number, rotation?: number, along?: Along['along']}} Lettering
 * @typedef {{kind: string, x: number, y: number, w: number, h: number, rotation?: number, holes?: Pt[][], points?: Pt[], along?: Along['along'], radii?: unknown, radius?: unknown, font?: string, text?: string}} Obj
 */

// Lettering on a path: glyph points are resampled to <= 0.8 mm, then mapped so that distance along the text becomes arc length
// along the path (starting at `offset` mm) and height above the baseline becomes the path's upward normal. The path is a
// snapshot (obj.along) copied by `text_on_path`, so later edits to the path do not move the lettering until it is attached again.
/**
 * @param {{x: number, y: number, along: Along['along']}} obj
 * @returns {(p: Pt) => Pt}
 */
function mapAlongPoint(obj){
  const pts=obj.along.points,closed=Boolean(obj.along.closed),ring=closed?[...pts,pts[0]]:pts,cum=[0];for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const total=cum.at(-1)||1;
  /** @type {(sRaw: number) => {p: Pt, t: Pt}} */
  const at=sRaw=>{let sPos=closed?((sRaw%total)+total)%total:sRaw,i=1;if(sPos>=0)while(i<cum.length-1&&cum[i]<sPos)i++;const a=ring[i-1],b=ring[i],seg=cum[i]-cum[i-1]||1,f=(sPos-cum[i-1])/seg,tx=(b[0]-a[0])/seg,ty=(b[1]-a[1])/seg;return {p:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],t:[tx,ty]};};
  const offset=Number(obj.along.offset)||0;
  return ([X,Y])=>{const {p,t}=at(offset+(X-obj.x)),v=obj.y-Y;return [p[0]+t[1]*v,p[1]-t[0]*v];};
}

/**
 * @param {Pt[][]} lines
 * @param {{x: number, y: number, along: Along['along']}} obj
 * @returns {Pt[][]}
 */
function mapAlongPath(lines,obj){
  const map=mapAlongPoint(obj);
  /** @type {(line: Pt[]) => Pt[]} */
  const resample=line=>{const out=[line[0]];for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.8));for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;};
  return lines.map(line=>resample(line).map(map));
}

/**
 * @param {Pt[][]} rings
 * @param {number} d
 * @returns {Pt[][]|null}
 */
function bufferRingsForBold(rings,d){try{const closed=rings.map(closedRing),poly=rings.map(r=>r),grown=bufferSegments(closed,d),result=polygonClipping.union(poly,...grown);const out=[];for(const polygon of result)for(const ring of polygon)out.push(ring.slice(0,-1));return out.length?out:null;}catch{return null;}}

/**
 * @param {Lettering} obj
 * @returns {Array<import('./textlayout.js').Prim>|null}
 */
export function textPrimitives(obj){
  const font=getFont(obj.font);if(!font)return null;
  let prims=layoutText(obj,font,{buffer:bufferRingsForBold}).prims;
  if(obj.along)prims=mapPrimitives(resamplePrimitives(prims),mapAlongPoint(
  /** @type {{x: number, y: number, along: Along['along']}} */(obj)));
  const angle=(Number(obj.rotation)||0)*Math.PI/180;if(angle&&prims.length){const pts=primitiveLines(prims).flat(),cx=(Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2,cy=(Math.min(...pts.map(p=>p[1]))+Math.max(...pts.map(p=>p[1])))/2,c=Math.cos(angle),sn=Math.sin(angle);prims=mapPrimitives(prims,([x,y])=>[cx+(x-cx)*c-(y-cy)*sn,cy+(x-cx)*sn+(y-cy)*c]);}
  return prims;
}

// Corner radii of a rectangle in mm, ordered top-left, top-right, bottom-right, bottom-left. Four `radii` override the uniform `radius`; with neither, all four are 0.
/**
 * @param {{radii?: unknown, radius?: unknown}} o
 * @returns {number[]}
 */
export function cornerRadii(o){if(Array.isArray(o.radii)&&o.radii.length===4)return o.radii.map(v=>Number(v)||0);const u=Number(o.radius)||0;return [u,u,u,u];}

/**
 * @param {Obj} obj
 * @param {number} [comp]
 * @returns {Pt[][]}
 */
export function geometry(obj,comp=0) {
  /** @type {Pt[][]} */ let lines;
  if(obj.kind==='text'&&isRegistryFont(obj.font)){const prims=textPrimitives(
  /** @type {Lettering} */(obj));return prims?primitiveLines(prims):[];}
  if(obj.kind==='text'){lines=textLines(
  /** @type {Lettering} */(obj));if(obj.along)lines=mapAlongPath(lines,/** @type {{x: number, y: number, along: Along['along']}} */(obj));}
  else if(obj.kind==='path')lines=[pathOutline(
  /** @type {import('./pathGeometry.js').PathLike} */(obj)),...(obj.holes||[]).map(h=>{const r=h.map(p=>
  /** @type {Pt} */([Number(p[0]),Number(p[1])]));return [...r,r[0]];})];
  else if(obj.kind==='ellipse') {
    /** @type {Pt[]} */ const pts=[];for(let i=0;i<=64;i++){const a=2*Math.PI*i/64;pts.push([obj.x+obj.w/2+Math.cos(a)*(obj.w/2+comp),obj.y+obj.h/2+Math.sin(a)*(obj.h/2+comp)]);}lines=[pts];}
  else {const x=obj.x-comp,y=obj.y-comp,w=obj.w+2*comp,h=obj.h+2*comp;const [rTL,rTR,rBR,rBL]=cornerRadii(obj).map(v=>Math.max(0,Math.min(v+(v>0?comp:0),Math.min(w,h)/2)));
    if(Math.max(rTL,rTR,rBR,rBL)>.05){
    /** @type {Pt[]} */ const pts=[];
    /** @type {(cx: number, cy: number, r: number, a0: number, px: number, py: number) => void} */
    const arc=(cx,cy,r,a0,px,py)=>{if(r<=.05){pts.push([px,py]);return;}for(let k=0;k<=8;k++){const a=a0+Math.PI/2*k/8;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}};arc(x+w-rTR,y+rTR,rTR,-Math.PI/2,x+w,y);arc(x+w-rBR,y+h-rBR,rBR,0,x+w,y+h);arc(x+rBL,y+h-rBL,rBL,Math.PI/2,x,y+h);arc(x+rTL,y+rTL,rTL,Math.PI,x,y);pts.push(pts[0]);lines=[pts];}
    else lines=[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]];}
  const angle=(Number(obj.rotation)||0)*Math.PI/180;if(!angle)return lines;
  const points=lines.flat(),cx=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,cy=(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2,c=Math.cos(angle),s=Math.sin(angle);
  return lines.map(line=>line.map(([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c]));
}
