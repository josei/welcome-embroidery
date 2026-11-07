// @ts-check
// JEF (Janome): a thread table of indices into Janome's colour chart, then a stitch stream of 1-byte pairs and 80-prefixed control records.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
import {MAX_THREADS, Reader, fail, hex, jefColors, push, result} from './shared.js';
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readJef(bytes) {
  const r = new Reader(bytes);
  if (bytes.length < 128) fail('JEF header is truncated');
  const offset=r.u32le(); r.skip(20); const colorCount=r.u32le(); r.skip(88);
  if (colorCount < 1 || colorCount > MAX_THREADS) fail('invalid JEF thread count');
  if (offset < 116 + colorCount*8 || offset >= bytes.length) fail('invalid JEF stitch offset');
  /** @type {Thread[]} */ const threads=[];
  for(let i=0;i<colorCount;i++){
    const ix=Math.abs(r.u32le());
    const color=ix===0?null:jefColors[ix%jefColors.length];
    threads.push({index:i,color:color===null?null:hex(color),brand:'Jef',catalogNumber:ix===0?'000':null,name:ix===0?'Stop':null});
  }
  r.p=offset;
  /** @type {Stitch[]} */ const stitches=[]; let x=0,y=0,thread=0,colorIndex=1,ended=false;
  while(r.p < bytes.length){
    const a=r.u8();
    if(a!==0x80){const b=r.u8(); x+=a>127?a-256:a; y-=(b>127?b-256:b); push(stitches,x,y,'stitch',thread); continue;}
    const ctrl=r.u8();
    if(ctrl===0x10){ended=true; break;}
    if(ctrl!==0x01&&ctrl!==0x02) fail('unknown JEF command');
    const dx=r.s8(),dy=-r.s8(); x+=dx;y+=dy;
    if(ctrl===0x02) push(stitches,x,y,dx===0&&dy===0?'trim':'jump',thread);
    else {
      if(colorIndex>=threads.length) fail('JEF color command exceeds thread table');
      if(threads[colorIndex].color===null){threads.splice(colorIndex,1);push(stitches,x,y,'stop',thread);}
      else {thread=colorIndex++;push(stitches,x,y,'color',thread);}
    }
  }
  if(!ended) fail('JEF end marker is missing');
  threads.forEach((t,i)=>{t.index=i;}); // a STOP slot was spliced out; keep indexes contiguous
  push(stitches,x,y,'end',thread);
  // Match pystitch's default normalize: isolated/long travel after sewing infers trim.
  let trimmed=true, jumpStart=-1, jumpCount=0, jumpDx=0,jumpDy=0;
  for(let i=0;i<stitches.length;i++){
    const s=stitches[i];
    if(s.cmd==='stitch'){trimmed=false;jumpStart=-1;jumpCount=0;}
    else if(s.cmd==='trim'||s.cmd==='color'||s.cmd==='end'){trimmed=true;jumpStart=-1;jumpCount=0;}
    else if(s.cmd==='jump'){
      if(jumpStart<0){jumpStart=i;jumpCount=0;jumpDx=0;jumpDy=0;}
      jumpCount++;
      const prev=i?stitches[i-1]:null;
      jumpDx+=prev?Math.round((s.x-prev.x)*10):Math.round(s.x*10);
      jumpDy+=prev?Math.round((s.y-prev.y)*10):Math.round(s.y*10);
      if(!trimmed && (Math.abs(jumpDx)>30||Math.abs(jumpDy)>30)){
        const before=stitches[jumpStart-1];
        stitches.splice(jumpStart,0,{x:before?.x??0,y:before?.y??0,cmd:'trim',thread:s.thread});
        i++;trimmed=true;jumpStart=-1;jumpCount=0;
      }
    }
  }
  return result(stitches,threads);
}
