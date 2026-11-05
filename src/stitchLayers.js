// @ts-check
import {decodeEmbroidery} from './readers.js';

/** @param {any} decoded @param {string} format @param {{id?: string, name?: string, fileName?: string, originalBytesBase64?: string | null, sha256?: string | null, size?: number}} [options] */
export function makeStitchLayer(decoded,format,{id=crypto.randomUUID(),name='Imported embroidery',fileName='design',originalBytesBase64=null,sha256=null,size=0}={}){
  if(!['jef','vp3','dst','sew','pec','pes','exp','hus','xxx','dsb','dsz','tap','tbf','pcs','shv','stx','bro','emd','ksm','10o'].includes(format)||!Array.isArray(decoded?.stitches)||!Array.isArray(decoded?.threads)||!Array.isArray(decoded?.bounds))throw Error('Invalid decoded embroidery source.');
  const [x0,y0,x1,y1]=decoded.bounds,w=Math.max(.1,x1-x0),h=Math.max(.1,y1-y0);
  if(decoded.stitches.length>250000)throw Error('This design exceeds the 250,000 stitch import limit.');
  const first=decoded.threads.find((/** @type {any} */ t)=>/^#[0-9a-f]{6}$/i.test(t.color||'')),defaultThread=first?.color||'#527461';
  const placement={x:-w/2,y:-h/2,w,h};
  const fileMeta=decoded.metadata&&typeof decoded.metadata==='object'?{...decoded.metadata}:null,layerName=fileMeta?.name||name;
  return {id,name:layerName,kind:'stitch_layer',...placement,rotation:0,thread:defaultThread,stitch:'run',threads:structuredClone(decoded.threads),stitches:structuredClone(decoded.stitches),threadOverrides:{},source:{format,fileName:String(fileName).slice(0,240),size,sha256,bounds:[...decoded.bounds],coordinateMapping:'source_mm_centered_on_editor_origin',defaultPlacement:placement,defaultThread,warnings:[...(decoded.warnings||[])],...(fileMeta?{metadata:fileMeta}:{}),originalBytesBase64}};
}
/** @param {Uint8Array | ArrayBuffer} bytes @param {string} format @param {Record<string, any>} [metadata] */
export function importStitchLayer(bytes,format,metadata={}){
  const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(input.byteLength>1_048_576)throw Error('Integrated machine-file import is limited to 1 MiB so source bytes can be preserved in the .welcome project.');
  const nodeBuffer=/** @type {any} */(globalThis).Buffer;
  const decoded=decodeEmbroidery(input,format),b64=nodeBuffer?nodeBuffer.from(input).toString('base64'):btoa(String.fromCharCode(...input));
  return makeStitchLayer(decoded,format,{...metadata,size:input.byteLength,originalBytesBase64:b64});
}
