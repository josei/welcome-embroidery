// Bounded browser-side JEF, VP3, DST, SEW, PEC and EXP stitch readers.
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

// Brother PEC thread chart, 1-based: the machine stores these indices for each colour block (index 0 is no thread). Also used by the PEC and PES writers.
export const PEC_CHART=[[14,31,124],[10,85,163],[0,135,119],[75,107,175],[237,23,31],[209,92,0],[145,54,151],[228,154,203],[145,95,172],[158,214,125],[232,169,0],[254,186,53],[255,255,0],[112,188,31],[186,152,0],[168,168,168],[125,111,0],[255,255,179],[79,85,86],[0,0,0],[11,61,145],[119,1,118],[41,49,51],[42,19,1],[246,74,138],[178,118,36],[252,187,197],[254,55,15],[240,240,240],[106,28,138],[168,221,196],[37,132,187],[254,179,67],[255,243,107],[208,166,96],[209,84,0],[102,186,73],[19,74,70],[135,135,135],[216,204,198],[67,86,7],[253,217,222],[249,147,188],[0,56,34],[178,175,212],[104,106,176],[239,227,185],[247,56,102],[181,75,100],[19,43,26],[199,1,86],[254,158,50],[168,222,235],[0,103,62],[78,41,144],[47,126,32],[255,204,204],[255,217,17],[9,91,166],[240,249,112],[227,243,91],[255,153,0],[255,240,141],[255,200,200]];
// PEC (Brother), as read by pyembroidery's PecReader: '#PEC0001', 'LA:' and a 16-byte label, the colour count minus one at 0x38 and one palette byte per colour,
// then the stitch stream at 0x218. Values are 0.1 mm relative moves: a byte below 0x80 is a 7-bit step, 0x80 starts a 12-bit step whose flags are 0x20 trim and 0x10 jump.
// FE B0 xx is a colour change; FF 00 ends the stream. Palette bytes index the chart modulo 65, where 0 is no thread (pyembroidery's reader behaves the same way).
// PES (Brother): every version starts '#PES' + a four-digit version, and bytes 8-11 hold the offset of its PEC block, which is read as a PEC file.
function readPes(bytes) {
  if (bytes.length < 12) fail('PES header is truncated');
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== '#PES') fail('invalid PES signature');
  const offset = (bytes[8] | bytes[9] << 8 | bytes[10] << 16 | bytes[11] << 24) >>> 0;
  if (offset >= bytes.length) fail('PES PEC block offset is outside the file');
  // The offset points at the PEC label 'LA:', which is byte 8 of a PEC block; a PES file has no '#PEC0001' header of its own, so one is put in front.
  const block = new Uint8Array(8 + bytes.length - offset);
  block.set(new TextEncoder().encode('#PEC0001'), 0);
  block.set(bytes.subarray(offset), 8);
  const result = readPec(block);
  const metadata = pesMetadata(bytes, offset);
  if (metadata) result.metadata = metadata;
  return result;
}
// PES headers from version 4 on (pyembroidery's PesReader) hold five length-prefixed strings after the 16-byte prefix: name, category, author, keywords and comments. Each is one length byte then the text; an empty field is a zero length. Versions 1 to 3 have none. Anything malformed or cut short by the PEC block is ignored, so the stitches still import.
const PES_METADATA_KEYS = ['name', 'category', 'author', 'keywords', 'comments'];
function pesMetadata(bytes, pecOffset) {
  if (!(Number(new TextDecoder().decode(bytes.subarray(4, 8))) >= 40)) return null;
  const out = {};
  let p = 16;
  for (const key of PES_METADATA_KEYS) {
    if (p >= pecOffset) break;
    const n = bytes[p++];
    if (p + n > pecOffset) break;
    const text = new TextDecoder().decode(bytes.subarray(p, p + n)).trim();
    p += n;
    if (text) out[key] = text.slice(0, 240);
  }
  return Object.keys(out).length ? out : null;
}
function readPec(bytes) {
  if (bytes.length < 0x218) fail('PEC header is truncated');
  if (new TextDecoder().decode(bytes.subarray(0, 3)) !== '#PE' || new TextDecoder().decode(bytes.subarray(8, 11)) !== 'LA:') fail('invalid PEC signature');
  const count = bytes[0x38] + 1;
  const threads = [];
  for (let i = 0; i < count; i++) {
    const index = bytes[0x39 + i] % (PEC_CHART.length + 1);
    const rgb = index ? PEC_CHART[index - 1] : null;
    threads.push({index: i, color: rgb ? hex(rgb[0] << 16 | rgb[1] << 8 | rgb[2]) : null, brand: 'PEC', catalogNumber: index ? String(index) : null, name: null});
  }
  const s7 = b => b > 63 ? b - 128 : b;
  const s12 = c => { c &= 0xFFF; return c > 0x7FF ? c - 0x1000 : c; };
  const stitches = [];
  let x = 0, y = 0, p = 0x218;
  while (p + 1 < bytes.length) {
    let a = bytes[p], b = bytes[p + 1];
    p += 2;
    if (a === 0xFF && b === 0x00) break;
    if (a === 0xFE && b === 0xB0) { p += 1; push(stitches, x, y, 'color', 0); continue; }
    let jump = false, trim = false, dx, dy;
    if (a & 0x80) {
      trim = Boolean(a & 0x20); jump = Boolean(a & 0x10);
      if (p >= bytes.length) break;
      dx = s12(a << 8 | b); b = bytes[p++];
    } else dx = s7(a);
    if (b & 0x80) {
      trim = trim || Boolean(b & 0x20); jump = jump || Boolean(b & 0x10);
      if (p >= bytes.length) break;
      dy = s12(b << 8 | bytes[p++]);
    } else dy = s7(b);
    if (jump) { x += dx; y += dy; push(stitches, x, y, 'jump', 0); }
    else if (trim) { push(stitches, x, y, 'trim', 0); x += dx; y += dy; push(stitches, x, y, 'jump', 0); }
    else { x += dx; y += dy; push(stitches, x, y, 'stitch', 0); }
  }
  push(stitches, x, y, 'end', 0);
  // pyembroidery's interpolate_duplicate_color_as_stop: a colour change back to the thread already sewing becomes a STOP and its thread entry is dropped.
  let threadIndex = 0, initColour = true, lastChange = -1;
  for (let i = 0; i < stitches.length; i++) {
    const cmd = stitches[i].cmd;
    if (cmd === 'color') { initColour = true; lastChange = i; continue; }
    if (cmd !== 'stitch' || !initColour) continue;
    if (lastChange >= 0 && threadIndex !== 0) {
      if (threadIndex >= threads.length) break;
      if (threads[threadIndex - 1].color === threads[threadIndex].color) { threads.splice(threadIndex, 1); stitches[lastChange].cmd = 'stop'; }
      else threadIndex++;
    } else threadIndex++;
    initColour = false;
  }
  threads.forEach((t, i) => { t.index = i; });
  let block = 0;
  for (const s of stitches) { if (s.cmd === 'color') s.thread = ++block; else s.thread = block; }
  if (block >= threads.length) fail('more colour changes than colours');
  return result(stitches, threads);
}

