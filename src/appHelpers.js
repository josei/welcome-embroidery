// @ts-check
// Small helpers the editor shell uses: copying a document, escaping text for markup, saving a file, naming an export,
// formatting sewing time and keying a sewing tip. They read no editor state, so the shell and its tests share them.
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
export function esc(s){return String(s).replace(/[&<>"']/g,c=>(/** @type {Record<string, string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));}

/**
 * @param {BlobPart} bytes
 * @param {string} name
 * @param {string} type
 * @returns {void}
 */
export function download(bytes,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

/**
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function safeProjectFilename(name){return `${String(name||'Untitled').replace(/\.welcome$/i,'').replace(/[^a-z0-9 _-]/gi,'_').trim()||'Untitled'}.welcome`;}

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
