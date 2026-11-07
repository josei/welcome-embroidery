// @ts-check
// U01 (Barudan): a 256-byte header, then 3-byte control/dy/dx records.

/** @typedef {import('../encoders.js').Plan} Plan */

// Barudan U01, written as pyembroidery 1.5.1 writes it. A 256-byte header: 0x80 ASCII '0's, then int16 bounds (min x, -max y, max x, -min y), a zero int32, the
// record count + 1 as int32, and the last stitch as int16 (x, -y), padded to 0x100. Then 3-byte records: a control byte, dy, dx in 0.1 mm, with dy positive
// when 0x40 is set and dx negative when 0x20 is set. Commands in the low five bits: 0x00 stitch, 0x01 jump, 0x07 trim, 0x08 stop, 0x09-0x17 needle change to
// needle 1-15. The file ends F8 00 00. A move longer than 12.7 mm is split into records of at most 12.7 mm per axis.
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeU01(plan){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  /** @type {number[][]} */ const recs=[];
  let x=0,y=0,minX=0,minY=0,maxX=0,maxY=0,changes=0,lastX=0,lastY=0;
  /** @type {(cmd: number, dx: number, dy: number) => void} */
  const step=(cmd,dx,dy)=>
    {recs.push([cmd|(dy>=0?0x40:0)|(dx<=0?0x20:0),Math.abs(dy),Math.abs(dx)]);x+=dx;y+=dy;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);
    maxY=Math.max(maxY,y);};
  // The moves before the last record are jumps for a trim, stop or colour change, and carry the command's own cmd for a stitch or jump.
  /** @type {(nx: number, ny: number, cmd: number, final?: number) => void} */
  const move=(nx,ny,cmd,final=cmd)=>
    {let dx=nx-x,dy=ny-y;
    while(Math.abs(dx)>127||Math.abs(dy)>127){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));step(cmd,sx,sy);dx-=sx;dy-=sy;}step(
    final,dx,dy);};
  for(const p of plan.stitches){if(p.cmd==='end')continue;const nx=Math.round(p.x*10),ny=Math.round(p.y*10);
    if(p.cmd==='stitch'||p.cmd==='jump'){if(nx!==x||ny!==y)move(nx,ny,p.cmd==='stitch'?0x00:0x01);}
    else if(p.cmd==='trim')move(nx,ny,0x01,0x07);
    else if(p.cmd==='stop')move(nx,ny,0x01,0x08);
    else if(p.cmd==='color'){const needle=changes%15+1;changes++;move(nx,ny,0x01,0x08+needle);}
    else throw Error(`Unsupported stitch command for U01: ${p.cmd}`);
    lastX=x;lastY=y;}
  /** @type {number[]} */ const out=new Array(0x80).fill(0x30);
  /** @type {(v: number) => void} */
  const put16=v=>{const u=Math.trunc(v)&0xFFFF;out.push(u&0xFF,u>>8);};
  /** @type {(v: number) => void} */
  const put32=v=>{out.push(v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>>24)&0xFF);};
  put16(minX);put16(-maxY);put16(maxX);put16(-minY);put32(0);put32(recs.length+1);put16(lastX);put16(-lastY);
  while(out.length<0x100)out.push(0);
  for(const [c,dy,dx] of recs)out.push(c,dy,dx);
  out.push(0xF8,0x00,0x00);return Uint8Array.from(out);
}
