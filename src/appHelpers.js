// @ts-check
// Small helpers the editor shell uses: copying a document, escaping text for markup, saving a file, naming an export,
// formatting sewing time and keying a sewing tip. They read no editor state, so the shell and its tests share them.
import {t} from './i18n.js';
import {sewingSeconds} from './sewingTime.js';

/**
 * @param {any} v
 * @returns {any}
 */
export function clone(v){return structuredClone(v);}

/**
 * @param {unknown} s
 * @returns {string}
 */
export function esc(s){
  return String(s).replace(/[&<>"']/g,c=>(/** @type {Record<string, string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));}

/**
 * @param {BlobPart} bytes
 * @param {string} name
 * @param {string} type
 * @returns {void}
 */
export function download(bytes,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type}));a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

/**
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function safeProjectFilename(name){
  const stem=String(name||'').replace(/\.welcome$/i,'').replace(/[\/\\:*?"<>|\u0000-\u001F\u007F]/g,'_').trim();
  // Windows reserves these device names, with or without an extension, so the base name gets a trailing `_`.
  const safe=/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?=\.|$)/i.test(stem)?stem.replace(/^([^.]*)/,'$1_'):stem;
  return `${safe||t('Untitled design')}.welcome`;}

/**
 * The name an export file gets: the document name without `.welcome`, with the default name translated.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function exportStem(name){
  const stem=safeProjectFilename(name).replace(/\.welcome$/i,'');
  return stem==='Untitled design'?t(stem):stem;}

/**
 * @param {any} p the plan's sewing span, as sewingSeconds reads it
 * @returns {string}
 */
export function sewTime(p){const m=Math.max(1,Math.round(sewingSeconds(p)/60));return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min`;}

/**
 * @param {{id: string, category: string, message: string}} w
 * @returns {string}
 */
export function tipKey(w){return `${w.id}|${w.category}|${w.message}`;}

/**
 * @param {any} d the document to send to the stitch worker
 * @returns {any} a copy without the reference image
 */
export function forWorker(d){const c=clone(d);delete c.reference;return c;}
