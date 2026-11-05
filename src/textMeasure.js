// @ts-check
import {getFont,isRegistryFont} from './fonts.js';
import {layoutText} from './textlayout.js';
import neonFont from '../fonts/neon_blinking/glyphs.js';
/** @type {Record<string, {advance: number}>} */
const glyphs=neonFont.glyphs;

/** @param {string} text @param {string} [font] @param {number} [size] @param {Record<string, any>} [options] @returns {number} */
export function measureText(text,font='welcome-mono/1',size=8,options={}){if(isRegistryFont(font)){const f=getFont(font);if(f)return layoutText({...options,text,font,h:size,w:0,x:0,y:0},f,{buffer:null}).width;return String(text).length*size*.6;}if(font==='neon-blinking/1')return [...String(text).toUpperCase()].reduce((n,ch)=>n+(glyphs[ch]?.advance||glyphs[' '].advance)*size/neonFont.unitsPerEm,0);return String(text).length*size*.72;}
