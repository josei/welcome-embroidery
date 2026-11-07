// @ts-check
// JEF (Janome): thread slots into Janome's colour chart, then stitch records in 0.1 mm.

/** @typedef {import('../encoders.js').Plan} Plan */
/** @typedef {import('../encoders.js').JefBlock} JefBlock */

import {clamp} from './shared.js';
import {nearestJefColor} from '../jefPalette.js';

/** @param {Plan} plan @param {string} [color] @param {number|{w: number, h: number}} [hoop] @returns {Uint8Array} */
export function encodeJef(plan,color='#527461',hoop=110) {
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  // A true STOP is written like pyembroidery does: the 80 01 code with an extra thread slot whose palette entry is 0 (toggled back to the previous colour on
  // the next STOP).
  /** @type {JefBlock[]} */ const blocks=[];
  /** @type {JefBlock|null} */ let block=null;let stopToggled=false;
    for(const p of plan.stitches){
    if(!block){block={thread:p.thread||color,items:[]};blocks.push(block);}if(p.cmd==='color'){block={thread:p.thread||color,items:[]};blocks.push(block);
    }else if(p.cmd==='stop'){stopToggled=!stopToggled;block={thread:block.thread,palette:stopToggled?0:undefined,items:[]};blocks.push(block);
    }else block.items.push(p);}if(!blocks.length)blocks.push({thread:color,items:[]});
  /** @type {number[]} */ const raw=[];
  let x=0,y=0,jumpCount=0,changeCount=0,needleCount=0,trimCount=0;
  /** @type {(dx: number, dy: number) => void} */
  const jump=(dx,dy)=>{while(dx!==0||dy!==0){const a=clamp(dx,-127,127),b=clamp(dy,-127,127);raw.push(128,2,a&255,(-b)&255);dx-=a;dy-=b;jumpCount++;}};
  for(let i=0;i<plan.stitches.length;i++){const p=plan.stitches[i];
    if(p.cmd==='end'){
    if(plan.stitches.slice(i+1).some(s=>s.cmd==='stitch'||s.cmd==='jump'||s.cmd==='color'||s.cmd==='stop'||s.cmd==='trim'))throw Error(
    'JEF cannot encode commands after end.');continue;}const nx=Math.round(p.x*10),ny=Math.round(p.y*10),dx=nx-x,dy=ny-y;x=nx;y=ny;
    if(p.cmd==='color'||p.cmd==='stop'){
      if(Math.abs(dx)>127||Math.abs(dy)>127){jump(dx,dy);raw.push(128,1,0,0);}else raw.push(128,1,dx&255,(-dy)&255);
      changeCount++;
    }else if(p.cmd==='jump')jump(dx,dy);
    else if(p.cmd==='trim'){if(dx||dy)jump(dx,dy);raw.push(128,2,0,0);trimCount++;}
    else if(p.cmd==='stitch'){
      if(Math.abs(dx)>127||Math.abs(dy)>127)throw Error('JEF stitch delta exceeds 12.7 mm. Recompile with a shorter stitch length.');
      raw.push(dx&255,(-dy)&255);needleCount++;
    }else throw Error(`Unsupported stitch command for JEF: ${p.cmd}`);
  }
  raw.push(128,16);
  const threadCount=blocks.length,offset=116+threadCount*8;
  /** @type {number[]} */ const buf=new Array(offset).fill(0);
  /** @type {(at: number, v: number) => void} */
  const put32=(at,v)=>{buf[at]=v&255;buf[at+1]=(v>>>8)&255;buf[at+2]=(v>>>16)&255;buf[at+3]=(v>>>24)&255;};
  put32(0,offset);put32(4,0x14);const date='20260101000000';date.split('').forEach((c,i)=>buf[8+i]=c.charCodeAt(0));put32(24,threadCount);
    put32(28,needleCount+jumpCount*2+changeCount*2+trimCount*2+1);
  /** @type {(v: number) => number} */
  const pyRound=v=>{const f=Math.floor(v),d=v-f;return d<.5?f:d>.5?f+1:(f%2===0?f:f+1);};
  const ext=
    plan.stitches.filter(p=>p.cmd!==
    'end').reduce((m,p)=>[Math.min(m[0],Math.round(p.x*10)),Math.min(m[1],Math.round(p.y*10)),Math.max(m[2],Math.round(p.x*10)),
    Math.max(m[3],Math.round(p.y*10))],[Infinity,Infinity,-Infinity,-Infinity]),w=pyRound(ext[2]-ext[0]),h=pyRound(ext[3]-ext[1]),hw=pyRound(w/2),hh2=
    pyRound(h/2);
  // Header fields mirror pinned pystitch/pyembroidery JefWriter (the Ink/Stitch reference): hoop code from design size, then centre extents and distances to
  // the 110x110, 50x50, 140x200 and custom (700x1000) hoop edges, or -1 when the design does not fit.
  put32(32,w<500&&h<500?1:w<1260&&h<1100?3:w<1400&&h<2000?2:w<2000&&h<2000?4:0);[hw,hh2,hw,hh2].forEach((v,i)=>put32(36+i*4,v));let at=52;
    for(const [ex,ey] of [[550,550],[250,250],[700,1000],[700,1000]]){const dx=ex-hw,dy=ey-hh2,vals=Math.min(dx,dy)>=0?[dx,dy,dx,dy]:[-1,-1,-1,-1];
    for(const v of vals){put32(at,v);at+=4;}}blocks.forEach((b,i)=>{put32(116+i*4,b.palette??nearestJefColor(b.thread));put32(116+threadCount*4+i*4,0x0d);});
    return new Uint8Array([...buf,...raw]);
}
