// @ts-check
// Tajima readers: DST, TAP and TBF.

// Codec behavior follows the MIT-licensed Ink/Stitch pystitch readers pinned in the upstream project; this is an independent JavaScript port.
/** @typedef {import('../readers.js').Stitch} Stitch */
/** @typedef {import('../readers.js').Thread} Thread */
/** @typedef {import('../readers.js').Decoded} Decoded */
/** @typedef {import('../readers.js').Step} Step */
import {MAX_THREADS, blockResult, dstPalette, fail, interpolateTrims, push, result, s8} from './shared.js';
// Tajima DST: a 512 byte text header, then 3 byte records of x/y steps in 0.1 mm (y points up) with jump, colour-change and end flags. DST has no
// colours, so each colour block gets a distinct placeholder thread; a run of three or more small jumps is a trim, which is how DST writes one.

/** @param {Uint8Array} bytes @returns {Decoded} */
export function readDst(bytes) {
  if (bytes.length < 515) fail('DST file is too short');
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 512));
  if (!/^LA:/.test(head)) fail('DST header is missing');
  let x=0,y=0,block=0;
  /** @type {{dx: number, dy: number}[]} */
  let jumps=[];
  /** @type {Stitch[]} */ const stitches=[];
  const flush=()=>{ // jumps recorded so far: the first three small ones are a trim
    let i=0;
    if (jumps.length>=3 && jumps.slice(0,3).every(j=>Math.hypot(j.dx,j.dy)<=6)) {
      const tx = x-jumps.slice(3).reduce((a,j)=>a+j.dx,0);
      const ty = y-jumps.slice(3).reduce((a,j)=>a+j.dy,0);
      push(stitches,tx,ty,'trim',block);
      i=3;
    }
    let cx=x-jumps.slice(i).reduce((a,j)=>a+j.dx,0),cy=y-jumps.slice(i).reduce((a,j)=>a+j.dy,0);
    for (;i<jumps.length;i++){cx+=jumps[i].dx;cy+=jumps[i].dy;push(stitches,cx,cy,'jump',block);}
    jumps=[];
  };
  let ended=false;
  for (let p=512;p+2<bytes.length&&!ended;p+=3){
    const b0=bytes[p],b1=bytes[p+1],b2=bytes[p+2];
    let dx=0,dy=0;
    if(b0&0x01)dx+=1;if(b0&0x02)dx-=1;if(b0&0x04)dx+=9;if(b0&0x08)dx-=9;
    if(b1&0x01)dx+=3;if(b1&0x02)dx-=3;if(b1&0x04)dx+=27;if(b1&0x08)dx-=27;
    if(b2&0x04)dx+=81;if(b2&0x08)dx-=81;
    if(b0&0x80)dy+=1;if(b0&0x40)dy-=1;if(b0&0x20)dy+=9;if(b0&0x10)dy-=9;
    if(b1&0x80)dy+=3;if(b1&0x40)dy-=3;if(b1&0x20)dy+=27;if(b1&0x10)dy-=27;
    if(b2&0x20)dy+=81;if(b2&0x10)dy-=81;
    dy=-dy;                                   // DST y points up, the editor's y points down
    if((b2&0xF3)===0xF3){flush();ended=true;break;}
    if((b2&0xC3)===0xC3){flush();block++;push(stitches,x,y,'color',block);continue;}
    x+=dx;y+=dy;
    if(b2&0x80){jumps.push({dx,dy});continue;}
    flush();push(stitches,x,y,'stitch',block);
  }
  flush();
  push(stitches,x,y,'end',block);
  /** @type {Thread[]} */
  const threads=[];
  for(let i=0;i<=block&&i<MAX_THREADS;i++){
    threads.push({index:i,color:dstPalette[i%dstPalette.length],brand:'DST',catalogNumber:null,name:`Colour ${i+1}`});
  }
  if(block>=MAX_THREADS)fail('too many colour changes');
  return result(stitches,threads,['DST files carry no thread colours: placeholder colours were assigned.']);
}

