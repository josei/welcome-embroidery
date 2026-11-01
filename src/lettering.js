// @ts-check
// Lettering outlines: the stroke glyphs of the built-in single-line lettering (GLYPHS), the neon-blinking font, and the path data they
// are drawn from. The engine re-exports parseSvgPath, so callers keep importing it from engine.js.
import neonFont from '../fonts/neon_blinking/glyphs.js';

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {{font: string, text?: string, x: number, y: number, w?: number, h?: number}} Lettering */

/**
 * @typedef {{nominalSizeMm: number, unitsPerEm: number, minScale: number, maxScale: number, glyphs: Record<string, {advance: number, paths: Array<{d: string}>}>}} NeonFont
 */
/** @type {NeonFont} */
const neon = /** @type {NeonFont} */ (/** @type {unknown} */ (neonFont));

/** @type {(v: number, a: number, b: number) => number} */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** @type {Record<string, number[][]>} */
export const GLYPHS = {
 A:[[0,1,.5,0],[.5,0,1,1],[.22,.62,.78,.62]],B:[[0,1,0,0],[0,0,.68,0],[.68,0,1,.2],[1,.2,.68,.48],[0,.48,.68,.48],[.68,.48,1,.72],[1,.72,.68,1],[0,1,.68,1]],C:[[1,.12,.72,0],[.72,0,.2,0],[.2,0,0,.22],[0,.22,0,.78],[0,.78,.2,1],[.2,1,.75,1],[.75,1,1,.88]],D:[[0,1,0,0],[0,0,.55,0],[.55,0,1,.22],[1,.22,1,.78],[1,.78,.55,1],[.55,1,0,1]],E:[[1,0,0,0],[0,0,0,1],[0,.5,.8,.5],[0,1,1,1]],F:[[0,1,0,0],[0,0,1,0],[0,.5,.78,.5]],G:[[1,.16,.76,0],[.76,0,.2,0],[.2,0,0,.2],[0,.2,0,.8],[0,.8,.2,1],[.2,1,1,1],[1,1,1,.56],[1,.56,.58,.56]],H:[[0,0,0,1],[1,0,1,1],[0,.5,1,.5]],I:[[.18,0,.82,0],[.5,0,.5,1],[.18,1,.82,1]],J:[[.2,0,1,0],[.65,0,.65,.78],[.65,.78,.48,1],[.48,1,.16,1],[.16,1,0,.82]],K:[[0,0,0,1],[1,0,0,.56],[.42,.42,1,1]],L:[[0,0,0,1],[0,1,1,1]],M:[[0,1,0,0],[0,0,.5,.52],[.5,.52,1,0],[1,0,1,1]],N:[[0,1,0,0],[0,0,1,1],[1,1,1,0]],O:[[.22,0,.78,0],[.78,0,1,.2],[1,.2,1,.8],[1,.8,.78,1],[.78,1,.22,1],[.22,1,0,.8],[0,.8,0,.2],[0,.2,.22,0]],P:[[0,1,0,0],[0,0,.72,0],[.72,0,1,.18],[1,.18,.72,.5],[.72,.5,0,.5]],Q:[[.22,0,.78,0],[.78,0,1,.2],[1,.2,1,.8],[1,.8,.78,1],[.78,1,.22,1],[.22,1,0,.8],[0,.8,0,.2],[0,.2,.22,0],[.58,.68,1,1]],R:[[0,1,0,0],[0,0,.72,0],[.72,0,1,.18],[1,.18,.72,.5],[.72,.5,0,.5],[.55,.5,1,1]],S:[[1,.12,.78,0],[.78,0,.2,0],[.2,0,0,.2],[0,.2,.2,.42],[.2,.42,.8,.58],[.8,.58,1,.78],[1,.78,.78,1],[.78,1,.15,1],[.15,1,0,.87]],T:[[0,0,1,0],[.5,0,.5,1]],U:[[0,0,0,.78],[0,.78,.2,1],[.2,1,.8,1],[.8,1,1,.78],[1,.78,1,0]],V:[[0,0,.5,1],[.5,1,1,0]],W:[[0,0,.18,1],[.18,1,.5,.58],[.5,.58,.82,1],[.82,1,1,0]],X:[[0,0,1,1],[1,0,0,1]],Y:[[0,0,.5,.5],[1,0,.5,.5],[.5,.5,.5,1]],Z:[[0,0,1,0],[1,0,0,1],[0,1,1,1]],'0':[[.2,0,.8,0],[.8,0,1,.2],[1,.2,1,.8],[1,.8,.8,1],[.8,1,.2,1],[.2,1,0,.8],[0,.8,0,.2],[0,.2,.2,0]],'1':[[.2,.18,.5,0],[.5,0,.5,1],[.2,1,.8,1]],'2':[[0,.2,.2,0],[.2,0,.8,0],[.8,0,1,.2],[1,.2,0,1],[0,1,1,1]],'3':[[0,.15,.2,0],[.2,0,.8,0],[.8,0,1,.2],[1,.2,.55,.48],[.55,.48,1,.72],[1,.72,.8,1],[.8,1,.15,1],[.15,1,0,.86]],'4':[[0,0,0,.55],[0,.55,1,.55],[.72,0,.72,1]],'5':[[1,0,0,0],[0,0,0,.48],[0,.48,.8,.48],[.8,.48,1,.7],[1,.7,.8,1],[.8,1,.1,1]],'6':[[.9,0,.2,0],[.2,0,0,.28],[0,.28,0,.8],[0,.8,.2,1],[.2,1,.8,1],[.8,1,1,.8],[1,.8,.8,.56],[.8,.56,0,.56]],'7':[[0,0,1,0],[1,0,.25,1]],'8':[[.2,0,.8,0],[.8,0,1,.22],[1,.22,.5,.5],[.5,.5,0,.22],[0,.22,.2,0],[.5,.5,1,.78],[1,.78,.8,1],[.8,1,.2,1],[.2,1,0,.78],[0,.78,.5,.5]],'9':[[.9,.44,.2,.44],[.2,.44,0,.22],[0,.22,.2,0],[.2,0,.8,0],[.8,0,1,.2],[1,.2,1,.72],[1,.72,.8,1],[.8,1,.2,1]]
};

