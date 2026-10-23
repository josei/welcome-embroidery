// Bounded browser-side JEF, VP3, DST and SEW stitch readers.
// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in
// docs/READER_STATUS.md; this is an independently written JavaScript port.
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_STITCHES = 2_000_000;
const MAX_THREADS = 256;

const fail = message => { throw new Error(`Invalid embroidery file: ${message}`); };
const asBytes = input => {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  fail('expected Uint8Array or ArrayBuffer');
};

class Reader {
  constructor(bytes) { this.b = bytes; this.p = 0; }
  need(n) { if (!Number.isSafeInteger(n) || n < 0 || this.p + n > this.b.length) fail('truncated data'); }
  skip(n) { this.need(n); this.p += n; }
  u8() { this.need(1); return this.b[this.p++]; }
  s8() { const n = this.u8(); return n > 127 ? n - 256 : n; }
  u16be() { return this.u8() * 256 + this.u8(); }
  u32le() { return (this.u8() | this.u8() << 8 | this.u8() << 16 | this.u8() << 24) >>> 0; }
  u32be() { return (this.u8() * 0x1000000 + this.u8() * 0x10000 + this.u8() * 0x100 + this.u8()) >>> 0; }
  s32be() { const n = this.u32be(); return n > 0x7fffffff ? n - 0x100000000 : n; }
  s16be() { const n = this.u16be(); return n > 0x7fff ? n - 0x10000 : n; }
  str8() { const n = this.u16be(); this.need(n); const s = new TextDecoder('utf-8', {fatal:true}).decode(this.b.subarray(this.p, this.p+n)); this.p += n; return s; }
  str16() { const n = this.u16be(); this.need(n); if (n % 2) fail('odd UTF-16 string length'); const s = new TextDecoder('utf-16be', {fatal:true}).decode(this.b.subarray(this.p, this.p+n)); this.p += n; return s; }
}

const jefColors = [null,0x000000,0xffffff,0xffff17,0xff6600,0x2f5933,0x237336,0x65c2c8,0xab5a96,0xf669a0,0xff0000,0xb1704e,0x0b2f84,0xe4c35d,0x481a05,0xac9cc7,0xfcf294,0xf999b7,0xfab381,0xc9a480,0x970533,0xa0b8cc,0x7fc21c,0xe5e5e5,0x889b9b,0x98d6bd,0xb2e1e3,0x368ba0,0x4f83ab,0x386a91,0x071650,0xf999a2,0xf9676b,0xe3311f,0xe2a188,0xb59474,0xe4cf99,0xffcb00,0xe1add4,0xc3007e,0x80004b,0x540571,0xb10525,0xcae0c0,0x899856,0x5c941a,0x003114,0x5dae94,0x4cbf8f,0x007772,0x595b61,0xfffff2,0xb15818,0xcb8a07,0x986c80,0x98692d,0x4d3419,0x4c330b,0x33200a,0x523a97,0x0d217e,0x1e77ac,0xb2dd53,0xf33689,0xde649e,0x984161,0x4c5612,0x4c881f,0xe4de79,0xcb8a1a,0xcba21c,0xff9805,0xfcb257,0xffe505,0xf0331f,0x1a842d,0x386cae,0xe3c4b4,0xe3ac81];
const hex = n => `#${(n >>> 0).toString(16).padStart(6,'0')}`;
// Janome SEW thread set (pyembroidery's 79-entry EmbThreadSew list, 0-based): the file stores indices into it.
export const SEW_CHART=[[0,0,0],[0,0,0],[255,255,255],[255,255,23],[250,160,96],[92,118,73],[64,192,48],[101,194,200],[172,128,190],[245,188,203],[255,0,0],[192,128,0],[0,0,240],[228,195,93],[165,42,42],[213,176,212],[252,242,148],[240,208,192],[255,192,0],[201,164,128],[155,61,75],[160,184,204],[127,194,28],[185,185,185],[160,160,160],[152,214,189],[184,240,240],[54,139,160],[79,131,171],[56,106,145],[0,32,107],[229,197,202],[249,103,107],[227,49,31],[226,161,136],[181,148,116],[228,207,153],[225,203,0],[225,173,212],[195,0,126],[128,0,75],[160,96,176],[192,64,32],[202,224,192],[137,152,86],[0,170,0],[33,138,33],[93,174,148],[76,191,143],[0,119,114],[112,112,112],[242,255,255],[177,88,24],[203,138,7],[247,146,123],[152,105,45],[162,113,72],[123,85,74],[79,57,70],[82,58,151],[0,0,160],[0,150,222],[178,221,83],[250,143,187],[222,100,158],[181,80,102],[94,87,71],[76,136,31],[228,220,121],[203,138,26],[198,170,66],[236,176,44],[248,128,64],[255,229,5],[250,122,122],[107,224,0],[56,108,174],[208,186,176],[227,190,129]];
function result(stitches, threads, warnings=[]) {
  if (!stitches.length) fail('no stitch commands');
  const sew = stitches.some(s => s.cmd === 'stitch');
  if (!sew) fail('no sewable stitches');
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const s of stitches){minX=Math.min(minX,s.x);minY=Math.min(minY,s.y);maxX=Math.max(maxX,s.x);maxY=Math.max(maxY,s.y);}
  return {stitches, threads, bounds:[minX,minY,maxX,maxY],warnings};
}
function push(out, x, y, cmd, thread) {
  if (out.length >= MAX_STITCHES) fail('stitch count exceeds limit');
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x)>100000 || Math.abs(y)>100000) fail('coordinate exceeds limit');
  const mm=n=>Object.is(n,-0)?0:n;
  out.push({x:mm(x/10),y:mm(y/10),cmd,thread});
}