// EXP (Melco), as read by pyembroidery's ExpReader: no header, a stream of byte pairs of 0.1 mm steps (y is negated, as in SEW). 80 xx starts a control record
// whose own pair holds the step: 80 80 is a trim (its step is ignored), 80 04 a jump, 80 02 a stitch, 80 01 a colour change followed by a jump when the step is not zero.
// Any other control ends the stream, and so does EOF. EXP has no palette, so each colour block gets a placeholder colour as DST does.
function readExp(bytes) {
  const s8 = n => n > 127 ? n - 256 : n;
  const stitches = [];
  let x = 0, y = 0, block = 0, p = 0;
  while (p + 1 < bytes.length) {
    const a = bytes[p], b = bytes[p + 1];
    p += 2;
    if (a !== 0x80) { x += s8(a); y -= s8(b); push(stitches, x, y, 'stitch', block); continue; }
    if (p + 1 >= bytes.length) break;
    const dx = s8(bytes[p]), dy = -s8(bytes[p + 1]);
    p += 2;
    if (b === 0x80) { push(stitches, x, y, 'trim', block); continue; }
    if (b === 0x02) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); continue; }
    if (b === 0x04) { x += dx; y += dy; push(stitches, x, y, 'jump', block); continue; }
    if (b === 0x01) {
      push(stitches, x, y, 'color', ++block);
      if (block >= MAX_THREADS) fail('too many colour changes');
      if (dx !== 0 || dy !== 0) { x += dx; y += dy; push(stitches, x, y, 'jump', block); }
      continue;
    }
    break;
  }
  push(stitches, x, y, 'end', block);
  const threads = [];
  for (let i = 0; i <= block; i++) threads.push({index: i, color: dstPalette[i % dstPalette.length], brand: 'EXP', catalogNumber: null, name: `Colour ${i + 1}`});
  return result(stitches, threads, ['EXP files carry no thread colours: placeholder colours were assigned.']);
}

