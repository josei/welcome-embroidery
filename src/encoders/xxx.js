// @ts-check
// XXX (Singer): a 252-byte header, the stitch records, the end record and the thread table.

/** @typedef {import('../encoders.js').Plan} Plan */

import {last} from './shared.js';

// Singer XXX, written as pyembroidery 1.5.1 writes it: a 252-byte header (23 zero bytes, the record count, 12 zeros, the thread count, the bounds in 0.1 mm,
// the last stitch), an int32 offset of the end of the stitches at 0xFC, the stitches from 0x100, then the end record 7F 7F 02 14 and the thread table. Records:
// a stitch is two signed bytes (dx, -dy); 7F 01 dx -dy is a jump, 7F 03 dx -dy a trim, and 7F 08 00 00 a colour change, followed by a jump to the needle
// position. Every delta is kept within ±123, so no stitch byte can read as the 7D/7E/7F markers. The table holds up to 21 thread blocks.
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeXxx(plan){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  /** @type {string[]} */ const blocks=[plan.stitches.find(p=>p.cmd!=='end'&&p.thread)?.thread||'#527461'];
  for(const p of plan.stitches)if(p.cmd==='color'||p.cmd==='stop')blocks.push(p.thread||last(blocks));
  if(blocks.length>21)throw Error('XXX holds up to 21 thread blocks.');
  /** @type {number[]} */ const body=[];
  /** @type {(v: number) => number[]} */
  const le16=(v)=>{const u=Math.trunc(v)&0xFFFF;return [u&0xFF,u>>8];};
  let x=0,y=0,records=0,minX=0,minY=0,maxX=0,maxY=0,lastX=0,lastY=0;
  /** @type {(kind: string, dx: number, dy: number) => void} */
  const piece=(kind,dx,dy)=>
    {if(kind==='stitch')body.push(dx&0xFF,(-dy)&0xFF);else if(kind==='jump')body.push(0x7F,0x01,dx&0xFF,(-dy)&0xFF);
    else body.push(0x7F,0x03,dx&0xFF,(-dy)&0xFF);records++;x+=dx;y+=dy;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    };
  // Moves are cut into pieces of at most 123 units per axis; the last piece carries the command (stitch, jump or trim).
  /** @type {(nx: number, ny: number, kind: string, final?: string) => void} */
  const move=(nx,ny,kind,final=kind)=>
    {let dx=nx-x,dy=ny-y;
    while(Math.abs(dx)>123||Math.abs(dy)>123){const sx=Math.max(-123,Math.min(123,dx)),sy=Math.max(-123,Math.min(123,dy));
    piece(kind==='stitch'?'stitch':'jump',sx,sy);dx-=sx;dy-=sy;}piece(final,dx,dy);};
  for(const p of plan.stitches){if(p.cmd==='end')continue;const nx=Math.round(p.x*10),ny=Math.round(p.y*10);
    // A zero-length stitch is kept as a zero-delta stitch record; a zero-length jump is dropped.
    if(p.cmd==='stitch'||p.cmd==='jump'){if(nx!==x||ny!==y||p.cmd==='stitch')move(nx,ny,p.cmd);}
    else if(p.cmd==='trim')move(nx,ny,'jump','trim');
    else if(p.cmd==='color'||p.cmd==='stop'){body.push(0x7F,0x08,0,0);records++;if(nx!==x||ny!==y)move(nx,ny,'jump');}
    else throw Error(`Unsupported stitch command for XXX: ${p.cmd}`);
    lastX=x;lastY=y;}
  /** @type {number[]} */ const out=new Array(0x17).fill(0);
  /** @type {(v: number) => void} */
  const put32=v=>{out.push(v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>>24)&0xFF);};
  put32(records);out.push(...new Array(0x0C).fill(0));put32(blocks.length);out.push(0,0);
  out.push(...le16(maxX-minX),...le16(maxY-minY),...le16(lastX),...le16(-lastY),...le16(-minX),...le16(maxY));
  out.push(...new Array(0x42).fill(0),0,0,0,0,...new Array(0x73).fill(0),0x20,0);out.push(...new Array(8).fill(0));
  if(out.length!==0xFC)throw Error('XXX header is not 252 bytes');
  put32(0x100+body.length);out.push(...body);
  out.push(0x7F,0x7F,0x02,0x14,0,0);
  for(const hex of blocks)out.push(0,parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16));
  out.push(...new Array((21-blocks.length)*4).fill(0),0x00,0xFF,0xFF,0xFF,0x00,0x01);
  return Uint8Array.from(out);
}
