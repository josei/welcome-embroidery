// @ts-check
// PEC (Brother): a 512-byte header with palette indices, the stitch block in 0.1 mm, then blank icons.

/** @typedef {import('../encoders.js').Plan} Plan */

import {PEC_CHART} from '../readers.js';
import {splitLongStitches} from './shared.js';

/** @param {string|null|undefined} hex @returns {number} */
export const pecChartIndex=hex=>
  {const m=/^#?([0-9a-f]{6})$/i.exec(hex||"")||[0,"527461"];const n=parseInt(m[1],16),c=[n>>16&255,n>>8&255,n&255];let best=0,bd=Infinity;
  PEC_CHART.forEach((r,i)=>{const d=(r[0]-c[0])**2+(r[1]-c[1])**2+(r[2]-c[2])**2;if(d<bd){bd=d;best=i;}});return best+1;};
// PEC (Brother): 512-byte header with palette indices, a stitch block in 0.1 mm, then blank 48 x 38 icons (one overview, one per colour).
/** @param {Plan} plan @returns {string[]} */
export function pecColourSeq(plan){
/** @type {string[]} */ const seq=[];
  for(const p of plan.stitches){if(p.cmd==="end")continue;if(p.thread&&seq.at(-1)!==p.thread)seq.push(p.thread);}if(!seq.length)seq.push("#527461");return seq;}
/** @param {Plan} plan @param {string} name @returns {number[]} */
export function pecBody(plan,name){
 if(plan.errors.length)throw Error(plan.errors.join(" "));
 plan={...plan,stitches:splitLongStitches(plan.stitches)};
 const seq=pecColourSeq(plan);
 const indices=seq.slice(0,255).map(pecChartIndex);
 /** @type {number[]} */ const body=[];
 /** @type {(v: number, long: boolean, flag: number) => void} */
 const value=(v,long,flag)=>{if(!long&&v>-64&&v<63){body.push(v&0x7F);return;}let x=v&0x0FFF;x|=0x8000;x|=flag<<8;body.push((x>>8)&0xFF,x&0xFF);};
 let xx=0,yy=0,jumping=true,init=true,colourTwo=true;
 /** @type {(dx: number, dy: number, f: (sx: number, sy: number) => void) => void} */
 const chunks=(dx,dy,f)=>
   {let rx=dx,ry=dy;do{const sx=Math.max(-2047,Math.min(2047,rx)),sy=Math.max(-2047,Math.min(2047,ry));f(sx,sy);rx-=sx;ry-=sy;}while(rx!==0||ry!==0);};
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of plan.stitches){
  if(p.cmd==="end"){body.push(0xFF);break;}
  const nx=Math.round(p.x*10),ny=Math.round(p.y*10);
  minX=Math.min(minX,nx);maxX=Math.max(maxX,nx);minY=Math.min(minY,ny);maxY=Math.max(maxY,ny);
  if(p.cmd==="stitch"){
    jumping=false;chunks(nx-xx,ny-yy,(sx,sy)=>{value(sx,false,0);value(sy,false,0);});
    xx=nx;yy=ny;}
  else if(p.cmd==="jump"){jumping=true;const flag=init?0x10:0x20;chunks(nx-xx,ny-yy,(sx,sy)=>{value(sx,true,flag);value(sy,true,flag);});xx=nx;yy=ny;}
  else if(p.cmd==="color"||p.cmd==="stop"){jumping=false;body.push(0xFE,0xB0,colourTwo?2:1);colourTwo=
    !colourTwo;}
  else if(p.cmd==="trim"){}
  else throw Error(`Unsupported stitch command for PEC: ${p.cmd}`);
  init=false;
 }
 if(body.at(-1)!==0xFF)body.push(0xFF);
 const width=Math.max(0,Math.round(maxX-minX)),height=Math.max(0,Math.round(maxY-minY));
 /** @type {number[]} */ const out=[];
 /** @type {(...bs: number[]) => number} */
 const put=(...bs)=>out.push(...bs);
 /** @type {(s: unknown, n: number) => number[]} */
 const str=(s,n)=>[...String(s).replace(/[^\x20-\x7e]/g,"?").padEnd(n," ").slice(0,n)].map(c=>c.charCodeAt(0));
 put(...str("LA:"+String(name).replace(/[^\x20-\x7e]/g,"?").slice(0,16).padEnd(16," "),19),13);
 put(...new Array(12).fill(0x20),0xFF,0x00,0x06,0x26,...new Array(12).fill(0x20));
 put(indices.length-1,...indices);
 while(out.length<512)out.push(0x20);
 const blockLen=16+body.length;
 put(0x00,0x00,blockLen&0xFF,(blockLen>>8)&0xFF,(blockLen>>16)&0xFF,0x31,0xFF,0xF0,width&0xFF,(width>>8)&0xFF,height&0xFF,(height>>8)&0xFF,0xE0,0x01,0xB0,0x01);
 for(const b of body)out.push(b);
 for(let i=0;i<=indices.length;i++)for(let k=0;k<6*38;k++)out.push(0);
 return out;
}
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodePec(plan,name="Welcome"){return Uint8Array.from([...Array.from("#PEC0001",c=>c.charCodeAt(0)),...pecBody(plan,name)]);}
