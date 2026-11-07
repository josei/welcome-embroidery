// @ts-check
// VP3 (Pfaff): a '%vsm%' signature and a header, then one block per colour with absolute start points and signed 1-byte stitch pairs (80-prefixed
// escapes for trim and long steps).

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, Reader, fail, hex, push, result} from './shared.js';
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readVp3(bytes) {
  const r=new Reader(bytes);
  if(bytes.length<100) fail('VP3 header is truncated');
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%vsm%') fail('invalid VP3 signature');
  r.p=6; r.str16(); r.skip(7); r.str16(); r.skip(32);
  const centerX=r.s32be()/100, centerY=-r.s32be()/100;
  r.skip(27); r.str16(); r.skip(24); r.str16();
  const count=r.u16be(); if(count<1||count>MAX_THREADS) fail('invalid VP3 thread count');
  /** @type {Thread[]} */ const threads=[];
  /** @type {Stitch[]} */ const stitches=[]; let x=0,y=0;
  for(let block=0;block<count;block++){
    r.skip(3); const blockLength=r.u32be(),end=r.p+blockLength;
    if(end>bytes.length || end<=r.p) fail('invalid VP3 block length');
    const sx=r.s32be()/100,sy=-r.s32be()/100;
    const ax=sx+centerX,ay=sy+centerY;
    // Every block calls move_abs, including (0,0) and no-op origins. This also corrects upstream's `x != 0 and y != 0` omission on either zero
    // axis.
    x=ax;y=ay;push(stitches,x,y,'jump',block);
    const colors=r.u8(),transition=r.u8(); let color=0;
    for(let k=0;k<colors;k++){color=r.u8()*0x10000+r.u8()*0x100+r.u8();r.u8();r.u16be();}
    const type=r.u8(),weight=r.u8(),catalog=r.str8(),name=r.str8(),brand=r.str8();
    if(r.p+15>end) fail('truncated VP3 block metadata');
    r.skip(15); r.skip(3);
    if(end<r.p) fail('invalid VP3 stitch data length');
    const thread=block;
    threads.push({index:block,color:hex(color),brand,catalogNumber:catalog,name,threadType:type,weight,transition});
    // Match the reference's pair loop: consume pairs while at least two bytes remain; when the block length is odd its final byte is unused.
    while(r.p+1<end){
      const a=r.s8(),b=r.s8();
      if((a&255)!==0x80){x+=a;y+=b;push(stitches,x,y,'stitch',thread);continue;}
      if((b&255)===0x03){push(stitches,x,y,'trim',thread);continue;}
      if((b&255)===0x01){
        const dx=r.s16be(),dy=r.s16be(); x+=dx;y+=dy;push(stitches,x,y,'stitch',thread);
        if(r.p+2>end)fail('truncated VP3 long-stitch escape');r.skip(2);
      } else if((b&255)!==0x02) fail('unknown VP3 stitch escape');
    }
    if(r.p<end-1||r.p>end)fail('misaligned VP3 stitch data');
    r.p=end; // Reference consumes the whole block payload, including an odd trailing byte.
    if(block+1<count)push(stitches,x,y,'color',block+1);
  }
  push(stitches,x,y,'end',Math.max(0,count-1));
  return result(stitches,threads);
}
