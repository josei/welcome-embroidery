// @ts-check
// Preferences the editor keeps in this browser: the saved hoop size, the user's thread stock, and which sewing-tip
// categories and individual tips are hidden. Each reads its stored value defensively, so a bad value falls back to the default.
import {parseThreadStock} from './threads.js';

/**
 * @param {any} d the document being opened or created
 * @returns {any}
 */
export const withSavedHoop=d=>
  {
  try{const h=JSON.parse(localStorage.getItem('welcome.hoop')||'null');
  if(h&&Number.isFinite(h.w)&&Number.isFinite(h.h)&&h.w>=10&&h.w<=400&&h.h>=10&&h.h<=400){d.hoop=h.w;if(h.h===h.w)delete d.hoopH;else d.hoopH=h.h;}}catch{
  }return d;};

/** The key the thread stock is saved under. */
export const STOCK_KEY='welcome.threadStock';

/**
 * @returns {import('./threads.js').ThreadStock}
 */
export function threadStock(){try{return parseThreadStock(localStorage.getItem(STOCK_KEY)||'');}catch{return parseThreadStock('');}}

/** The key the hidden sewing-tip categories are saved under. */
export const TIPS_KEY='welcome.hiddenTips';

/**
 * @returns {string[]}
 */
export function hiddenTips(){
  try{const v=JSON.parse(localStorage.getItem(TIPS_KEY)||'[]');return Array.isArray(v)?v.filter((/** @type {any} */ x)=>typeof x==='string'):[];}catch{
  return [];}}

/**
 * @returns {string}
 */
export function ignoredTipsKey(){return 'welcome.ignoredTips';}

/**
 * @returns {Set<string>}
 */
export function ignoredTips(){
 try{
  const v=JSON.parse(localStorage.getItem(ignoredTipsKey())||'[]');
  return new Set(Array.isArray(v)?v.filter((/** @type {any} */ x)=>typeof x==='string'):[]);
 }catch{return new Set();}
}
