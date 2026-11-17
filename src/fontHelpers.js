// @ts-check
// Font helpers: which bundled and custom fonts a document uses, and how wide a line of text is.
// The engine re-exports the names callers use.
import neonFont from '../fonts/neon_blinking/glyphs.js';
import {getFont,isRegistryFont} from './fonts.js';
import {layoutText} from './textlayout.js';

// The editor's document is an untyped record at this boundary (the editor passes its state straight in), so its fields are read as any.
/** @typedef {Record<string, any>} Doc */

// The neon font's glyph table, typed for the width lookup.
/** @type {{glyphs: Record<string, {advance: number}>, unitsPerEm: number, nominalSizeMm: number, minScale: number, maxScale: number}} */
const neon=/** @type {any} */(neonFont);

// Bundled fonts (Ink/Stitch and open TrueType, registry ids) that lettering in the document uses, with the lettering that uses each. Read-only: bundled fonts
// ship with the app and are not removed here.
/**
 * @param {Doc} doc
 * @returns {Array<{id: string, uses: string[]}>}
 */
export function bundledFontUsage(doc){
  /** @type {Map<string, string[]>} */
  const m=new Map();
    for(const o of doc.objects){if(o.kind!=='text'||!isRegistryFont(o.font)||o.font.startsWith('custom/'))continue;let uses=m.get(o.font);
    if(!uses){uses=[];m.set(o.font,uses);}uses.push(o.name||'Text');}return [...m].map(([id,uses])=>({id,uses}));}
// Organize fonts: each custom font in the document, with the lettering objects that use it.
/**
 * @param {Doc} doc
 * @returns {Array<{id: string, name: string, uses: string[]}>}
 */
export function customFontUsage(doc){
  return Object.entries(doc.customFonts||
  {}).map(([id,f])=>(
  {id,name:f.name||id,
  uses:/** @type {Array<Record<string, any>>} */(doc.objects).filter(o=>o.kind==='text'&&o.font===`custom/${id}`).map(o=>o.name||'Text')}));}
/**
 * @param {string} text
 * @param {string} [font]
 * @param {number} [size]
 * @param {Record<string, any>} [options]
 * @returns {number}
 */
export function measureText(text,font='welcome-mono/1',size=8,options={}){
  if(isRegistryFont(font)){const f=getFont(font);if(f)return layoutText({...options,text,font,h:size,w:0,x:0,y:0},f,{buffer:/** @type {any} */(null)}).width;
  return String(text).length*size*.6;}if(font==='neon-blinking/1')return [...String(text).toUpperCase()].reduce((n,ch)=>
  n+(neon.glyphs[ch]?.advance||neon.glyphs[' '].advance)*size/neon.unitsPerEm,0);return String(text).length*size*.72;}

// The smallest height lettering may have in any font, in millimetres. A registry font's own minimum is its design size times
// its minScale, which is more than this for most fonts; the floor lets a height kept across a font change stay valid.
export const MIN_TEXT_HEIGHT_MM=4;

/**
 * The height range, in millimetres, that lettering in a bundled font may have: a registry font's design size scaled by its
 * limits (with the floor above), Néon blinking's nominal size scaled by its limits, and Welcome Mono's 4–16 mm.
 * @param {string} fid
 * @returns {{lo: number, hi: number}|null} null for a registry font that is not loaded
 */
export function textHeightRange(fid){
  if(fid==='neon-blinking/1')return {lo:neon.nominalSizeMm*neon.minScale,hi:neon.nominalSizeMm*neon.maxScale};
  if(isRegistryFont(fid)){const f=getFont(fid);
    return f?{lo:Math.min(f.size*f.minScale,MIN_TEXT_HEIGHT_MM),hi:f.size*f.maxScale}:null;}
  return {lo:MIN_TEXT_HEIGHT_MM,hi:16};
}

/**
 * The text a document stores for a font. Registry fonts keep the lines typed. The single-line font keeps the casing typed,
 * on one line of at most 24 characters: it is drawn in capitals, so the stored text stays what the user wrote.
 * @param {string|undefined} fid
 * @param {string} text
 * @returns {string}
 */
export function storedText(fid,text){
  return isRegistryFont(fid)?text:String(text).replace(/\n/g,' ').slice(0,24);
}

/**
 * The operations for switching lettering to a font. The text keeps its casing (see storedText), and the height stays as it
 * was in millimetres, so the lettering does not jump to the new font's design size. Only a text too wide or too tall for
 * the hoop is scaled down, and the lettering is moved back inside the hoop when the new size would leave it outside.
 * The height is kept within the new font's range (see textHeightRange).
 * @param {Record<string, any>} o the lettering object before the change
 * @param {string} fid the font to switch to
 * @param {{w: number, h: number}} hoop the hoop size in mm, centred on the origin
 * @param {(probe: Record<string, any>) => number[]} boundsOf the object's bounds [x0, y0, x1, y1] as the engine draws it
 * @returns {Record<string, any>[]}
 */
export function fontChangeOps(o,fid,hoop,boundsOf){
  const f=isRegistryFont(fid)?getFont(fid):null;
  const text=storedText(fid,o.text);
  const stitch=f?.kind==='outline'?(getFont(o.font)?.kind==='outline'&&o.stitch==='run'?'run':'fill'):'run';
  let height=Number(o.h)||8;
  const range=textHeightRange(fid);
  if(range)height=Math.min(range.hi,Math.max(range.lo,height));
  const limitW=hoop.w*0.85,limitH=hoop.h*0.85;
  let width=measureText(text,fid,height,o);
  const shrink=Math.min(1,width>limitW?limitW/width:1,height>limitH?limitH/height:1);
  if(shrink<1){height=+(height*shrink).toFixed(2);width=measureText(text,fid,height,o);}
  const probe={...o,font:fid,text,stitch,h:height,w:width,x:Number(o.x)||0,y:Number(o.y)||0};
  const [x0,y0,x1,y1]=boundsOf(probe);
  const x=probe.x+shiftInside(x0,x1,-hoop.w/2,hoop.w/2),y=probe.y+shiftInside(y0,y1,-hoop.h/2,hoop.h/2);
  return [
    {op:'set_object',id:o.id,font:fid,text,stitch},
    {op:'transform',id:o.id,x,y,height,width},
  ];
}

/**
 * How far a span [lo, hi] must move to lie inside [min, max]; zero when it already fits or is wider than the span.
 * @param {number} lo
 * @param {number} hi
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function shiftInside(lo,hi,min,max){
  if(hi-lo>max-min)return 0;
  if(lo<min)return min-lo;
  if(hi>max)return max-hi;
  return 0;
}
