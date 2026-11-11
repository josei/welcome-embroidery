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

// Longest non-jump move the Brother (PEC, PES, PES v6) and Pfaff (VP3) writers emit in one stitch. Longer moves are split (see below).
export const MAX_STITCH_MM=12.7;
// Split target, a little under the limit so the 0.1 mm rounding the writers apply cannot push a piece past MAX_STITCH_MM.
const SPLIT_STEP_MM=12.5;

/**
 * True when a stitch moves farther than MAX_STITCH_MM from the point before it (jumps and trims are not checked).
 * @param {{x: number, y: number}|null} prev
 * @param {{x: number, y: number, cmd: string}} s
 * @returns {boolean}
 */
export const isLongStitch=(prev,s)=>s.cmd==='stitch'&&!!prev&&Math.hypot(s.x-prev.x,s.y-prev.y)>MAX_STITCH_MM;

/**
 * Splits each long non-jump move into equal stitches of at most SPLIT_STEP_MM, in the same thread and command. Jumps, trims and short moves are untouched.
 * The walk starts at the machine origin (0, 0), which is where the writers start too.
 * @template {{x: number, y: number, cmd: string, thread: string}} P
 * @param {P[]} stitches
 * @returns {P[]}
 */
export function splitLongStitches(stitches){
  /** @type {P[]} */ const out=[];
  /** @type {{x: number, y: number}} */ let prev={x:0,y:0};
  for(const s of stitches){
    if(isLongStitch(prev,s)){
      const n=Math.ceil(Math.hypot(s.x-prev.x,s.y-prev.y)/SPLIT_STEP_MM);
      for(let k=1;k<n;k++)out.push({...s,x:prev.x+(s.x-prev.x)*k/n,y:prev.y+(s.y-prev.y)*k/n});
    }
    out.push(s);
    if(s.cmd!=='end')prev=s;
  }
  return out;
}