// Husqvarna HUS, read as pyembroidery 1.5.1 does (HusReader and EmbCompress): a header, a chart of 29 thread colours, then the command, x and y streams, each compressed with a Huffman and back-reference scheme. Coordinates are 0.1 mm and y is stored negated.
const HUS_THREADS=[["#000000","Black","026"],["#0000e7","Blue","005"],["#00c600","Green","002"],["#ff0000","Red","014"],["#840084","Purple","008"],["#ffff00","Yellow","020"],["#848484","Grey","024"],["#8484e7","Light Blue","006"],["#00ff84","Light Green","003"],["#ff7b31","Orange","017"],["#ff8ca5","Pink","011"],["#845200","Brown","028"],["#ffffff","White","022"],["#000084","Dark Blue","004"],["#008400","Dark Green","001"],["#7b0000","Dark Red","013"],["#ff6384","Light Red","015"],["#522952","Dark Purple","007"],["#ff00ff","Light Purple","009"],["#ffde00","Dark Yellow","019"],["#ffff9c","Light Yellow","021"],["#525252","Dark Grey","025"],["#d6d6d6","Light Grey","023"],["#ff5208","Dark Orange","016"],["#ff9c5a","Light Orange","018"],["#ff52b5","Dark Pink","010"],["#ffc6de","Light Pink","012"],["#523100","Dark Brown","027"],["#b5a584","Light Brown","029"]];
const husFail = message => fail(`HUS ${message}`);
function husExpand(data, size) {
  let bitPos = 0, blockElements = -1, charHuff = null, distHuff = null;
  const bits = (start, length) => {
    const end = start + length - 1, first = Math.floor(start / 8), last = Math.floor(end / 8);
    let value = 0;
    for (let i = first; i <= last; i++) value = (value << 8) | (i < data.length ? data[i] : 0);
    const unused = (8 - ((end + 1) % 8)) % 8;
    return (value >>> unused) & ((1 << length) - 1);
  };
  const peek = n => bits(bitPos, n);
  const pop = n => { const v = peek(n); bitPos += n; return v; };
  // A Huffman code is either a single default value (table null) or a lookup table built from code lengths.
  const huffman = (lengths, dflt) => {
    if (!lengths) return {dflt, table: null, width: 0, lengths: null};
    const width = Math.max(...lengths);
    if (!Number.isFinite(width) || width < 1 || width > 16) husFail('has an invalid Huffman code');
    const table = [];
    let size = 1 << width;
    for (let len = 1; len <= width; len++) {
      size /= 2;
      lengths.forEach((l, index) => { if (l === len) for (let k = 0; k < size; k++) table.push(index); });
    }
    return {dflt, table, width, lengths};
  };
  const lookup = (h, bits16) => {
    if (!h.table) return [h.dflt, 0];
    const v = h.table[bits16 >> (16 - h.width)];
    if (v === undefined) husFail('has an incomplete Huffman code');
    return [v, h.lengths[v]];
  };
  const variableLength = () => {
    let m = pop(3);
    if (m !== 7) return m;
    for (let q = 0; q < 13; q++) { if (pop(1) === 1) m++; else break; }
    return m;
  };
  const characterLengthHuffman = () => {
    const count = pop(5);
    if (count === 0) return huffman(null, pop(5));
    const lengths = new Array(count).fill(0);
    let index = 0;
    while (index < count) {
      if (index === 3) index += pop(2);
      if (index >= count) husFail('has a code length out of range');
      lengths[index++] = variableLength();
    }
    return huffman(lengths, 8);
  };
  const characterHuffman = lengthHuff => {
    const count = pop(9);
    if (count === 0) return huffman(null, pop(9));
    const lengths = new Array(count).fill(0);
    let index = 0;
    while (index < count) {
      const [c, used] = lookup(lengthHuff, peek(16));
      bitPos += used;
      if (c === 0) index += 1;
      else if (c === 1) index += 3 + pop(4);
      else if (c === 2) index += 20 + pop(9);
      else {
        if (index >= count) husFail('has a code length out of range');
        lengths[index++] = c - 2;
      }
    }
    return huffman(lengths, 0);
  };
  const distanceHuffman = () => {
    const count = pop(5);
    if (count === 0) return huffman(null, pop(5));
    const lengths = [];
    for (let i = 0; i < count; i++) lengths.push(variableLength());
    return huffman(lengths, 0);
  };
  const loadBlock = () => {
    blockElements = pop(16);
    charHuff = characterHuffman(characterLengthHuffman());
    distHuff = distanceHuffman();
  };
  const token = () => {
    if (blockElements <= 0) loadBlock();
    blockElements--;
    const [v, used] = lookup(charHuff, peek(16));
    bitPos += used;
    return v;
  };
  const position = () => {
    const [v, used] = lookup(distHuff, peek(16));
    bitPos += used;
    if (v === 0) return 0;
    return (1 << (v - 1)) + pop(v - 1);
  };
  const out = [];
  const bitsTotal = data.length * 8;
  while (bitsTotal > bitPos && (size === null || out.length <= size)) {
    const c = token();
    if (c <= 255) out.push(c);
    else if (c === 510) break;
    else {
      const length = c - 253, back = position() + 1, start = out.length - back;
      if (start < 0) husFail('has a back-reference before its start');
      if (back > length) out.push(...out.slice(start, start + length));
      else for (let i = start; i < start + length; i++) out.push(out[i]);
    }
  }
  return out;
}
function readHus(bytes) {
  if (bytes.length < 42) husFail('header is truncated');
  const u32 = o => (bytes[o] | bytes[o + 1] << 8 | bytes[o + 2] << 16 | bytes[o + 3] << 24) >>> 0;
  const u16 = o => bytes[o] | bytes[o + 1] << 8;
  const stitchCount = u32(4), colours = u32(8);
  const cmdOffset = u32(20), xOffset = u32(24), yOffset = u32(28);
  if (colours < 1 || colours > MAX_THREADS) husFail('has an invalid colour count');
  if (42 + 2 * colours > bytes.length) husFail('colour chart is truncated');
  if (!(cmdOffset <= xOffset && xOffset <= yOffset && yOffset <= bytes.length)) husFail('stream offsets are out of order');
  const threads = [];
  for (let i = 0; i < colours; i++) {
    const index = u16(42 + 2 * i);
    if (index >= HUS_THREADS.length) husFail('uses an unknown thread');
    const [color, name, code] = HUS_THREADS[index];
    threads.push({index: i, color, brand: 'HUS', catalogNumber: code, name});
  }
  const cmd = husExpand(bytes.subarray(cmdOffset, xOffset), stitchCount);
  const xs = husExpand(bytes.subarray(xOffset, yOffset), stitchCount);
  const ys = husExpand(bytes.subarray(yOffset), stitchCount);
  const s8 = n => n > 127 ? n - 256 : n;
  const stitches = [];
  let x = 0, y = 0, block = 0;
  const count = Math.min(cmd.length, xs.length, ys.length);
  for (let i = 0; i < count; i++) {
    const dx = s8(xs[i]), dy = -s8(ys[i]);
    if (cmd[i] === 0x80) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); }
    else if (cmd[i] === 0x81) { x += dx; y += dy; push(stitches, x, y, 'jump', block); }
    else if (cmd[i] === 0x84) { x += dx; y += dy; block++; if (block >= MAX_THREADS) husFail('too many colour changes'); push(stitches, x, y, 'color', block); }
    else if (cmd[i] === 0x88) { if (dx !== 0 || dy !== 0) { x += dx; y += dy; push(stitches, x, y, 'jump', block); } push(stitches, x, y, 'trim', block); }
    else break;
  }
  push(stitches, x, y, 'end', block);
  return result(stitches, threads);
}

