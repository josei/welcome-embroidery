// @ts-check
// VP3 (Pfaff): nested colour blocks with a signed 16-bit stitch stream.

/** @typedef {import('../encoders.js').Plan} Plan */
/** @typedef {import('../encoders.js').Vp3Block} Vp3Block */

import {ascii, be16, be32, i8, splitLongStitches} from './shared.js';

/** @param {Plan} plan @param {string} [color] @returns {Uint8Array} */
export function encodeVp3(plan,color='#527461') {
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  // The walk that splits long moves starts at the design's first point, not the machine origin: nothing was sewn before the first stitch, so a line drawn
  // from the origin to it would be thread the plan never had.
  const first=plan.stitches.find(p=>p.cmd!=='end');
  plan={...plan,stitches:splitLongStitches(plan.stitches,undefined,first?{x:first.x,y:first.y}:undefined)};
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
  for(let i=0;i<plan.stitches.length;i++){const p=plan.stitches[i],previous=plan.stitches[i-1],next=plan.stitches[i+1];
    if(p.cmd==='jump'&&(next?.cmd==='color'||next?.cmd==='stop')){pendingOrigin=[p.x,p.y];continue;}
    // A stop is a block boundary too: VP3 has no stop command, so it is written like a colour change and read back as one.
    // A design that starts with a colour change gets an empty first block: VP3 counts colour changes as block boundaries, so without it the first change
    // would be lost. This is the same rule the PEC writer follows.
    if((p.cmd==='color'||p.cmd==='stop')&&!blocks.length){blocks.push({thread:p.thread||color,start:pendingOrigin||[p.x,p.y],items:[]});}
    if(p.cmd==='color'||p.cmd==='stop'){block=
    {thread:p.thread||color,start:pendingOrigin||[p.x,p.y],items:[]};blocks.push(block);pendingOrigin=null;continue;}if(p.cmd==='jump'&&block&&
    !block.items.some(item=>item.cmd==='stitch')){block.start=[p.x,p.y];continue;}if(!block){block={thread:p.thread||color,start:[p.x,p.y],items:[]};
    blocks.push(block);}block.items.push(p);}if(!blocks.length)blocks.push({thread:color,start:[0,0],items:[]});
  put(...ascii('%vsm%',5),0,...str16('Produced by Welcome Embroidery'),0,2,0);const filePatch=out.length;put(0,0,0,0,...str16(''));
  const [minX,minY,maxX,maxY]=plan.bounds,cx=(minX+maxX)/2,cy=(minY+maxY)/2,w=maxX-minX,h=maxY-minY;
  put(...be32(Math.round(maxX*1000)),...be32(Math.round(-minY*1000)),...be32(Math.round(minX*1000)),...be32(Math.round(-maxY*1000)),...be32(plan.count),0,
    blocks.length,12,0,1);
  put(0,3,0);const designPatch=out.length;
    put(0,0,0,0,...be32(Math.round(cx*1000)),...be32(Math.round(-cy*1000)),0,0,0,...be32(Math.round(-w*500)),...be32(Math.round(w*500)),
    ...be32(Math.round(-h*500)),...be32(Math.round(h*500)),...be32(Math.round(w*1000)),...be32(Math.round(h*1000)),...str16(''),100,100,...be32(4096),
    ...be32(0),...be32(0),...be32(4096),120,120,80,80,1,0,...str16('Produced by Welcome Embroidery'),...be16(blocks.length));
  for(let bi=0;bi<blocks.length;bi++){const b=blocks[bi],firstX=Math.round(b.start[0]*10),firstY=Math.round(b.start[1]*10),nudgeX=firstX===0?1:0,nudgeY=
    firstY===0?1:0,fileStartX=firstX+nudgeX,fileStartY=firstY+nudgeY,lastStitch=b.items.filter(p=>p.cmd==='stitch').at(-1),lastX=lastStitch?
    Math.round(lastStitch.x*10):firstX,lastY=lastStitch?Math.round(lastStitch.y*10):firstY;
    put(0,5,0);const blockPatch=out.length;put(0,0,0,0,...be32(Math.round((fileStartX/10-cx)*1000)),...be32(Math.round(-(fileStartY/10-cy)*1000)));
    const rgb=b.thread.match(/[0-9a-f]{2}/gi)?.map(v=>parseInt(v,16))||[82,116,97];
      put(1,0,rgb[0],rgb[1],rgb[2],0,0,0,5,40,...str8(''),...str8(b.thread),...str8('Welcome'));
    put(...be32(Math.round((lastX-firstX)*100)),...be32(Math.round(-(lastY-firstY)*100)),0,1,0);const stitchPatch=out.length;put(0,0,0,0,10,246,0);let px=
      fileStartX,py=fileStartY,hasNeedle=false,trimmed=false;
    // A trim, or a jump between stitches, is written as a trim marker where the needle is. The next stitch is sewn from that point, as the reader expects.
    for(const p of b.items){if(p.cmd==='trim'||p.cmd==='jump'){if(hasNeedle&&!trimmed){put(128,3);trimmed=true;}continue;}if(p.cmd!=='stitch')continue;const nx=Math.round(p.x*10),ny=
      Math.round(p.y*10),dx=nx-px,dy=ny-py;px=nx;py=ny;hasNeedle=true;trimmed=false;
      if(dx<-32768||dx>32767||dy<-32768||dy>32767)throw Error('VP3 stitch delta exceeds the signed 16-bit range.');
      if(dx>=-127&&dx<=127&&dy>=-127&&dy<=127)put(...i8(dx),...i8(dy));else put(128,1,...be16(dx),...be16(dy),128,2);}
    put(128,3);patch(stitchPatch);put(0);patch(blockPatch);
  }
  patch(designPatch);patch(filePatch);return new Uint8Array(out);
}
