// @ts-check
// Thread colour helpers: colours compare without case, the user's own thread stock is parsed from text, and the nearest stock thread to a colour is found.
// The engine's compile step and the editor's stock list use these; the engine re-exports the names callers use.

/** @typedef {{colours: string[], invalid: number}} ThreadStock */
/** @typedef {{hex: string, index: number, distance: number}} NearestThread */

// Two thread colours are the same when they match without case.
// Two thread strings name the same colour when they differ only in case (#D9897E and #d9897e).
/** @type {(a: unknown, b: unknown) => boolean} */
export const sameThread=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();

// The user's own thread stock: a list of six-digit hex colours, one per line (commas and spaces are also accepted). Returns the valid colours, each once, and
// how many entries were not valid colours.
/**
 * @param {unknown} text
 * @returns {ThreadStock}
 */
export function parseThreadStock(text){const entries=String(text??'').split(/[\s,]+/).filter(Boolean);
  /** @type {string[]} */
  const colours=[];let invalid=0;
    for(const e of entries){const m=e.match(/^#?([0-9a-f]{6})$/i);if(!m){invalid++;continue;}const hex='#'+m[1].toLowerCase();
    if(!colours.includes(hex))colours.push(hex);}return {colours,invalid};}

// The nearest thread in the stock to a colour, by squared RGB distance: {hex, index (1-based in the stock), distance}, or null when the stock is empty.
/**
 * @param {string} hex
 * @param {unknown} stock
 * @returns {NearestThread|null}
 */
export function nearestStockThread(hex,stock){if(!Array.isArray(stock)||!stock.length)return null;
  /** @type {(h: string) => number[]} */
  const rgb=h=>[0,2,4].map(i=>parseInt(h.slice(1+i,3+i),16));
  const a=rgb(hex);
  /** @type {NearestThread|null} */
  let best=null;
  stock.forEach((s,i)=>{const b=rgb(s),d=(b[0]-a[0])**2+(b[1]-a[1])**2+(b[2]-a[2])**2;if(!best||d<best.distance)best={hex:s,index:i+1,distance:d};});
    return best;}