// Singer XXX, read as pyembroidery 1.5.1 does (XxxReader): a 0x100-byte header whose colour count is at 0x27, uncompressed commands from 0x100 (a 7F escape introduces moves, trims and colour changes; 7D and 7E are big jumps), an end code, then the colours as big-endian 32-bit values.
function readXxx(bytes) {
  if (bytes.length < 0x100) fail('XXX header is truncated');
  const colourCount = bytes[0x27] | bytes[0x28] << 8;
  let p = 0x100;
  const next = () => { if (p >= bytes.length) fail('XXX commands end before the end code'); return bytes[p++]; };
  const s8 = n => n > 127 ? n - 256 : n;
  const s16 = () => { const v = next() | next() << 8; return v > 0x7FFF ? v - 0x10000 : v; };
  const stitches = [];
  let x = 0, y = 0, block = 0;
  for (;;) {
    const b1 = next();
    if (b1 === 0x7D || b1 === 0x7E) {
      const dx = s16(), dy = -s16();
      x += dx; y += dy; push(stitches, x, y, 'jump', block);
      continue;
    }
    const b2 = next();
    if (b1 !== 0x7F) { x += s8(b1); y -= s8(b2); push(stitches, x, y, 'stitch', block); continue; }
    const b3 = next(), b4 = next();
    if (b2 === 0x01) { x += s8(b3); y -= s8(b4); push(stitches, x, y, 'jump', block); }
    else if (b2 === 0x03) {
      push(stitches, x, y, 'trim', block);
      const dx = s8(b3), dy = -s8(b4);
      if (dx !== 0 || dy !== 0) { x += dx; y += dy; push(stitches, x, y, 'jump', block); }
    }
    else if (b2 === 0x08 || (b2 >= 0x0A && b2 <= 0x17)) { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, x, y, 'color', block); }
    else if (b2 === 0x7F || b2 === 0x18) break;
  }
  push(stitches, x, y, 'end', block);
  p += 2;
  const threads = [];
  for (let i = 0; i < colourCount && p + 4 <= bytes.length; i++) {
    const v = (bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3]) >>> 0;
    p += 4;
    threads.push({index: i, color: '#' + (v & 0xFFFFFF).toString(16).padStart(6, '0'), brand: 'XXX', catalogNumber: null, name: null});
  }
  // A colour block with no entry in the colour table gets a placeholder colour, and the file is reported as having one.
  const warnings = [];
  if (threads.length < block + 1) warnings.push(threads.length ? 'XXX file has fewer colours than colour changes: placeholder colours were assigned.' : 'XXX file has no colour table: placeholder colours were assigned.');
  for (let i = threads.length; i <= block; i++) threads.push({index: i, color: '#527461', brand: 'XXX', catalogNumber: null, name: `Colour ${i + 1}`});
  return result(stitches, threads, warnings);
}