function readJef(bytes) {
  const r = new Reader(bytes);
  if (bytes.length < 128) fail('JEF header is truncated');
  const offset=r.u32le(); r.skip(20); const colorCount=r.u32le(); r.skip(88);
  if (colorCount < 1 || colorCount > MAX_THREADS) fail('invalid JEF thread count');
  if (offset < 116 + colorCount*8 || offset >= bytes.length) fail('invalid JEF stitch offset');
  const threads=[];
  for(let i=0;i<colorCount;i++){
    const ix=Math.abs(r.u32le());
    const color=ix===0?null:jefColors[ix%jefColors.length];
    threads.push({index:i,color:color===null?null:hex(color),brand:'Jef',catalogNumber:ix===0?'000':null,name:ix===0?'Stop':null});
  }
  r.p=offset; const stitches=[]; let x=0,y=0,thread=0,colorIndex=1,ended=false;
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
      if(!trimmed && (Math.abs(jumpDx)>30||Math.abs(jumpDy)>30)){ const before=stitches[jumpStart-1];stitches.splice(jumpStart,0,{x:before?.x??0,y:before?.y??0,cmd:'trim',thread:s.thread});i++;trimmed=true;jumpStart=-1;jumpCount=0; }
    }
  }
  return result(stitches,threads);
}

function readVp3(bytes) {
  const r=new Reader(bytes);
  if(bytes.length<100) fail('VP3 header is truncated');
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%vsm%') fail('invalid VP3 signature');
  r.p=6; r.str16(); r.skip(7); r.str16(); r.skip(32);
  const centerX=r.s32be()/100, centerY=-r.s32be()/100;
  r.skip(27); r.str16(); r.skip(24); r.str16();
  const count=r.u16be(); if(count<1||count>MAX_THREADS) fail('invalid VP3 thread count');
  const threads=[], stitches=[]; let x=0,y=0;
  for(let block=0;block<count;block++){
    r.skip(3); const blockLength=r.u32be(),end=r.p+blockLength;
    if(end>bytes.length || end<=r.p) fail('invalid VP3 block length');
    const sx=r.s32be()/100,sy=-r.s32be()/100;
    const ax=sx+centerX,ay=sy+centerY;
    // Every block calls move_abs, including (0,0) and no-op origins. This also
    // corrects upstream's `x != 0 and y != 0` omission on either zero axis.
    x=ax;y=ay;push(stitches,x,y,'jump',block);
    const colors=r.u8(),transition=r.u8(); let color=0;
    for(let k=0;k<colors;k++){color=r.u8()*0x10000+r.u8()*0x100+r.u8();r.u8();r.u16be();}
    const type=r.u8(),weight=r.u8(),catalog=r.str8(),name=r.str8(),brand=r.str8();
    if(r.p+15>end) fail('truncated VP3 block metadata');
    r.skip(15); r.skip(3);
    if(end<r.p) fail('invalid VP3 stitch data length');
    const thread=block;
    threads.push({index:block,color:hex(color),brand,catalogNumber:catalog,name,threadType:type,weight,transition});
    // Match the reference's pair loop: consume pairs while at least two bytes
    // remain; when the block length is odd its final byte is unused.
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

// Tajima DST: a 512 byte text header, then 3 byte records of x/y steps in 0.1 mm (y points up) with jump, colour-change and end flags. DST has no colours, so each
// colour block gets a distinct placeholder thread; a run of three or more small jumps is a trim, which is how DST writes one.
const dstPalette=['#1f2937','#c0392b','#2471a3','#229954','#d4ac0d','#8e44ad','#e67e22','#17a589','#7f8c8d','#a93226','#5d6d7e','#117864'];
function readDst(bytes) {
  if (bytes.length < 515) fail('DST file is too short');
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 512));
  if (!/^LA:/.test(head)) fail('DST header is missing');
  let x=0,y=0,block=0,jumps=[];const stitches=[];
  const flush=()=>{ // jumps recorded so far: the first three small ones are a trim
    let i=0;
    if (jumps.length>=3 && jumps.slice(0,3).every(j=>Math.hypot(j.dx,j.dy)<=6)) { push(stitches,x-jumps.slice(3).reduce((a,j)=>a+j.dx,0),y-jumps.slice(3).reduce((a,j)=>a+j.dy,0),'trim',block); i=3; }
    let cx=x-jumps.slice(i).reduce((a,j)=>a+j.dx,0),cy=y-jumps.slice(i).reduce((a,j)=>a+j.dy,0);
    for (;i<jumps.length;i++){cx+=jumps[i].dx;cy+=jumps[i].dy;push(stitches,cx,cy,'jump',block);}
    jumps=[];
  };
  let ended=false;
  for (let p=512;p+2<bytes.length&&!ended;p+=3){
    const b0=bytes[p],b1=bytes[p+1],b2=bytes[p+2];
    let dx=0,dy=0;
    if(b0&0x01)dx+=1;if(b0&0x02)dx-=1;if(b0&0x04)dx+=9;if(b0&0x08)dx-=9;if(b1&0x01)dx+=3;if(b1&0x02)dx-=3;if(b1&0x04)dx+=27;if(b1&0x08)dx-=27;if(b2&0x04)dx+=81;if(b2&0x08)dx-=81;
    if(b0&0x80)dy+=1;if(b0&0x40)dy-=1;if(b0&0x20)dy+=9;if(b0&0x10)dy-=9;if(b1&0x80)dy+=3;if(b1&0x40)dy-=3;if(b1&0x20)dy+=27;if(b1&0x10)dy-=27;if(b2&0x20)dy+=81;if(b2&0x10)dy-=81;
    dy=-dy;                                   // DST y points up, the editor's y points down
    if((b2&0xF3)===0xF3){flush();ended=true;break;}
    if((b2&0xC3)===0xC3){flush();block++;push(stitches,x,y,'color',block);continue;}
    x+=dx;y+=dy;
    if(b2&0x80){jumps.push({dx,dy});continue;}
    flush();push(stitches,x,y,'stitch',block);
  }
  flush();
  push(stitches,x,y,'end',block);
  const threads=[];for(let i=0;i<=block&&i<MAX_THREADS;i++)threads.push({index:i,color:dstPalette[i%dstPalette.length],brand:'DST',catalogNumber:null,name:`Colour ${i+1}`});
  if(block>=MAX_THREADS)fail('too many colour changes');
  return result(stitches,threads,['DST files carry no thread colours: placeholder colours were assigned.']);
}

