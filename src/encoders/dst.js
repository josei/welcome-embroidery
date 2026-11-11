// @ts-check
// DST (Tajima): a 512-byte ASCII header, then balanced-ternary 3-byte records.

/** @typedef {import('../encoders.js').Plan} Plan */

import {splitLongStitches, stitchRule} from './shared.js';

// The header's HOOP_FRAME_KEY line says the stream starts at the hoop centre, so the first stitch's position is an absolute position in the
// hoop. Readers that know the key place the design where the stream puts it; other readers ignore the unknown header key.
/** Header line marking a stream whose origin is the hoop centre (the editor's origin). Read back by readers/tajima.js. */
export const HOOP_FRAME_KEY='WE:CENTRE';

// Tajima DST writer, following pyembroidery's DstWriter/encode_record: 512-byte ASCII header, balanced-ternary 3-byte records
// (max 12.1 mm per record), long jumps split, a trim is three small alternating jumps, colour change and stop are 0xC3, end is 0xF3.
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodeDst(plan,name='Welcome'){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  plan={...plan,stitches:splitLongStitches(plan.stitches,stitchRule('dst'))};
  const XBITS={p81:2,n81:3,p27:2,n27:3,p9:2,n9:3,p3:0,n3:1,p1:0,n1:1},YBITS={p81:5,n81:4,p27:5,n27:4,p9:5,n9:4,p3:7,n3:6,p1:7,n1:6};
  /** @type {(v: number, bits: typeof XBITS) => {b0: number, b1: number, b2: number}} */
  const ternary=(v,bits)=>
    {const out={b0:0,b1:0,b2:0};let r=v;
    for(
    const [t,step,reg,pb,
    nb] of /** @type {Array<[number, number, 'b0'|'b1'|'b2', number, number]>} */([[40,81,'b2',bits.p81,bits.n81],[13,27,'b1',bits.p27,bits.n27],[4,9,'b0',
    bits.p9,bits.n9],[1,3,'b1',bits.p3,bits.n3],[0,1,'b0',bits.p1,bits.n1]])){if(r>t){out[reg]|=1<<pb;r-=step;}else if(r<-t){out[reg]|=1<<nb;r+=step;}}if(r!==
    0)throw Error('DST delta exceeds the record range.');return out;};
  /** @type {(dx: number, dy: number, kind: string) => number[]} */
  const record=(dx,dy,kind)=>
    {if(kind==='color')return [0,0,0xC3];if(kind==='end')return [0,0,0xF3];const ex=ternary(dx,XBITS),ey=ternary(-dy,YBITS);
    return [ex.b0|ey.b0,ex.b1|ey.b1,(kind==='jump'?0x80:0)|3|ex.b2|ey.b2];};
  /** @type {number[][]} */ const recs=[];
  let x=0,y=0,colors=0,count=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  /** @type {(nx: number, ny: number, kind: string) => void} */
  const move=(nx,ny,kind)=>
    {let dx=nx-x,dy=ny-y;
    while(dx!==0||dy!==0){const sx=Math.max(-121,Math.min(121,dx)),sy=Math.max(-121,Math.min(121,dy));recs.push(record(sx,sy,kind));dx-=sx;dy-=sy;x+=sx;y+=sy;
    count++;}};
  for(const p of plan.stitches){const nx=Math.round(p.x*10),ny=Math.round(p.y*10);
    if(p.cmd==='end')continue;
    if(p.cmd==='color'||p.cmd==='stop'){recs.push(record(0,0,'color'));colors++;count++;move(nx,ny,'jump');}
    else if(p.cmd==='jump'){move(nx,ny,'jump');}
    else if(p.cmd==='trim'){for(const [dx,dy] of [[2,2],[-4,-4],[2,2]]){recs.push(record(dx,dy,'jump'));count++;}}
    else if(p.cmd==='stitch'){if(Math.abs(nx-x)>121||Math.abs(ny-y)>121)move(nx,ny,'stitch');else{recs.push(record(nx-x,ny-y,'stitch'));x=nx;y=ny;count++;}}
    else throw Error(`Unsupported stitch command for DST: ${p.cmd}`);
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  recs.push(record(0,0,'end'));
  const label=String(name).replace(/[^\x20-\x7e]/g,'?').slice(0,16).padEnd(16);
  /** @type {(v: unknown, n: number) => string} */
  const pad=(v,n)=>String(v).padStart(n);
  /** @type {(v: number, n: number) => string} */
  const signed=(v,n)=>(v>=0?'+':'-')+String(Math.abs(v)).padStart(n);
  const header=`LA:${label}\rST:${pad(count,7)}\rCO:${pad(colors,3)}\r+X:${pad(Math.abs(maxX),5)}\r-X:${pad(Math.abs(minX),5)}\r+Y:` +
  `${pad(Math.abs(-minY),5)}\r-Y:${pad(Math.abs(-maxY),5)}\rAX:${signed(x,5)}\rAY:${signed(-y,5)}\rMX:+${pad(0,5)}\rMY:+${pad(0,5)}\r${HOOP_FRAME_KEY}\rPD:******\r\x1a`;
  const out=new Uint8Array(512+recs.length*3).fill(0x20);for(let i=0;i<header.length;i++)out[i]=header.charCodeAt(i);recs.forEach((r,i)=>out.set(r,512+i*3));
    return out;
}
