// @ts-check
// Writers: turn a compiled plan into machine file bytes (JEF, VP3, PEC, PES, SEW, TBF, XXX, U01, EXP, DST) and thread colour lists (COL, EDR).
// The engine re-exports these functions, so callers keep importing them from engine.js.
import {threadPlan} from './sewingTime.js';
import {SEW_CHART,PEC_CHART} from './readers.js';
import {nearestJefColor} from './jefPalette.js';

/**
 * @typedef {{x: number, y: number, cmd: string, thread: string}} PlanStitch
 * @typedef {{errors: string[], stitches: PlanStitch[], bounds: number[], count: number}} Plan
 * @typedef {{thread: string, palette?: number, items: PlanStitch[]}} JefBlock
 * @typedef {{thread: string, start: number[], items: PlanStitch[]}} Vp3Block
 */

/**
 * The last item of a non-empty list.
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
const last=list=>/** @type {T} */(list.at(-1));

/** @type {(v: number, a: number, b: number) => number} */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** @type {(s: string, n: number) => number[]} */
const ascii=(s,n)=>Array.from({length:n},(_,i)=>s.charCodeAt(i)||0);
/** @param {Plan} plan @param {string} [color] @param {number} [hoop] @returns {Uint8Array} */
export function encodeJef(plan,color='#527461',hoop=110) {
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  // A true STOP is written like pyembroidery does: the 80 01 code with an extra thread slot whose palette entry is 0 (toggled back to the previous colour on the next STOP).
  /** @type {JefBlock[]} */ const blocks=[];
  /** @type {JefBlock|null} */ let block=null;let stopToggled=false;for(const p of plan.stitches){if(!block){block={thread:p.thread||color,items:[]};blocks.push(block);}if(p.cmd==='color'){block={thread:p.thread||color,items:[]};blocks.push(block);}else if(p.cmd==='stop'){stopToggled=!stopToggled;block={thread:block.thread,palette:stopToggled?0:undefined,items:[]};blocks.push(block);}else block.items.push(p);}if(!blocks.length)blocks.push({thread:color,items:[]});
  /** @type {number[]} */ const raw=[];
  let x=0,y=0,jumpCount=0,changeCount=0,needleCount=0,trimCount=0;
  /** @type {(dx: number, dy: number) => void} */
  const jump=(dx,dy)=>{while(dx!==0||dy!==0){const a=clamp(dx,-127,127),b=clamp(dy,-127,127);raw.push(128,2,a&255,(-b)&255);dx-=a;dy-=b;jumpCount++;}};
  for(let i=0;i<plan.stitches.length;i++){const p=plan.stitches[i];if(p.cmd==='end'){if(plan.stitches.slice(i+1).some(s=>s.cmd==='stitch'||s.cmd==='jump'||s.cmd==='color'||s.cmd==='stop'||s.cmd==='trim'))throw Error('JEF cannot encode commands after end.');continue;}const nx=Math.round(p.x*10),ny=Math.round(p.y*10),dx=nx-x,dy=ny-y;x=nx;y=ny;
    if(p.cmd==='color'||p.cmd==='stop'){
      if(Math.abs(dx)>127||Math.abs(dy)>127){jump(dx,dy);raw.push(128,1,0,0);}else raw.push(128,1,dx&255,(-dy)&255);
      changeCount++;
    }else if(p.cmd==='jump')jump(dx,dy);
    else if(p.cmd==='trim'){if(dx||dy)jump(dx,dy);raw.push(128,2,0,0);trimCount++;}
    else if(p.cmd==='stitch'){
      if(Math.abs(dx)>127||Math.abs(dy)>127)throw Error('JEF stitch delta exceeds 12.7 mm. Recompile with a shorter stitch length.');
      raw.push(dx&255,(-dy)&255);needleCount++;
    }else throw Error(`Unsupported stitch command for JEF: ${p.cmd}`);
  }
  raw.push(128,16);
  const threadCount=blocks.length,offset=116+threadCount*8;
  /** @type {number[]} */ const buf=new Array(offset).fill(0);
  /** @type {(at: number, v: number) => void} */
  const put32=(at,v)=>{buf[at]=v&255;buf[at+1]=(v>>>8)&255;buf[at+2]=(v>>>16)&255;buf[at+3]=(v>>>24)&255;};
  put32(0,offset);put32(4,0x14);const date='20260101000000';date.split('').forEach((c,i)=>buf[8+i]=c.charCodeAt(0));put32(24,threadCount);put32(28,needleCount+jumpCount*2+changeCount*2+trimCount*2+1);
  /** @type {(v: number) => number} */
  const pyRound=v=>{const f=Math.floor(v),d=v-f;return d<.5?f:d>.5?f+1:(f%2===0?f:f+1);};
  const ext=plan.stitches.filter(p=>p.cmd!=='end').reduce((m,p)=>[Math.min(m[0],Math.round(p.x*10)),Math.min(m[1],Math.round(p.y*10)),Math.max(m[2],Math.round(p.x*10)),Math.max(m[3],Math.round(p.y*10))],[Infinity,Infinity,-Infinity,-Infinity]),w=pyRound(ext[2]-ext[0]),h=pyRound(ext[3]-ext[1]),hw=pyRound(w/2),hh2=pyRound(h/2);
  // Header fields mirror pinned pystitch/pyembroidery JefWriter (the Ink/Stitch reference): hoop code from design size, then centre extents and distances to the 110x110, 50x50, 140x200 and custom (700x1000) hoop edges, or -1 when the design does not fit.
  put32(32,w<500&&h<500?1:w<1260&&h<1100?3:w<1400&&h<2000?2:w<2000&&h<2000?4:0);[hw,hh2,hw,hh2].forEach((v,i)=>put32(36+i*4,v));let at=52;for(const [ex,ey] of [[550,550],[250,250],[700,1000],[700,1000]]){const dx=ex-hw,dy=ey-hh2,vals=Math.min(dx,dy)>=0?[dx,dy,dx,dy]:[-1,-1,-1,-1];for(const v of vals){put32(at,v);at+=4;}}blocks.forEach((b,i)=>{put32(116+i*4,b.palette??nearestJefColor(b.thread));put32(116+threadCount*4+i*4,0x0d);});return new Uint8Array([...buf,...raw]);
}
/** @type {(n: number) => number[]} */
const be16=n=>[(n>>8)&255,n&255];
/** @type {(n: number) => number[]} */
const be32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
/** @type {(n: number) => number[]} */
const i8=n=>[n&255];
/** @param {Plan} plan @param {string} [color] @returns {Uint8Array} */
export function encodeVp3(plan,color='#527461') {
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  /** @type {number[]} */ const out=[];
  /** @type {(s: string) => number[]} */
  const str16=s=>{const a=[];for(const c of s)a.push(0,c.charCodeAt(0));return [...be16(a.length),...a];};
  /** @type {(s: string) => number[]} */
  const str8=s=>{const a=[...new TextEncoder().encode(s)];return [...be16(a.length),...a];};
  /** @type {(pos: number) => void} */
  const patch=pos=>{out.splice(pos,4,...be32(out.length-pos-4));};
  /** @type {(...a: number[]) => number} */
  const put=(...a)=>out.push(...a);
  /** @type {Vp3Block[]} */ const blocks=[];
  /** @type {Vp3Block|null} */ let block=null;
  /** @type {number[]|null} */ let pendingOrigin=null;
  for(let i=0;i<plan.stitches.length;i++){const p=plan.stitches[i],previous=plan.stitches[i-1],next=plan.stitches[i+1];if(p.cmd==='jump'&&next?.cmd==='color'){pendingOrigin=[p.x,p.y];continue;}if(p.cmd==='color'){block={thread:p.thread||color,start:pendingOrigin||[p.x,p.y],items:[]};blocks.push(block);pendingOrigin=null;continue;}if(p.cmd==='jump'&&block&&!block.items.some(item=>item.cmd==='stitch')){block.start=[p.x,p.y];continue;}if(!block){block={thread:p.thread||color,start:[p.x,p.y],items:[]};blocks.push(block);}block.items.push(p);}if(!blocks.length)blocks.push({thread:color,start:[0,0],items:[]});
  put(...ascii('%vsm%',5),0,...str16('Produced by Welcome Embroidery'),0,2,0);const filePatch=out.length;put(0,0,0,0,...str16(''));
  const [minX,minY,maxX,maxY]=plan.bounds,cx=(minX+maxX)/2,cy=(minY+maxY)/2,w=maxX-minX,h=maxY-minY;
  put(...be32(Math.round(maxX*1000)),...be32(Math.round(-minY*1000)),...be32(Math.round(minX*1000)),...be32(Math.round(-maxY*1000)),...be32(plan.count),0,blocks.length,12,0,1);
  put(0,3,0);const designPatch=out.length;put(0,0,0,0,...be32(Math.round(cx*1000)),...be32(Math.round(-cy*1000)),0,0,0,...be32(Math.round(-w*500)),...be32(Math.round(w*500)),...be32(Math.round(-h*500)),...be32(Math.round(h*500)),...be32(Math.round(w*1000)),...be32(Math.round(h*1000)),...str16(''),100,100,...be32(4096),...be32(0),...be32(0),...be32(4096),120,120,80,80,1,0,...str16('Produced by Welcome Embroidery'),...be16(blocks.length));
  for(let bi=0;bi<blocks.length;bi++){const b=blocks[bi],firstX=Math.round(b.start[0]*10),firstY=Math.round(b.start[1]*10),nudgeX=firstX===0?1:0,nudgeY=firstY===0?1:0,fileStartX=firstX+nudgeX,fileStartY=firstY+nudgeY,lastStitch=b.items.filter(p=>p.cmd==='stitch').at(-1),lastX=lastStitch?Math.round(lastStitch.x*10):firstX,lastY=lastStitch?Math.round(lastStitch.y*10):firstY;
    put(0,5,0);const blockPatch=out.length;put(0,0,0,0,...be32(Math.round((fileStartX/10-cx)*1000)),...be32(Math.round(-(fileStartY/10-cy)*1000)));
    const rgb=b.thread.match(/[0-9a-f]{2}/gi)?.map(v=>parseInt(v,16))||[82,116,97];put(1,0,rgb[0],rgb[1],rgb[2],0,0,0,5,40,...str8(''),...str8(b.thread),...str8('Welcome'));
    put(...be32(Math.round((lastX-firstX)*100)),...be32(Math.round(-(lastY-firstY)*100)),0,1,0);const stitchPatch=out.length;put(0,0,0,0,10,246,0);let px=fileStartX,py=fileStartY,hasNeedle=false;
    for(const p of b.items){if(p.cmd==='jump'){if(hasNeedle)put(128,3);continue;}if(p.cmd!=='stitch')continue;const nx=Math.round(p.x*10),ny=Math.round(p.y*10),dx=nx-px,dy=ny-py;px=nx;py=ny;hasNeedle=true;if(dx<-32768||dx>32767||dy<-32768||dy>32767)throw Error('VP3 stitch delta exceeds the signed 16-bit range.');if(dx>=-127&&dx<=127&&dy>=-127&&dy<=127)put(...i8(dx),...i8(dy));else put(128,1,...be16(dx),...be16(dy),128,2);}
    put(128,3);patch(stitchPatch);put(0);patch(blockPatch);
  }
  patch(designPatch);patch(filePatch);return new Uint8Array(out);
}
/**
 * @param {{kind: string, x: number, y: number, w: number, h: number, rotation?: number, thread: string, threadOverrides: object, source: {format: string, originalBytesBase64: string|null, defaultThread: string, defaultPlacement: {x: number, y: number, w: number, h: number}}}} o
 * @param {string} format
 * @returns {boolean}
 */
