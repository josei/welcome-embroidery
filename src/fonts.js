// Font registry shared by the engine, the stitch worker, the editor and the server.
// Bundled fonts live in fonts/inkstitch/<id>.json (converted Ink/Stitch fonts) and fonts/ttf/<id>.json (outlines from open
// TrueType fonts); a document can also carry its own glyph subsets in `doc.customFonts` (fonts loaded from a local file).
// Font ids stored in documents: 'inkstitch/<id>', 'ttf/<id>', 'custom/<id>', plus the two legacy ids 'welcom-mono/1' and
// 'neon-blinking/1' that the engine still handles itself.
export const registry=new Map();
const pending=new Map();
export const LEGACY_FONTS=new Set(['welcom-mono/1','neon-blinking/1',undefined]);
export const isRegistryFont=id=>typeof id==='string'&&/^(inkstitch|ttf|custom)\/[A-Za-z0-9_.-]+$/.test(id);
export function registerFont(key,font){if(!font||typeof font.glyphs!=='object'||!isRegistryFont(key))throw Error('Invalid font data.');registry.set(key,{...font,key});return registry.get(key);}
export const getFont=id=>registry.get(id);
export function fontPath(id){const m=/^(inkstitch|ttf)\/([A-Za-z0-9_.-]+)$/.exec(id||'');return m?`fonts/${m[1]}/${m[2]}.json`:null;}
// Load a bundled font once; `fetchJson(path)` is supplied by the caller (fetch in browsers, fs in node).
export async function loadFont(id,fetchJson){if(registry.has(id))return registry.get(id);const path=fontPath(id);if(!path)throw Error(`Font ${id} is not a bundled font.`);
  if(!pending.has(id))pending.set(id,fetchJson(path).then(font=>{registerFont(id,font);pending.delete(id);return registry.get(id);},error=>{pending.delete(id);throw error;}));return pending.get(id);}
export function documentFontIds(doc){return [...new Set((doc?.objects||[]).filter(o=>o.kind==='text'&&isRegistryFont(o.font)).map(o=>o.font))];}
// Register the glyph subsets stored in the document so the engine can lay text out without any network access.
export function registerDocumentFonts(doc){for(const [id,font] of Object.entries(doc?.customFonts||{}))if(!registry.has(`custom/${id}`))registerFont(`custom/${id}`,font);}
