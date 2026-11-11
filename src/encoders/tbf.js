// @ts-check
// TBF (Tajima): an ASCII header with the counts, bounds and thread table, then 3-byte records.

/** @typedef {import('../encoders.js').Plan} Plan */

import {last, splitLongStitches, stitchRule} from './shared.js';

// Tajima TBF, written as pyembroidery 1.5.1 writes it. A 0x600-byte ASCII header: '3.00', the name at 0x80 (LA), the stitch and colour-change counts (ST, CO),
// the bounds (+X, -X, +Y, -Y), the last stitch (AX, AY), TP and JC, the needle order (256 bytes at 0x10A, one entry per colour change), and the thread table
// (DA: 0x45, RR, GG, BB, 0x20 per block from 0x20E), padded with spaces. Then 3-byte records: dx, -dy, command. Commands: 0x80 stitch, 0x90 jump (a zero jump
// reads as a trim), 0x81 needle change, 0x40 stop, 0x86 trim, 0x8F end. The reader ignores the move on 0x81, 0x40 and 0x86, so each of those is written with a
// zero move and followed by a jump to the position. Up to 72 thread blocks fit the table.
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodeTbf(plan,name='Welcome'){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  plan={...plan,stitches:splitLongStitches(plan.stitches,stitchRule('tbf'))};
  /** @type {string[]} */ const blocks=[plan.stitches.find(p=>p.cmd!=='end'&&p.thread)?.thread||'#527461'];
  for(const p of plan.stitches)if(p.cmd==='color')blocks.push(p.thread||last(blocks));
  if(blocks.length>72)throw Error('TBF holds up to 72 thread blocks.');
  /** @type {number[]} */ const body=[];
  /** @type {number[]} */ const order=new Array(256).fill(0);
  let x=0,y=0,minX=0,minY=0,maxX=0,maxY=0,stitches=0,changes=0;
  /** @type {(dx: number, dy: number, cmd: number) => void} */
  const rec=(dx,dy,cmd)=>
    {body.push(dx&0xFF,(-dy)&0xFF,cmd);if(cmd===0x80)stitches++;x+=dx;y+=dy;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=
    Math.max(maxY,y);};
  // A move longer than 12.7 mm per axis is cut into records of that size, all carrying the same command (stitch 0x80 or jump 0x90).
  /** @type {(nx: number, ny: number, cmd: number) => void} */
  const move=(nx,ny,cmd)=>
    {let dx=nx-x,dy=ny-y;
    while(Math.abs(dx)>127||Math.abs(dy)>127){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));rec(sx,sy,cmd);dx-=sx;dy-=sy;}if(dx||
    dy||cmd===0x80)rec(dx,dy,cmd);};
  for(const p of plan.stitches){if(p.cmd==='end')continue;const nx=Math.round(p.x*10),ny=Math.round(p.y*10);
    if(p.cmd==='stitch')move(nx,ny,0x80);
    else if(p.cmd==='jump')move(nx,ny,0x90);
    else if(p.cmd==='trim'){body.push(0,0,0x86);move(nx,ny,0x90);}
    else if(p.cmd==='color'){order[changes]=changes+1;changes++;body.push(0,0,0x81);move(nx,ny,0x90);}
    else if(p.cmd==='stop'){body.push(0,0,0x40);move(nx,ny,0x90);}
    else throw Error(`Unsupported stitch command for TBF: ${p.cmd}`);}
  body.push(0,0,0x8F);
  /** @type {(s: unknown) => number[]} */
  const ascii=s=>[...String(s)].map(c=>c.charCodeAt(0)>127?0x3F:c.charCodeAt(0));
  /** @type {(s: unknown, n: number, ch?: string) => string} */
  const pad=(s,n,ch=' ')=>String(s).padEnd(n,ch).slice(0,n);
  const hdr=[...ascii('3.00')];
  /** @type {(s: string) => void} */
  const line=s=>{hdr.push(...ascii(s));};
  /** @type {(n: number) => void} */
  const fill=n=>{while(hdr.length<n)hdr.push(0x20);};
  fill(0x80);line(`LA:${pad(name,16)}\r`);line(`ST:${String(stitches).padStart(7)}\r`);line(`CO:${String(changes).padStart(3)}\r`);
  line(`+X:${String(Math.abs(maxX)).padStart(5)}\r`);line(`-X:${String(Math.abs(minX)).padStart(5)}\r`);line(`+Y:${String(Math.abs(maxY)).padStart(5)}\r`);
    line(`-Y:${String(Math.abs(minY)).padStart(5)}\r`);
  line(`AX:${x>=0?'+':'-'}${String(Math.abs(x)).padStart(5)}\r`);line(`AY:${-y>=0?'+':'-'}${String(Math.abs(y)).padStart(5)}\r`);
  line(`TP:${pad('EG/',32)}\r`);line('JC:3\r');line('DO:');hdr.push(...order);line('\r');
  line('DA:');for(const hex of blocks)hdr.push(0x45,parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),0x20);
  if(hdr.length>0x376)throw Error('TBF thread table is too long.');
  fill(0x376);hdr.push(0x0D,0x1A);fill(0x600);
  return Uint8Array.from([...hdr,...body,0x1A]);
}