/**
 * @param {Lettering} obj
 * @returns {Pt[][]}
 */
export function textLines(obj) {
  if(obj.font==='neon-blinking/1')return neonLines(obj);
  const s=String(obj.text||'').toUpperCase().slice(0,24),h=clamp(Number(obj.h)||8,4,16),w=Number(obj.w)||h*.72*s.length;
  const cell=w/Math.max(1,s.length);
  /** @type {Pt[][]} */ const out=[];
  [...s].forEach((ch,i)=>{if(ch===' ')return;const glyph=GLYPHS[ch]||GLYPHS['?'];if(!glyph)return;glyph.forEach(([x1,y1,x2,y2])=>out.push([[obj.x+i*cell+x1*cell*.78+cell*.1,obj.y-h+y1*h],[obj.x+i*cell+x2*cell*.78+cell*.1,obj.y-h+y2*h]]));});return out;
}

/**
 * @param {Lettering} obj
 * @returns {Pt[][]}
 */
function neonLines(obj){
  const sizeScale=Number(obj.h)/neon.nominalSizeMm,scale=Number(obj.h)/neon.unitsPerEm,requested=String(obj.text||'').toUpperCase();
  if(!Number.isFinite(scale)||sizeScale<neon.minScale||sizeScale>neon.maxScale)throw Error('Néon blinking lettering size must be 20–60 mm (OFL embroidery font limits).');
  const missing=[...new Set([...requested].filter(ch=>ch!==' '&&!neon.glyphs[ch]))];if(missing.length)throw Error(`Néon blinking supports A–Z, 0–9, space, period, comma, exclamation, question and hyphen; unsupported: ${missing.join(' ')}.`);
  /** @type {Pt[][]} */ const out=[];
  let cursor=0;for(const ch of requested){const glyph=neon.glyphs[ch];if(!glyph){cursor+=neon.glyphs[' '].advance*scale;continue;}for(const sourcePath of glyph.paths)for(const pts of parseSvgPath(sourcePath.d))out.push(pts.map(([x,y])=>/** @type {Pt} */([obj.x+(cursor+x*scale),obj.y+(y-151.18)*scale])));cursor+=glyph.advance*scale;}
  const natural=cursor;if(Number(obj.w)>0&&natural>0){const sx=Number(obj.w)/natural;return out.map(line=>line.map(([x,y])=>/** @type {Pt} */([obj.x+(x-obj.x)*sx,y])));}return out;
}

/**
 * @param {string} d
 * @returns {Pt[][]}
 */
export function parseSvgPath(d){
  const t=d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[a-zA-Z]/g)||[];let i=0,x=0,y=0,sx=0,sy=0;
  /** @type {string|null} */ let cmd=null;
  /** @type {unknown} */ let lastC=null;
  /** @type {Pt[][]} */ const lines=[];
  /** @type {Pt[]} */ let line=[];
  /** @type {() => number} */
  const num=()=>Number(t[i++]);
  /** @type {(a: number, b: number) => void} */
  const point=(a,b)=>{x=a;y=b;line.push([x,y]);};
  /** @type {() => void} */
  const flush=()=>{if(line.length>1)lines.push(line);line=[];};
  while(i<t.length){if(/^[a-z]$/i.test(t[i]))cmd=t[i++];if(!cmd)throw Error('Invalid bundled font path.');
    /** @type {boolean} */ const rel=cmd===cmd.toLowerCase();const c=cmd.toLowerCase();
    if(c==='m'){const a=num(),b=num();flush();x=rel?x+a:a;y=rel?y+b:b;sx=x;sy=y;line=[[x,y]];lastC=null;cmd=rel?'l':'L';}
    else if(c==='l'){const a=num(),b=num();point(rel?x+a:a,rel?y+b:b);lastC=null;}
    else if(c==='h'){const a=num();point(rel?x+a:a,y);lastC=null;}
    else if(c==='v'){const a=num();point(x,rel?y+a:a);lastC=null;}
    else if(c==='c'){const a=num(),b=num(),cc=num(),dd=num(),e=num(),f=num(),x0=x,y0=y,p1=[rel?x+a:a,rel?y+b:b],p2=[rel?x+cc:cc,rel?y+dd:dd],p3=[rel?x+e:e,rel?y+f:f];for(let k=1;k<=8;k++){const q=k/8,r=1-q;line.push([r*r*r*x0+3*r*r*q*p1[0]+3*r*q*q*p2[0]+q*q*q*p3[0],r*r*r*y0+3*r*r*q*p1[1]+3*r*q*q*p2[1]+q*q*q*p3[1]]);}x=p3[0];y=p3[1];lastC=p2;}
    else if(c==='z'){point(sx,sy);flush();x=sx;y=sy;cmd=null;lastC=null;}
    else throw Error(`Unsupported command in bundled font: ${cmd}`);
  }flush();return lines;
}
