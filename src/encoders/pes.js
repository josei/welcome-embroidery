// @ts-check
// PES (Brother): sew segments per colour block, a colour log, then the PEC block.

/** @typedef {import('../encoders.js').Plan} Plan */

import {last} from './shared.js';
import {pecBody, pecChartIndex, pecColourSeq} from './pec.js';

// PES version 1: '#PES0001', the PEC block offset, sew segments per colour block and a colour log, then the PEC block.
/**
 * @typedef {{cmd: string, x: number, y: number, thread: string}} PesStitch
 * @typedef {{flag: number, colour: number, points: number[][]}} PesSegment
 */
/**
 * @param {Plan} plan
 * @param {(hex: string) => number} colourOf
 * @returns {{stitches: PesStitch[], segments: PesSegment[], left: number, top: number, right: number, bottom: number}}
 */
function pesSegments(plan,colourOf){
 /** @type {PesStitch[]} */
 const stitches=plan.stitches.filter(s=>s.cmd!=="end").map(s=>({cmd:s.cmd,x:Math.round(s.x*10),y:Math.round(s.y*10),thread:s.thread}));
 const xs=stitches.map(s=>s.x),ys=stitches.map(s=>s.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,left=minX-cx,top=minY-cy,right=maxX-cx,bottom=maxY-cy;
 const adjX=left+cx,adjY=bottom+cy;
 /** @type {{cmd: string, items: PesStitch[]}[]} */ const groups=[];
 /** @type {{cmd: string, items: PesStitch[]}|null} */ let previous=null;
 for(const s of stitches){if(s.cmd==="trim")continue;
   if(previous&&previous.cmd===s.cmd){previous.items.push(s);}else{previous={cmd:s.cmd,items:[s]};groups.push(previous);}}
 /** @type {PesSegment[]} */ const segments=[];
 let colour=colourOf(stitches[0]?.thread||"#527461"),sx=0,sy=0;
 for(const g of groups){
  if(g.cmd==="color"||g.cmd==="stop"){colour=colourOf(g.items[0].thread||"#527461");continue;}
  if(g.cmd==="jump"){const a=[sx-adjX,sy-adjY],b=last(g.items);segments.push({flag:1,colour,points:[a,[b.x-adjX,b.y-adjY]]});}
  else if(g.cmd==="stitch"){const pts=g.items.map(s=>[s.x-adjX,s.y-adjY]);sx=last(g.items).x;sy=last(g.items).y;segments.push({flag:0,colour,points:pts});}
  else throw Error(`Unsupported stitch command for PES: ${g.cmd}`);
 }
 return {stitches,segments,left,top,right,bottom};
}
// PES: '#PES0001' or '#PES0060', the PEC block offset, sew segments per colour block and a colour log, then the PEC block.
/** @param {Plan} plan @param {string} name @param {number} version @returns {Uint8Array} */
function pesWriter(plan,name,version){
 if(plan.errors.length)throw Error(plan.errors.join(" "));
 /** @type {string[]} */ const threads=[];
 /** @type {(hex: string) => number} */
 const colourOf=hex=>
   {const k=String(hex||"#527461").toLowerCase();let i=threads.indexOf(k);if(i<0){threads.push(k);i=threads.length-1;}return version===6?i:pecChartIndex(hex);};
 const {stitches,segments,left,top,right,bottom}=pesSegments(plan,colourOf);
 /** @type {number[]} */ const out=[];
 /** @type {(v: number) => void} */
 const i16=v=>{out.push(v&0xFF,(v>>8)&0xFF);};
 /** @type {(v: number) => void} */
 const i32=v=>{out.push(v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>>24)&0xFF);};
 /** @type {(v: number) => void} */
 const f32=v=>{const b=new DataView(new ArrayBuffer(4));b.setFloat32(0,v,true);out.push(...new Uint8Array(b.buffer));};
 /** @type {(s: string) => void} */
 const str16=s=>{i16(s.length);for(const c of s)out.push(c.charCodeAt(0));};
 /** @type {(s: string|null) => void} */
 const str8=s=>{const t=String(s??"").slice(0,255);out.push(t.length);for(const c of t)out.push(c.charCodeAt(0));};
 for(const c of (version===6?"#PES0060":"#PES0001"))out.push(c.charCodeAt(0));
 const pecPlaceholder=out.length;i32(0);
 if(version===6){
  i16(1);out.push(0x30,0x32);str8(name);str8(null);str8(null);str8(null);str8(null);
  i16(0);i16(0);i16(0x64);i16(0x64);i16(0);i16(0xC8);i16(0xC8);i16(0x64);i16(0x64);i16(0x64);i16(0x07);i16(0x13);i16(1);i16(1);i16(0);i16(100);i16(1);i16(0);
  out.push(0);f32(1);f32(0);f32(0);f32(1);f32(0);f32(0);
  i16(0);i16(0);i16(0);
  const rgb=threads.map(h=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];});
  i16(rgb.length);
  rgb.forEach(([r,g,b],k)=>{str8(null);out.push(r,g,b,0);i32(0xA);str8(threads[k]);str8(null);str8(null);});
    // PES v6 thread description: the colour's hex, so a machine or reader shows a label; brand and chart stay empty.
  i16(1);
 }else{i16(1);i16(1);i16(stitches.length?1:0);}
 i16(0xFFFF);i16(0);
 str16("CEmbOne");
 for(let k=0;k<8;k++)i16(0);
 f32(1);f32(0);f32(0);f32(1);
 const transX=350+1300/2-(right-left)/2,transY=100+(bottom-top)+1800/2-(bottom-top)/2;
 f32(transX);f32(transY);
 i16(1);i16(0);i16(0);i16(Math.trunc(right-left));i16(Math.trunc(bottom-top));
 for(let k=0;k<8;k++)out.push(0);
 const sectionsAt=out.length;i16(0);
 i16(0xFFFF);i16(0);
 str16("CSewSeg");
 /** @type {number[][]} */ const colourLog=[];
 let prevColour=-1;
 segments.forEach((seg,n)=>{
  if(n>0)i16(0x8003);
  if(prevColour!==seg.colour){colourLog.push([n,seg.colour]);prevColour=seg.colour;}
  i16(seg.flag);i16(seg.colour);i16(seg.points.length);
  for(const [px,py] of seg.points){i16(Math.trunc(px));i16(Math.trunc(py));}
 });
 i16(colourLog.length);
 for(const [n,c] of colourLog){i16(n);i16(c);}
 out[sectionsAt]=segments.length&0xFF;out[sectionsAt+1]=(segments.length>>8)&0xFF;
 i16(0);i16(0);
 if(version===6){i32(0);i32(0);for(let i=0;i<colourLog.length;i++){i32(i);i32(0);}}
 const pecAt=out.length;out[pecPlaceholder]=pecAt&0xFF;out[pecPlaceholder+1]=(pecAt>>8)&0xFF;out[pecPlaceholder+2]=(pecAt>>16)&0xFF;
   out[pecPlaceholder+3]=(pecAt>>>24)&0xFF;
 for(const b of pecBody(plan,name))out.push(b);
 if(version===6){
  const seq=pecColourSeq(plan),indices=seq.slice(0,255).map(pecChartIndex),list=[indices.length-1,...indices];
  out.push(...list);for(let k=list.length;k<128;k++)out.push(0x20);
  const rgb=threads.map(h=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];});
  for(let k=0;k<rgb.length;k++)for(let z=0;z<0x90;z++)out.push(0);
  for(const [r,g,b] of rgb)out.push(b,g,r);
  i16(0);
 }
 return Uint8Array.from(out);
}
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodePes(plan,name="Welcome"){return pesWriter(plan,name,1);}
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodePesV6(plan,name="Welcome"){return pesWriter(plan,name,6);}