// Barudan-style DSB, read as pyembroidery 1.5.1 does (DsbReader): a 512-byte DST-style header, then 3-byte records. The control byte gives the command, and its 0x40 and 0x20 bits flip y and x. Coordinates are read as unsigned bytes, as pyembroidery does. There is no colour table: each needle change starts a colour block.
function readDsb(bytes) {
  if (bytes.length < 512) fail('DSB header is truncated');
  const stitches = [];
  let x = 0, y = 0, block = 0;
  let p = 512;
  for (; p + 3 <= bytes.length; p += 3) {
    const ctrl = bytes[p];
    let dy = -bytes[p + 1], dx = bytes[p + 2];
    if (ctrl & 0x40) dy = -dy;
    if (ctrl & 0x20) dx = -dx;
    if ((ctrl & 0x1F) === 0) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); continue; }
    if ((ctrl & 0x1F) === 1) { x += dx; y += dy; push(stitches, x, y, 'jump', block); continue; }
    if (ctrl === 0xF8) break;
    if (ctrl === 0xE7) { push(stitches, x, y, 'trim', block); continue; }
    if (ctrl === 0xE8) { push(stitches, x, y, 'stop', block); continue; }
    if (ctrl >= 0xE9 && ctrl < 0xF8) { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, x, y, 'color', block); continue; }
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'DSB');
}
// Colour blocks in a file with no colour table: one placeholder colour per block, reported as a warning when there is more than one block.
function blockResult(stitches, block, brand) {
  const threads = [];
  for (let i = 0; i <= block; i++) threads.push({index: i, color: '#527461', brand, catalogNumber: null, name: `Colour ${i + 1}`});
  return result(stitches, threads, block ? [`${brand} files carry no thread colours: placeholder colours were assigned.`] : []);
}
// Barudan-style DSZ (pyembroidery's DszReader): the same header and 3-byte records as DSB, with the bytes in another order (y, x, control), other control codes (0x82 stop, 0x9B trim, 0x83 to 0x9A needle change) and no end code: the file simply stops.
function readDsz(bytes) {
  if (bytes.length < 512) fail('DSZ header is truncated');
  const stitches = [];
  let x = 0, y = 0, block = 0;
  for (let p = 512; p + 3 <= bytes.length; p += 3) {
    const ctrl = bytes[p + 2];
    let dy = -bytes[p], dx = bytes[p + 1];
    if (ctrl & 0x40) dx = -dx;
    if (ctrl & 0x20) dy = -dy;
    if ((ctrl & 0x1F) === 0) { x += dx; y += dy; push(stitches, x, y, 'stitch', block); continue; }
    if ((ctrl & 0x1F) === 1) { x += dx; y += dy; push(stitches, x, y, 'jump', block); continue; }
    if (ctrl === 0x82) { push(stitches, x, y, 'stop', block); continue; }
    if (ctrl === 0x9B) { push(stitches, x, y, 'trim', block); continue; }
    if (ctrl >= 0x83 && ctrl <= 0x9A) { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, x, y, 'color', block); continue; }
    break;
  }
  push(stitches, x, y, 'end', block);
  return blockResult(stitches, block, 'DSZ');
}

export function decodeEmbroidery(input, format) {
  const bytes=asBytes(input);
  if(bytes.byteLength>MAX_FILE_BYTES) fail('file exceeds 64 MiB limit');
  if(format==='jef') return readJef(bytes);
  if(format==='vp3') return readVp3(bytes);
  if(format==='dst') return readDst(bytes);
  if(format==='sew') return readSew(bytes);
  if(format==='pec') return readPec(bytes);
  if(format==='pes') return readPes(bytes);
  if(format==='exp') return readExp(bytes);
  if(format==='hus') return readHus(bytes);
  if(format==='xxx') return readXxx(bytes);
  if(format==='dsb') return readDsb(bytes);
  if(format==='dsz') return readDsz(bytes);
  fail('format must be jef, vp3, dst, sew, pec, pes, exp, hus, xxx, dsb or dsz');
}
