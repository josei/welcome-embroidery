// @ts-check
// Font helpers: which bundled and custom fonts a document uses, and how wide a line of text is.
// The engine re-exports the names callers use.
import neonFont from '../fonts/neon_blinking/glyphs.js';
import {getFont,isRegistryFont} from './fonts.js';
import {layoutText} from './textlayout.js';

// The editor's document is an untyped record at this boundary (the editor passes its state straight in), so its fields are read as any.
/** @typedef {Record<string, any>} Doc */

// The neon font's glyph table, typed for the width lookup.
/** @type {{glyphs: Record<string, {advance: number}>, unitsPerEm: number}} */
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
    if(!uses){uses=[];m.set(o.font,uses);}uses.push(o.name||'Lettering');}return [...m].map(([id,uses])=>({id,uses}));}
// Organize fonts: each custom font in the document, with the lettering objects that use it.
/**
 * @param {Doc} doc
 * @returns {Array<{id: string, name: string, uses: string[]}>}
 */
export function customFontUsage(doc){
  return Object.entries(doc.customFonts||
  {}).map(([id,f])=>(
  {id,name:f.name||id,
  uses:/** @type {Array<Record<string, any>>} */(doc.objects).filter(o=>o.kind==='text'&&o.font===`custom/${id}`).map(o=>o.name||'Lettering')}));}
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
