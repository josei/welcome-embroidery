// @ts-check
// List, number and byte helpers shared by the machine-format writers.

/**
 * The last item of a non-empty list.
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
export const last=list=>/** @type {T} */(list.at(-1));

/** @type {(v: number, a: number, b: number) => number} */
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** @type {(s: string, n: number) => number[]} */
export const ascii=(s,n)=>Array.from({length:n},(_,i)=>s.charCodeAt(i)||0);
/** @type {(n: number) => number[]} */
export const be16=n=>[(n>>8)&255,n&255];
/** @type {(n: number) => number[]} */
export const be32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
/** @type {(n: number) => number[]} */
export const i8=n=>[n&255];