// Tajima-style TAP, read as pyembroidery 1.5.1 does (TapReader): DST records with no header, then pyembroidery's trim pass. A jump run of three or
// more jumps after stitching gets a trim at its start, and zero-length jump runs are removed. Sequin codes are refused: the editor has no sequin
// commands to map them to.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readTap(bytes) {
  const CMD = {STITCH: 0, JUMP: 1, TRIM: 2, END: 4, COLOR: 5, SEQUIN_MODE: 6, SEQUIN_EJECT: 7};
  /** @type {(b: number, n: number) => number} */ const bit = (b, n) => (b >> n) & 1;
  /** @type {(b0: number, b1: number, b2: number) => number} */
  const dxOf = (b0, b1, b2) =>
    81 * bit(b2, 2) - 81 * bit(b2, 3) + 27 * bit(b1, 2) - 27 * bit(b1, 3)
    + 9 * bit(b0, 2) - 9 * bit(b0, 3) + 3 * bit(b1, 0) - 3 * bit(b1, 1) + bit(b0, 0) - bit(b0, 1);
  /** @type {(b0: number, b1: number, b2: number) => number} */
  const dyOf = (b0, b1, b2) =>
    -(81 * bit(b2, 5) - 81 * bit(b2, 4) + 27 * bit(b1, 5) - 27 * bit(b1, 4)
      + 9 * bit(b0, 5) - 9 * bit(b0, 4) + 3 * bit(b1, 7) - 3 * bit(b1, 6) + bit(b0, 7) - bit(b0, 6));
  /** @type {Step[]} */ const st = [];
  let x = 0, y = 0;
  for (let p = 0; p + 3 <= bytes.length; p += 3) {
    const b0 = bytes[p], b1 = bytes[p + 1], b2 = bytes[p + 2];
    if ((b2 & 0xF3) === 0xF3) break;
    x += dxOf(b0, b1, b2); y += dyOf(b0, b1, b2);
    if ((b2 & 0xC3) === 0xC3) st.push({x, y, cmd: CMD.COLOR});
    else if ((b2 & 0x43) === 0x43) fail('TAP sequin codes are not supported');
    else if ((b2 & 0x83) === 0x83) st.push({x, y, cmd: CMD.JUMP});
    else st.push({x, y, cmd: CMD.STITCH});
  }
  st.push({x, y, cmd: CMD.END});
  interpolateTrims(st, 3, true);
  /** @type {Stitch[]} */ const stitches = [];
  let block = 0;
  for (const s of st) {
    if (s.cmd === CMD.COLOR) { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, s.x, s.y, 'color', block); }
    else if (s.cmd === CMD.STITCH) push(stitches, s.x, s.y, 'stitch', block);
    else if (s.cmd === CMD.JUMP) push(stitches, s.x, s.y, 'jump', block);
    else if (s.cmd === CMD.TRIM) push(stitches, s.x, s.y, 'trim', block);
    else push(stitches, s.x, s.y, 'end', block);
  }
  return blockResult(stitches, block, 'TAP');
}

// Tajima TBF, read as pyembroidery 1.5.1 does (TbfReader): a name at 0x83, a 256-byte needle order at 0x10A, a colour table from 0x20E (each entry
// a 0x45 byte, a 24-bit colour and a space), then 3-byte stitch records from 0x600. A 0x81 record changes needle, which starts a colour block
// (needle 0 is a stop). The colour blocks take the table's colours in order, with placeholders past the table; pyembroidery does not map needles to
// table entries either.
/** @param {Uint8Array} bytes @returns {Decoded} */
export function readTbf(bytes) {
  if (bytes.length < 0x600) fail('TBF header is truncated');
  const name = new TextDecoder().decode(bytes.subarray(0x83, 0x93)).trim();
  const order = bytes.subarray(0x10A, 0x10A + 0x100);
  /** @type {string[]} */ const colours = [];
  let p = 0x20E;
  while (p < bytes.length) {
    const tag = bytes[p++];
    if (tag !== 0x45 || p + 4 > bytes.length) break;
    colours.push('#' + ((bytes[p] << 16 | bytes[p + 1] << 8 | bytes[p + 2]) & 0xFFFFFF).toString(16).padStart(6, '0'));
    p += 4;
  }
  /** @type {Stitch[]} */ const stitches = [];
  let x = 0, y = 0, block = 0, needle = 0;
  for (let q = 0x600; q + 3 <= bytes.length; q += 3) {
    const b0 = bytes[q], b1 = bytes[q + 1], c = bytes[q + 2];
    if (c === 0x80) { x += s8(b0); y -= s8(b1); push(stitches, x, y, 'stitch', block); }
    else if (c === 0x81) {
      if (needle >= 256) fail('TBF has more needle changes than its needle order');
      const value = order[needle++];
      if (value === 0) push(stitches, x, y, 'stop', block);
      else { block++; if (block >= MAX_THREADS) fail('too many colour changes'); push(stitches, x, y, 'color', block); }
    }
    else if (c === 0x90) {
      if (b0 === 0 && b1 === 0) push(stitches, x, y, 'trim', block);
      else { x += s8(b0); y -= s8(b1); push(stitches, x, y, 'jump', block); }
    }
    else if (c === 0x40) push(stitches, x, y, 'stop', block);
    else if (c === 0x86) push(stitches, x, y, 'trim', block);
    else break;
  }
  push(stitches, x, y, 'end', block);
  /** @type {Thread[]} */ const threads = [];
  /** @type {string[]} */ const warnings = [];
  if (colours.length < block + 1) warnings.push(colours.length
    ? 'TBF file has fewer colours than colour changes: placeholder colours were assigned.'
    : 'TBF file has no colour table: placeholder colours were assigned.');
  for (let i = 0; i <= Math.max(colours.length - 1, block); i++) {
    threads.push(i < colours.length
      ? {index: i, color: colours[i], brand: 'TBF', catalogNumber: null, name: `Colour ${i + 1}`}
      : {index: i, color: '#527461', brand: 'TBF', catalogNumber: null, name: `Colour ${i + 1}`});
  }
  const decoded = result(stitches, threads, warnings);
  if (name) decoded.metadata = {name: name.slice(0, 240)};
  return decoded;
}
