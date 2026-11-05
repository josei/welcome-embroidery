// @ts-check
// Which lettering uses which font in a document: bundled registry fonts and the document's own custom fonts. Read-only.
import {isRegistryFont} from './fonts.js';

// Organize fonts: each custom font in the document, with the lettering objects that use it.
// Bundled fonts (Ink/Stitch and open TrueType, registry ids) that lettering in the document uses, with the lettering that uses each. Read-only: bundled fonts ship with the app and are not removed here.
/** @param {Record<string, any>} doc */
export function bundledFontUsage(doc){const m=new Map();for(const o of doc.objects){if(o.kind!=='text'||!isRegistryFont(o.font)||o.font.startsWith('custom/'))continue;if(!m.has(o.font))m.set(o.font,[]);m.get(o.font).push(o.name||'Lettering');}return [...m].map(([id,uses])=>({id,uses}));}
/** @param {Record<string, any>} doc */
export function customFontUsage(doc){return Object.entries(doc.customFonts||{}).map(([id,f])=>({id,name:f.name||id,uses:/** @type {Array<Record<string, any>>} */(doc.objects).filter(o=>o.kind==='text'&&o.font===`custom/${id}`).map(o=>o.name||'Lettering')}));}
