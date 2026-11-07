// @ts-check
// SEW (Janome native): thread-chart indices, then the EXP-style stitch stream.

/** @typedef {import('../encoders.js').Plan} Plan */

import {SEW_CHART} from '../readers.js';
import {last} from './shared.js';

/** @param {string|null|undefined} hex @returns {number} */
const sewChartIndex=hex=>
  {const m=/^#?([0-9a-f]{6})$/i.exec(hex||"")||[0,"527461"];const n=parseInt(m[1],16),c=[n>>16&255,n>>8&255,n&255];let best=0,bd=Infinity;
  SEW_CHART.forEach((r,i)=>{const d=(r[0]-c[0])**2+(r[1]-c[1])**2+(r[2]-c[2])**2;if(d<bd){bd=d;best=i;}});return best;};
// SEW (Janome native): a 2-byte colour count and 2-byte thread-chart indices, zeros up to offset 0x1D78, then the EXP-style stitch stream
// (signed byte pairs in 0.1 mm, y negated; 80 04 = jump, 80 01 = colour change, 80 00 = end). The pyembroidery SewReader has no trim record,
// so trims are not written and the next jump still moves the needle. Export only; checked by decoding with pyembroidery (scripts/verify-sew.mjs).
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeSew(plan){
 if(plan.errors.length)throw Error(plan.errors.join(' '));
 /** @type {string[]} */ const blocks=[plan.stitches.find(p=>p.cmd!=='end'&&p.thread)?.thread||'#527461'];
 for(const p of plan.stitches)if(p.cmd==='color'||p.cmd==='stop')blocks.push(p.thread||last(blocks));
 if(blocks.length>255)throw Error('SEW supports up to 255 colour blocks.');
 /** @type {number[]} */ const out=[blocks.length&0xff,blocks.length>>8];for(const hex of blocks){const i=sewChartIndex(hex);out.push(i&0xff,i>>8);}
 while(out.length<0x1D78)out.push(0);
 let x=0,y=0;
 /** @type {(nx: number, ny: number, jump: boolean) => void} */
 const move=(nx,ny,jump)=>
   {let dx=nx-x,dy=ny-y;
   while(dx!==0||dy!==0){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));if(jump)out.push(0x80,0x04);out.push(sx&0xff,(-sy)&0xff);
   dx-=sx;dy-=sy;x+=sx;y+=sy;}};
 for(const p of plan.stitches){const nx=Math.round(p.x*10),ny=Math.round(p.y*10);if(p.cmd==='end')continue;
   if(p.cmd==='color'||p.cmd==='stop'){out.push(0x80,0x01,0,0);move(nx,ny,true);}else if(p.cmd==='jump')move(nx,ny,true);else if(p.cmd==='trim')continue;
   else if(p.cmd==='stitch')move(nx,ny,false);else throw Error(`Unsupported stitch command for SEW: ${p.cmd}`);}
 out.push(0x80,0x00,0,0);return Uint8Array.from(out);
}