export function layerCanPassThrough(o,format){const p=o.source.defaultPlacement;return Boolean(o.kind==='stitch_layer'&&o.source.format===format&&o.source.originalBytesBase64&&o.x===p.x&&o.y===p.y&&o.w===p.w&&o.h===p.h&&(o.rotation||0)===0&&o.thread===o.source.defaultThread&&Object.keys(o.threadOverrides).length===0);}
/**
 * @param {{bounds: number[], threads: unknown[], stitches: PlanStitch[]}} decoded
 * @param {{source: {bounds: number[]}, threads: unknown[], stitches: PlanStitch[]}} o
 * @returns {boolean}
 */
export function sourceMatches(decoded,o){if(JSON.stringify(decoded.bounds)!==JSON.stringify(o.source.bounds)||JSON.stringify(decoded.threads)!==JSON.stringify(o.threads)||decoded.stitches.length!==o.stitches.length)return false;for(let i=0;i<decoded.stitches.length;i++){const a=decoded.stitches[i],b=o.stitches[i];if(a.x!==b.x||a.y!==b.y||a.cmd!==b.cmd||a.thread!==b.thread)return false;}return true;}
/** @param {PlanStitch[]} stitches @returns {boolean} */
export function vp3LayerHasUnsupportedTravel(stitches){for(let i=0;i<stitches.length;i++){const p=stitches[i],prev=stitches[i-1],next=stitches[i+1];if(p.cmd==='trim'||p.cmd==='stop')return true;if(p.cmd==='jump'){const blockOrigin=i===0||prev?.cmd==='color'||next?.cmd==='color',noOp=prev&&p.x===prev.x&&p.y===prev.y;if(!blockOrigin&&!noOp)return true;}}return false;}
// Tajima DST writer, following pyembroidery's DstWriter/encode_record: 512-byte ASCII header, balanced-ternary 3-byte records
// (max 12.1 mm per record), long jumps split, a trim is three small alternating jumps, colour change and stop are 0xC3, end is 0xF3.
/** @param {string|null|undefined} hex @returns {number} */
const pecChartIndex=hex=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||"")||[0,"527461"];const n=parseInt(m[1],16),c=[n>>16&255,n>>8&255,n&255];let best=0,bd=Infinity;PEC_CHART.forEach((r,i)=>{const d=(r[0]-c[0])**2+(r[1]-c[1])**2+(r[2]-c[2])**2;if(d<bd){bd=d;best=i;}});return best+1;};
// PEC (Brother): 512-byte header with palette indices, a stitch block in 0.1 mm, then blank 48 x 38 icons (one overview, one per colour).
/** @param {Plan} plan @returns {string[]} */
function pecColourSeq(plan){
/** @type {string[]} */ const seq=[];for(const p of plan.stitches){if(p.cmd==="end")continue;if(p.thread&&seq.at(-1)!==p.thread)seq.push(p.thread);}if(!seq.length)seq.push("#527461");return seq;}
/** @param {Plan} plan @param {string} name @returns {number[]} */
function pecBody(plan,name){
 if(plan.errors.length)throw Error(plan.errors.join(" "));
 const seq=pecColourSeq(plan);
 const indices=seq.slice(0,255).map(pecChartIndex);
 /** @type {number[]} */ const body=[];
 /** @type {(v: number, long: boolean, flag: number) => void} */
 const value=(v,long,flag)=>{if(!long&&v>-64&&v<63){body.push(v&0x7F);return;}let x=v&0x0FFF;x|=0x8000;x|=flag<<8;body.push((x>>8)&0xFF,x&0xFF);};
 let xx=0,yy=0,jumping=true,init=true,colourTwo=true;
 /** @type {(dx: number, dy: number, f: (sx: number, sy: number) => void) => void} */
 const chunks=(dx,dy,f)=>{let rx=dx,ry=dy;do{const sx=Math.max(-2047,Math.min(2047,rx)),sy=Math.max(-2047,Math.min(2047,ry));f(sx,sy);rx-=sx;ry-=sy;}while(rx!==0||ry!==0);};
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of plan.stitches){
  if(p.cmd==="end"){body.push(0xFF);break;}
  const nx=Math.round(p.x*10),ny=Math.round(p.y*10);
  minX=Math.min(minX,nx);maxX=Math.max(maxX,nx);minY=Math.min(minY,ny);maxY=Math.max(maxY,ny);
  if(p.cmd==="stitch"){if(jumping){if(nx-xx!==0&&ny-yy!==0){value(0,false,0);value(0,false,0);}jumping=false;}chunks(nx-xx,ny-yy,(sx,sy)=>{value(sx,false,0);value(sy,false,0);});xx=nx;yy=ny;}
  else if(p.cmd==="jump"){jumping=true;const flag=init?0x10:0x20;chunks(nx-xx,ny-yy,(sx,sy)=>{value(sx,true,flag);value(sy,true,flag);});xx=nx;yy=ny;}
  else if(p.cmd==="color"||p.cmd==="stop"){if(jumping){value(0,false,0);value(0,false,0);jumping=false;}body.push(0xFE,0xB0,colourTwo?2:1);colourTwo=!colourTwo;}
  else if(p.cmd==="trim"){}
  else throw Error(`Unsupported stitch command for PEC: ${p.cmd}`);
  init=false;
 }
 if(body.at(-1)!==0xFF)body.push(0xFF);
 const width=Math.max(0,Math.round(maxX-minX)),height=Math.max(0,Math.round(maxY-minY));
 /** @type {number[]} */ const out=[];
 /** @type {(...bs: number[]) => number} */
 const put=(...bs)=>out.push(...bs);
 /** @type {(s: unknown, n: number) => number[]} */
 const str=(s,n)=>[...String(s).replace(/[^\x20-\x7e]/g,"?").padEnd(n," ").slice(0,n)].map(c=>c.charCodeAt(0));
 put(...str("LA:"+String(name).replace(/[^\x20-\x7e]/g,"?").slice(0,16).padEnd(16," "),19),13);
 put(...new Array(12).fill(0x20),0xFF,0x00,0x06,0x26,...new Array(12).fill(0x20));
 put(indices.length-1,...indices);
 while(out.length<512)out.push(0x20);
 const blockLen=16+body.length;
 put(0x00,0x00,blockLen&0xFF,(blockLen>>8)&0xFF,(blockLen>>16)&0xFF,0x31,0xFF,0xF0,width&0xFF,(width>>8)&0xFF,height&0xFF,(height>>8)&0xFF,0xE0,0x01,0xB0,0x01);
 for(const b of body)out.push(b);
 for(let i=0;i<=indices.length;i++)for(let k=0;k<6*38;k++)out.push(0);
 return out;
}
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodePec(plan,name="Welcome"){return Uint8Array.from([...Array.from("#PEC0001",c=>c.charCodeAt(0)),...pecBody(plan,name)]);}
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
 for(const s of stitches){if(s.cmd==="trim")continue;if(previous&&previous.cmd===s.cmd){previous.items.push(s);}else{previous={cmd:s.cmd,items:[s]};groups.push(previous);}}
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
 const colourOf=hex=>{const k=String(hex||"#527461").toLowerCase();let i=threads.indexOf(k);if(i<0){threads.push(k);i=threads.length-1;}return version===6?i:pecChartIndex(hex);};
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
  rgb.forEach(([r,g,b],k)=>{str8(null);out.push(r,g,b,0);i32(0xA);str8(threads[k]);str8(null);str8(null);});// PES v6 thread description: the colour's hex, so a machine or reader shows a label; brand and chart stay empty.
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
 const pecAt=out.length;out[pecPlaceholder]=pecAt&0xFF;out[pecPlaceholder+1]=(pecAt>>8)&0xFF;out[pecPlaceholder+2]=(pecAt>>16)&0xFF;out[pecPlaceholder+3]=(pecAt>>>24)&0xFF;
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
/** @param {string|null|undefined} hex @returns {number} */
const sewChartIndex=hex=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||"")||[0,"527461"];const n=parseInt(m[1],16),c=[n>>16&255,n>>8&255,n&255];let best=0,bd=Infinity;SEW_CHART.forEach((r,i)=>{const d=(r[0]-c[0])**2+(r[1]-c[1])**2+(r[2]-c[2])**2;if(d<bd){bd=d;best=i;}});return best;};
// SEW (Janome native): a 2-byte colour count and 2-byte thread-chart indices, zeros up to offset 0x1D78, then the EXP-style stitch stream
// (signed byte pairs in 0.1 mm, y negated; 80 04 = jump, 80 01 = colour change, 80 00 = end). The pyembroidery SewReader has no trim record,
// so trims are not written and the next jump still moves the needle. Export only; checked by decoding with pyembroidery (scripts/verify-sew.mjs).
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeSew(plan){
 if(plan.errors.length)throw Error(plan.errors.join(' '));
 /** @type {string[]} */ const blocks=[plan.stitches.find(p=>p.cmd!=='end'&&p.thread)?.thread||'#527461'];
 for(const p of plan.stitches)if(p.cmd==='color'||p.cmd==='stop')blocks.push(p.thread||last(blocks));
 if(blocks.length>255)throw Error('SEW supports up to 255 colour blocks.');
 /** @type {number[]} */ const out=[blocks.length&0xff,blocks.length>>8];for(const hex of blocks){const i=sewChartIndex(hex);out.push(i&0xff,i>>8);}
 while(out.length<0x1D78)out.push(0);
 let x=0,y=0;
 /** @type {(nx: number, ny: number, jump: boolean) => void} */
 const move=(nx,ny,jump)=>{let dx=nx-x,dy=ny-y;while(dx!==0||dy!==0){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));if(jump)out.push(0x80,0x04);out.push(sx&0xff,(-sy)&0xff);dx-=sx;dy-=sy;x+=sx;y+=sy;}};
 for(const p of plan.stitches){const nx=Math.round(p.x*10),ny=Math.round(p.y*10);if(p.cmd==='end')continue;if(p.cmd==='color'||p.cmd==='stop'){out.push(0x80,0x01,0,0);move(nx,ny,true);}else if(p.cmd==='jump')move(nx,ny,true);else if(p.cmd==='trim')continue;else if(p.cmd==='stitch')move(nx,ny,false);else throw Error(`Unsupported stitch command for SEW: ${p.cmd}`);}
 out.push(0x80,0x00,0,0);return Uint8Array.from(out);
}
// Tajima TBF, written as pyembroidery 1.5.1 writes it. A 0x600-byte ASCII header: '3.00', the name at 0x80 (LA), the stitch and colour-change counts (ST, CO), the bounds (+X, -X, +Y, -Y), the last stitch (AX, AY), TP and JC, the needle order (256 bytes at 0x10A, one entry per colour change), and the thread table (DA: 0x45, RR, GG, BB, 0x20 per block from 0x20E), padded with spaces. Then 3-byte records: dx, -dy, command. Commands: 0x80 stitch, 0x90 jump (a zero jump reads as a trim), 0x81 needle change, 0x40 stop, 0x86 trim, 0x8F end. The reader ignores the move on 0x81, 0x40 and 0x86, so each of those is written with a zero move and followed by a jump to the position. Up to 72 thread blocks fit the table.
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodeTbf(plan,name='Welcome'){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  /** @type {string[]} */ const blocks=[plan.stitches.find(p=>p.cmd!=='end'&&p.thread)?.thread||'#527461'];
  for(const p of plan.stitches)if(p.cmd==='color')blocks.push(p.thread||last(blocks));
  if(blocks.length>72)throw Error('TBF holds up to 72 thread blocks.');
  /** @type {number[]} */ const body=[];
  /** @type {number[]} */ const order=new Array(256).fill(0);
  let x=0,y=0,minX=0,minY=0,maxX=0,maxY=0,stitches=0,changes=0;
  /** @type {(dx: number, dy: number, cmd: number) => void} */
  const rec=(dx,dy,cmd)=>{body.push(dx&0xFF,(-dy)&0xFF,cmd);if(cmd===0x80)stitches++;x+=dx;y+=dy;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};
  // A move longer than 12.7 mm per axis is cut into records of that size, all carrying the same command (stitch 0x80 or jump 0x90).
  /** @type {(nx: number, ny: number, cmd: number) => void} */
  const move=(nx,ny,cmd)=>{let dx=nx-x,dy=ny-y;while(Math.abs(dx)>127||Math.abs(dy)>127){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));rec(sx,sy,cmd);dx-=sx;dy-=sy;}if(dx||dy)rec(dx,dy,cmd);};
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
  line(`+X:${String(Math.abs(maxX)).padStart(5)}\r`);line(`-X:${String(Math.abs(minX)).padStart(5)}\r`);line(`+Y:${String(Math.abs(maxY)).padStart(5)}\r`);line(`-Y:${String(Math.abs(minY)).padStart(5)}\r`);
  line(`AX:${x>=0?'+':'-'}${String(Math.abs(x)).padStart(5)}\r`);line(`AY:${-y>=0?'+':'-'}${String(Math.abs(y)).padStart(5)}\r`);
  line(`TP:${pad('EG/',32)}\r`);line('JC:3\r');line('DO:');hdr.push(...order);line('\r');
  line('DA:');for(const hex of blocks)hdr.push(0x45,parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),0x20);
  if(hdr.length>0x376)throw Error('TBF thread table is too long.');
  fill(0x376);hdr.push(0x0D,0x1A);fill(0x600);
  return Uint8Array.from([...hdr,...body,0x1A]);
}
// Singer XXX, written as pyembroidery 1.5.1 writes it: a 252-byte header (23 zero bytes, the record count, 12 zeros, the thread count, the bounds in 0.1 mm, the last stitch), an int32 offset of the end of the stitches at 0xFC, the stitches from 0x100, then the end record 7F 7F 02 14 and the thread table. Records: a stitch is two signed bytes (dx, -dy); 7F 01 dx -dy is a jump, 7F 03 dx -dy a trim, and 7F 08 00 00 a colour change, followed by a jump to the needle position. Every delta is kept within ±123, so no stitch byte can read as the 7D/7E/7F markers. The table holds up to 21 thread blocks.
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
  const piece=(kind,dx,dy)=>{if(kind==='stitch')body.push(dx&0xFF,(-dy)&0xFF);else if(kind==='jump')body.push(0x7F,0x01,dx&0xFF,(-dy)&0xFF);else body.push(0x7F,0x03,dx&0xFF,(-dy)&0xFF);records++;x+=dx;y+=dy;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};
  // Moves are cut into pieces of at most 123 units per axis; the last piece carries the command (stitch, jump or trim).
  /** @type {(nx: number, ny: number, kind: string, final?: string) => void} */
  const move=(nx,ny,kind,final=kind)=>{let dx=nx-x,dy=ny-y;while(Math.abs(dx)>123||Math.abs(dy)>123){const sx=Math.max(-123,Math.min(123,dx)),sy=Math.max(-123,Math.min(123,dy));piece(kind==='stitch'?'stitch':'jump',sx,sy);dx-=sx;dy-=sy;}piece(final,dx,dy);};
  for(const p of plan.stitches){if(p.cmd==='end')continue;const nx=Math.round(p.x*10),ny=Math.round(p.y*10);
    if(p.cmd==='stitch'||p.cmd==='jump'){if(nx!==x||ny!==y)move(nx,ny,p.cmd);}
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
// Barudan U01, written as pyembroidery 1.5.1 writes it. A 256-byte header: 0x80 ASCII '0's, then int16 bounds (min x, -max y, max x, -min y), a zero int32, the record count + 1 as int32, and the last stitch as int16 (x, -y), padded to 0x100. Then 3-byte records: a control byte, dy, dx in 0.1 mm, with dy positive when 0x40 is set and dx negative when 0x20 is set. Commands in the low five bits: 0x00 stitch, 0x01 jump, 0x07 trim, 0x08 stop, 0x09-0x17 needle change to needle 1-15. The file ends F8 00 00. A move longer than 12.7 mm is split into records of at most 12.7 mm per axis.
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeU01(plan){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  /** @type {number[][]} */ const recs=[];
  let x=0,y=0,minX=0,minY=0,maxX=0,maxY=0,changes=0,lastX=0,lastY=0;
  /** @type {(cmd: number, dx: number, dy: number) => void} */
  const step=(cmd,dx,dy)=>{recs.push([cmd|(dy>=0?0x40:0)|(dx<=0?0x20:0),Math.abs(dy),Math.abs(dx)]);x+=dx;y+=dy;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};
  // The moves before the last record are jumps for a trim, stop or colour change, and carry the command's own cmd for a stitch or jump.
  /** @type {(nx: number, ny: number, cmd: number, final?: number) => void} */
  const move=(nx,ny,cmd,final=cmd)=>{let dx=nx-x,dy=ny-y;while(Math.abs(dx)>127||Math.abs(dy)>127){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));step(cmd,sx,sy);dx-=sx;dy-=sy;}step(final,dx,dy);};
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
// EXP (Melco): signed byte pairs in 0.1 mm, y negated; 80 04 = jump, 80 01 = colour change, 80 80 07 00 = trim, no header.
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeExp(plan){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  /** @type {number[]} */ const out=[];
  let x=0,y=0;
  /** @type {(nx: number, ny: number, jump: boolean) => void} */
  const move=(nx,ny,jump)=>{let dx=nx-x,dy=ny-y;while(dx!==0||dy!==0){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));if(jump)out.push(0x80,0x04);out.push(sx&0xff,(-sy)&0xff);dx-=sx;dy-=sy;x+=sx;y+=sy;}};
  for(const p of plan.stitches){const nx=Math.round(p.x*10),ny=Math.round(p.y*10);if(p.cmd==='end')continue;if(p.cmd==='color'||p.cmd==='stop'){out.push(0x80,0x01,0,0);move(nx,ny,true);}else if(p.cmd==='jump')move(nx,ny,true);else if(p.cmd==='trim')out.push(0x80,0x80,0x07,0x00);else if(p.cmd==='stitch')move(nx,ny,false);else throw Error(`Unsupported stitch command for EXP: ${p.cmd}`);}
  return Uint8Array.from(out);
}
/** @param {Plan} plan @param {string} [name] @returns {Uint8Array} */
export function encodeDst(plan,name='Welcome'){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  const XBITS={p81:2,n81:3,p27:2,n27:3,p9:2,n9:3,p3:0,n3:1,p1:0,n1:1},YBITS={p81:5,n81:4,p27:5,n27:4,p9:5,n9:4,p3:7,n3:6,p1:7,n1:6};
  /** @type {(v: number, bits: typeof XBITS) => {b0: number, b1: number, b2: number}} */
  const ternary=(v,bits)=>{const out={b0:0,b1:0,b2:0};let r=v;for(const [t,step,reg,pb,nb] of /** @type {Array<[number, number, 'b0'|'b1'|'b2', number, number]>} */([[40,81,'b2',bits.p81,bits.n81],[13,27,'b1',bits.p27,bits.n27],[4,9,'b0',bits.p9,bits.n9],[1,3,'b1',bits.p3,bits.n3],[0,1,'b0',bits.p1,bits.n1]])){if(r>t){out[reg]|=1<<pb;r-=step;}else if(r<-t){out[reg]|=1<<nb;r+=step;}}if(r!==0)throw Error('DST delta exceeds the record range.');return out;};
  /** @type {(dx: number, dy: number, kind: string) => number[]} */
  const record=(dx,dy,kind)=>{if(kind==='color')return [0,0,0xC3];if(kind==='end')return [0,0,0xF3];const ex=ternary(dx,XBITS),ey=ternary(-dy,YBITS);return [ex.b0|ey.b0,ex.b1|ey.b1,(kind==='jump'?0x80:0)|3|ex.b2|ey.b2];};
  /** @type {number[][]} */ const recs=[];
  let x=0,y=0,colors=0,count=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  /** @type {(nx: number, ny: number, kind: string) => void} */
  const move=(nx,ny,kind)=>{let dx=nx-x,dy=ny-y;while(dx!==0||dy!==0){const sx=Math.max(-121,Math.min(121,dx)),sy=Math.max(-121,Math.min(121,dy));recs.push(record(sx,sy,kind));dx-=sx;dy-=sy;x+=sx;y+=sy;count++;}};
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
  const header=`LA:${label}\rST:${pad(count,7)}\rCO:${pad(colors,3)}\r+X:${pad(Math.abs(maxX),5)}\r-X:${pad(Math.abs(minX),5)}\r+Y:${pad(Math.abs(-minY),5)}\r-Y:${pad(Math.abs(-maxY),5)}\rAX:${signed(x,5)}\rAY:${signed(-y,5)}\rMX:+${pad(0,5)}\rMY:+${pad(0,5)}\rPD:******\r\x1a`;
  const out=new Uint8Array(512+recs.length*3).fill(0x20);for(let i=0;i<header.length;i++)out[i]=header.charCodeAt(i);recs.forEach((r,i)=>out.set(r,512+i*3));return out;
}
// Thread colour list (COL, the text form pyembroidery reads and writes): the number of colours, then index,r,g,b for each, with CRLF line ends. Each colour is listed once, in order of first use.
// The design's colours, each once, in order of first use across the thread blocks, as [r, g, b] (shared by the COL and EDR colour lists).
/** @param {Plan} plan @returns {number[][]} */
function colourList(plan){if(plan.errors.length)throw Error(plan.errors.join(' '));
/** @type {string[]} */ const cols=[];for(const b of threadPlan(plan)){const k=b.thread.toLowerCase();if(!cols.includes(k))cols.push(k);}return cols.map(hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]);}
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeCol(plan){const cols=colourList(plan),lines=[String(cols.length)];cols.forEach(([r,g,b],i)=>lines.push(`${i},${r},${g},${b}`));return new TextEncoder().encode(lines.join('\r\n')+'\r\n');}
// Thread colour list (EDR, the binary form pyembroidery reads and writes): four bytes per colour, red, green, blue and a zero pad byte, in the same order as COL.
/** @param {Plan} plan @returns {Uint8Array} */
export function encodeEdr(plan){return Uint8Array.from(colourList(plan).flatMap(([r,g,b])=>[r,g,b,0]));}
