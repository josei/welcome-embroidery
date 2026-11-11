// @ts-check
// Imported machine stitches: turns a decoded machine file into a stitch layer that the project keeps, with the source bytes so the
// file can be exported unchanged. The engine re-exports makeStitchLayer and importStitchLayer.
import {decodeEmbroidery} from './readers.js';

/** @typedef {import('./readers.js').Decoded} Decoded */

/**
 * @param {Decoded} decoded
 * @param {string} format
 * @param {{id?: string, name?: string, fileName?: string, originalBytesBase64?: string|null, sha256?: string|null, size?: number}} [options]
 * @returns {any}
 */
export function makeStitchLayer(decoded,format,
  {id=crypto.randomUUID(),name='Imported embroidery',fileName='design',originalBytesBase64=null,sha256=null,size=0}={}){
  if(!['jef','vp3','dst','sew','pec','pes','exp','hus','xxx','dsb','dsz','tap','tbf','pcs','shv','stx','bro','emd','ksm','10o','u01'].includes(format)||
    !Array.isArray(decoded?.stitches)||!Array.isArray(decoded?.threads)||!Array.isArray(decoded?.bounds))throw Error('Invalid decoded embroidery source.');
  const [x0,y0,x1,y1]=decoded.bounds,w=Math.max(.1,x1-x0),h=Math.max(.1,y1-y0);
  if(decoded.stitches.length>250000)throw Error('This design exceeds the 250,000 stitch import limit.');
  const first=decoded.threads.find(t=>/^#[0-9a-f]{6}$/i.test(t.color||'')),defaultThread=first?.color||'#527461';
  const placement={x:-w/2,y:-h/2,w,h};
  const fileMeta=decoded.metadata&&typeof decoded.metadata==='object'?{...decoded.metadata}:null,layerName=fileMeta?.name||name;
  return {id,name:layerName,kind:'stitch_layer',...placement,rotation:0,thread:defaultThread,stitch:'run',threads:structuredClone(decoded.threads),stitches:
    structuredClone(decoded.stitches),threadOverrides:{},source:
    {format,fileName:String(fileName).slice(0,240),size,sha256,bounds:[...decoded.bounds],coordinateMapping:'source_mm_centered_on_editor_origin',
    defaultPlacement:placement,defaultThread,warnings:[...(decoded.warnings||[])],...(fileMeta?{metadata:fileMeta}:{}),originalBytesBase64}};
}

/**
 * @param {ArrayBuffer|Uint8Array} bytes
 * @param {string} format
 * @param {{name?: string, fileName?: string, sha256?: string|null}} [metadata]
 * @returns {any}
 */
export function importStitchLayer(bytes,format,metadata={}){
  const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(input.byteLength>1_048_576)throw Error('Integrated machine-file import is limited to 1 MiB so source bytes can be preserved in the .welcome project.');
  const decoded=decodeEmbroidery(input,format),b64=typeof /** @type {any} */(globalThis).Buffer!==
    'undefined'?/** @type {any} */(globalThis).Buffer.from(input).toString('base64'):btoa(String.fromCharCode(...input));
  return makeStitchLayer(decoded,format,{...metadata,size:input.byteLength,originalBytesBase64:b64});
}

/**
 * The point of a stitch layer's source that sits at the centre of its placement. The compiler maps source point s to
 * centre + (s - midpoint), so with a midpoint between 0.1 mm steps (source bounds whose sum is an odd number of 0.1 mm) the
 * translation is off the grid and every point is rounded by up to 0.07 mm. The midpoint is rounded to the 0.1 mm grid here, so
 * a default-placed import (centred at the origin) keeps every source point on the grid. A midpoint exactly halfway between two steps
 * rounds toward zero, so the placement is at most 0.05 mm from the true centre, and a translation is never more than 0.071 mm.
 * @param {number[]} bounds [x0, y0, x1, y1] of the source, in mm
 * @returns {[number, number]}
 */
export function importMidpoint(bounds){
  const [x0,y0,x1,y1]=bounds;return [halfStepMid(x0,x1),halfStepMid(y0,y1)];
}
/**
 * The midpoint of [a, b] in 0.1 mm steps, with a halfway case rounded toward zero. The sum is taken in tenths first so float noise
 * (47.4 - 47.3 is not exactly 0.1) cannot push a tie to the wrong side.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function halfStepMid(a,b){const sum=Math.round((a+b)*10);return Math.trunc(sum/2)/10+0;}

/**
 * @param {string} s
 * @returns {Uint8Array}
 */
export function decodeBase64(s){
  if(typeof /** @type {any} */(globalThis).Buffer!=='undefined')return new Uint8Array(/** @type {any} */(globalThis).Buffer.from(s,'base64'));const b=atob(s),a=
  new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
