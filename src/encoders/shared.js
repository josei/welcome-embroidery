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

/**
 * How long a single stitch may be in one format: limitMm, measured along the stitch (perAxis false, the Brother and Pfaff rule) or on its longer axis (perAxis
 * true, for the records that hold a signed delta per axis).
 * @typedef {{limitMm: number, perAxis: boolean}} StitchRule
 */
// Longest non-jump move the Brother (PEC, PES, PES v6) and Pfaff (VP3) writers emit in one stitch, measured along the stitch. Longer moves are split (see below).
export const MAX_STITCH_MM=12.7;
/** @type {StitchRule} */
const BROTHER_RULE={limitMm:MAX_STITCH_MM,perAxis:false};
// Per-axis record limits. DST records carry at most 121 units (12.1 mm) per axis; XXX keeps every delta within ±123 units so no stitch byte reads as a
// 7D/7E/7F marker; EXP, SEW, U01, TBF and JEF carry 127 units (12.7 mm) per axis.
/** @type {Record<string, StitchRule>} */
const RULES={
  dst:{limitMm:12.1,perAxis:true},xxx:{limitMm:12.3,perAxis:true},
  exp:{limitMm:MAX_STITCH_MM,perAxis:true},sew:{limitMm:MAX_STITCH_MM,perAxis:true},u01:{limitMm:MAX_STITCH_MM,perAxis:true},
  tbf:{limitMm:MAX_STITCH_MM,perAxis:true},jef:{limitMm:MAX_STITCH_MM,perAxis:true},
};
/** @param {string} format @returns {StitchRule} */
export const stitchRule=format=>RULES[format]??BROTHER_RULE;
// Each split piece is this much shorter than the limit, so the 0.1 mm rounding the writers apply cannot push a piece past the limit.
const SPLIT_MARGIN_MM=0.2;

/** @param {{x: number, y: number}} prev @param {{x: number, y: number}} s @param {StitchRule} rule @returns {number} */
const lengthOf=(prev,s,rule)=>rule.perAxis?Math.max(Math.abs(s.x-prev.x),Math.abs(s.y-prev.y)):Math.hypot(s.x-prev.x,s.y-prev.y);

/**
 * True when a stitch is longer than its rule allows from the point before it (jumps and trims are not checked).
 * @param {{x: number, y: number}|null} prev
 * @param {{x: number, y: number, cmd: string}} s
 * @param {StitchRule} [rule]
 * @returns {boolean}
 */
// The 1e-6 tolerance keeps a move of exactly the limit (12.7 mm, from float subtraction) from counting as long.
export const isLongStitch=(prev,s,rule=BROTHER_RULE)=>s.cmd==='stitch'&&!!prev&&lengthOf(prev,s,rule)>rule.limitMm+1e-6;

/**
 * Splits each long non-jump move into equal stitches on the same line, each within the rule's limit less a rounding margin, in the same thread and command.
 * Jumps, trims and short moves are untouched. The walk starts at the machine origin (0, 0), which is where the writers start too.
 * @template {{x: number, y: number, cmd: string, thread: string}} P
 * @param {P[]} stitches
 * @param {StitchRule} [rule]
 * @returns {P[]}
 */
export function splitLongStitches(stitches,rule=BROTHER_RULE){
  const stepMm=rule.limitMm-SPLIT_MARGIN_MM;
  /** @type {P[]} */ const out=[];
  /** @type {{x: number, y: number}} */ let prev={x:0,y:0};
  for(const s of stitches){
    if(isLongStitch(prev,s,rule)){
      const n=Math.ceil(lengthOf(prev,s,rule)/stepMm);
      for(let k=1;k<n;k++)out.push({...s,x:prev.x+(s.x-prev.x)*k/n,y:prev.y+(s.y-prev.y)*k/n});
    }
    out.push(s);
    if(s.cmd!=='end')prev=s;
  }
  return out;
}
