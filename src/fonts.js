// @ts-check
// Font registry shared by the engine, the stitch worker, the editor and the server.
// Bundled fonts live in fonts/inkstitch/<id>.json (converted Ink/Stitch fonts) and fonts/ttf/<id>.json (outlines from open
// TrueType fonts); a document can also carry its own glyph subsets in `doc.customFonts` (fonts loaded from a local file).
// Font ids stored in documents: 'inkstitch/<id>', 'ttf/<id>', 'custom/<id>', plus the two legacy ids 'welcome-mono/1' and
// 'neon-blinking/1' that the engine still handles itself.
/** @type {Map<string, any>} */
export const registry=new Map();
/** @type {Map<string, Promise<any>>} */
const pending=new Map();
export const LEGACY_FONTS=new Set(['welcome-mono/1','neon-blinking/1',undefined]);
/** @type {(id: unknown) => boolean} */
export const isRegistryFont=id=>typeof id==='string'&&/^(inkstitch|ttf|custom)\/[A-Za-z0-9_.-]+$/.test(id);
/**
 * @param {string} key
 * @param {any} font
 * @returns {any}
 */
export function registerFont(key,font){if(!font||typeof font.glyphs!=='object'||!isRegistryFont(key))throw Error('Invalid font data.');
  registry.set(key,{...font,key});return registry.get(key);}
/** @type {(id: string|undefined) => any} */
export const getFont=id=>registry.get(/** @type {string} */(id));
/**
 * @param {string|undefined} id
 * @returns {string|null}
 */
export function fontPath(id){const m=/^(inkstitch|ttf)\/([A-Za-z0-9_.-]+)$/.exec(id||'');return m?`fonts/${m[1]}/${m[2]}.json`:null;}
// Load a bundled font once; `fetchJson(path)` is supplied by the caller (fetch in browsers, fs in node).
/**
 * @param {string} id
 * @param {(path: string) => Promise<any>} fetchJson
 * @returns {Promise<any>}
 */
export async function loadFont(id,fetchJson){if(registry.has(id))return registry.get(id);const path=fontPath(id);
  if(!path)throw Error(`Font ${id} is not a bundled font.`);
  if(!pending.has(id))pending.set(id,
    fetchJson(path).then(font=>{registerFont(id,font);pending.delete(id);return registry.get(id);},error=>{pending.delete(id);throw error;}));
    return pending.get(id);}
/**
 * @param {any} doc the editor's untyped document
 * @returns {string[]}
 */
export function documentFontIds(doc){
  return [...new Set((doc?.objects||[]).filter((/** @type {any} */ o)=>o.kind==='text'&&isRegistryFont(o.font)).map((/** @type {any} */ o)=>o.font))];}
// Register the glyph subsets stored in the document so the engine can lay text out without any network access.
/**
 * @param {any} doc the editor's untyped document
 * @returns {void}
 */
export function registerDocumentFonts(doc){
  for(const [id,font] of Object.entries(doc?.customFonts||{}))if(!registry.has(`custom/${id}`))registerFont(`custom/${id}`,font);}