// SEW (Janome native), as read by pyembroidery's SewReader: a 2-byte colour count and 2-byte thread-chart indices, then the stitch stream from byte 0x1D78.
// A record is two bytes: a plain pair is a stitch, and 80 xx starts a control record whose own two bytes are its coordinates (or zeros for a colour change).
// 80 01 is a colour change, 80 02 and 80 04 a jump, 80 10 a stitch; any other control ends the stream. Coordinates are relative, in 0.1 mm, with y negated.
function readSew(bytes) {
  if (bytes.length < 0x1D78) fail('SEW header is truncated');
  const colours = bytes[0] | bytes[1] << 8;
  if (colours < 1 || colours > MAX_THREADS) fail('invalid SEW colour count');
  const threads = [];
  for (let i = 0; i < colours; i++) {
    const [r, g, b] = SEW_CHART[(bytes[2 + 2*i] | bytes[3 + 2*i] << 8) % SEW_CHART.length];
    threads.push({index:i, color:hex(r << 16 | g << 8 | b), brand:'SEW', catalogNumber:null, name:null});
  }
  const s8 = n => n > 127 ? n - 256 : n;
  const stitches = [];
  let x = 0, y = 0, block = 0, p = 0x1D78;
  while (p + 2 <= bytes.length) {
    const a = bytes[p], b = bytes[p+1];
    p += 2;
    if (a !== 0x80) { x += s8(a); y -= s8(b); push(stitches, x, y, 'stitch', block); continue; }
    if (p + 2 > bytes.length) break;
    const dx = s8(bytes[p]), dy = s8(bytes[p+1]);
    p += 2;
    if (b & 1) { block++; if (block >= colours) fail('more colour changes than colours'); push(stitches, x, y, 'color', block); continue; }
    if (b === 0x02 || b === 0x04) { x += dx; y -= dy; push(stitches, x, y, 'jump', block); continue; }
    if (b === 0x10) { x += dx; y -= dy; push(stitches, x, y, 'stitch', block); continue; }
    break;
  }
  push(stitches, x, y, 'end', block);
  return result(stitches, threads);
}

export function decodeEmbroidery(input, format) {
  const bytes=asBytes(input);
  if(bytes.byteLength>MAX_FILE_BYTES) fail('file exceeds 64 MiB limit');
  if(format==='jef') return readJef(bytes);
  if(format==='vp3') return readVp3(bytes);
  if(format==='dst') return readDst(bytes);
  if(format==='sew') return readSew(bytes);
  fail('format must be jef, vp3, dst or sew');
}
