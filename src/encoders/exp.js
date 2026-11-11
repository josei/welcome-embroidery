// @ts-check
// EXP (Melco): signed byte pairs in 0.1 mm, with jump, colour change and trim markers.

/** @typedef {import('../encoders.js').Plan} Plan */

import {splitLongStitches, stitchRule} from './shared.js';

// EXP (Melco): signed byte pairs in 0.1 mm, y negated; 80 04 = jump, 80 01 = colour change, 80 80 07 00 = trim, no header.
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeExp(plan){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  plan={...plan,stitches:splitLongStitches(plan.stitches,stitchRule('exp'))};
  /** @type {number[]} */ const out=[];
  let x=0,y=0;
  /** @type {(nx: number, ny: number, jump: boolean) => void} */
  const move=(nx,ny,jump)=>
    {let dx=nx-x,dy=ny-y;
    // A zero-length stitch is kept as a 00 00 stitch record (the format has no other way to say it), so the count matches the plan.
    if(!jump&&dx===0&&dy===0){out.push(0,0);return;}
    while(dx!==0||dy!==0){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));if(jump)out.push(0x80,0x04);out.push(sx&0xff,(-sy)&0xff);
    dx-=sx;dy-=sy;x+=sx;y+=sy;}};
  for(const p of plan.stitches){const nx=Math.round(p.x*10),ny=Math.round(p.y*10);if(p.cmd==='end')continue;
    if(p.cmd==='color'||p.cmd==='stop'){out.push(0x80,0x01,0,0);move(nx,ny,true);}else if(p.cmd==='jump')move(nx,ny,true);
    else if(p.cmd==='trim')out.push(0x80,0x80,0x07,0x00);else if(p.cmd==='stitch')move(nx,ny,false);
    else throw Error(`Unsupported stitch command for EXP: ${p.cmd}`);}
  return Uint8Array.from(out);
}
