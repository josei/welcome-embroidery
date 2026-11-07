// @ts-check
// Text layout for registry fonts (converted Ink/Stitch fonts, TrueType outlines, custom fonts).
// Output is a list of stitchable primitives in millimetres, already positioned:
//   {t:'r', pts:[[x,y]...]}                 running-stitch polyline
//   {t:'s', a:[[x,y]...], b:[[x,y]...]}     satin column between two rails
//   {t:'f', rings:[[[x,y]...]...]}          fill (even-odd rings)
// Options on the text object: tracking (mm per letter), wordSpacing (mm), lineHeight (factor), align, italic (degrees), bold (mm).
/** @typedef {[number, number]} Pt */
/** @typedef {{t:'r',pts:Pt[]}|{t:'s',a:Pt[],b:Pt[],rungs?:Pt[][]}|{t:'f',rings:Pt[][]}} Prim */

/** @param {unknown} v @param {number} d @returns {number} */
const num=(v,d)=>Number.isFinite(Number(v))&&v!==null&&v!==''?Number(v):d;
/** @param {number[]} flat @returns {Pt[]} */
const pairs=flat=>{/** @type {Pt[]} */const out=[];for(let i=0;i+1<flat.length;i+=2)out.push(/** @type {Pt} */([flat[i],flat[i+1]]));return out;};
export const MAX_TEXT_CHARS=120,MAX_LINES=6;

/** @param {any} obj @param {any} font @returns {string[]} */
export function normaliseText(obj,font){let t=String(obj.text??'');if(font.letterCase==='upper')t=t.toUpperCase();else if(font.letterCase==='lower')t=
  t.toLowerCase();return t.replace(/\r/g,'').split('\n').slice(0,MAX_LINES);}

/** @param {Pt[]} pts @param {number} n @returns {Pt[]} */
function arclengthResample(pts,n){/** @type {Pt[]} */const out=[];const cum=[0];
  for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const L=cum.at(-1)||1;let j=1;
  for(let k=0;k<n;k++){const t=L*k/(n-1);while(j<cum.length-1&&cum[j]<t)j++;const seg=cum[j]-cum[j-1]||1,f=(t-cum[j-1])/seg;
  out.push(/** @type {Pt} */([pts[j-1][0]+(pts[j][0]-pts[j-1][0])*f,pts[j-1][1]+(pts[j][1]-pts[j-1][1])*f]));}return out;}

// Layout in font units first (so tracking, kerning and italic stay exact), then scale to mm.
/** @param {any} obj @param {any} font @param {{buffer?: (rings: Pt[][], d: number) => Pt[][] | null}} [opts] */
export function layoutText(obj,font,{buffer}={}){
  const h=num(obj.h,font.size),scale=h/font.unitsPerEm,normal=normaliseText(obj,font),
    // Vertical lettering: one character per row, stacked at the line height and centred on the lettering's x position.
    lines=obj.vertical?[...(normal[0]??'')].map(c=>c):normal,tracking=num(obj.tracking,0)/scale,wordSp=num(obj.wordSpacing,0)/scale,
    shear=Math.tan(Math.max(0,Math.min(35,num(obj.italic,0)))*Math.PI/180),lead=(font.leading||font.unitsPerEm*1.2)*
      Math.max(.5,Math.min(3,num(obj.lineHeight,1))),bold=Math.max(0,Math.min(3,num(obj.bold,0))),asOutline=font.kind==='outline'&&obj.stitch==='run';
  const rows=
    lines.map(line=>
    {let x=0,prev=null;/** @type {{ch:string,g:any,x:number}[]} */const placed=[];
    for(const ch of [...line]){const g=font.glyphs[ch];if(prev!==null&&font.kern){const k=font.kern[prev+ch];if(Number.isFinite(k))x+=k;}placed.push({ch,g,x});
    x+=(g?g.a:font.defaultAdvance)+tracking+(ch===' '?wordSp:0);prev=ch;}return {placed,width:Math.max(0,x-(line.length?tracking:0))};});
  const maxW=Math.max(0,...rows.map(r=>r.width)),natural=maxW*scale,stretch=num(obj.w,0)>0&&natural>0&&Math.abs(obj.w/natural-1)>1e-3?obj.w/natural:1;
  /** @type {Prim[]} */
  const prims=[];
  rows.forEach((row,li)=>{const off=obj.vertical?-row.width/2:obj.align==='center'?(maxW-row.width)/2:obj.align==='right'?maxW-row.width:0;
    /** @param {number} gx @param {number} gy @param {number} px @returns {Pt} */
    const map=(gx,gy,px)=>{const v=gy-font.baseline+li*lead,u=px+off+gx-v*shear;return [obj.x+u*scale*stretch,obj.y+v*scale];};
    for(const {g,x} of row.placed){if(!g)continue;for(const pr of g.p){
      if(pr[0]==='r')prims.push({t:'r',pts:pairs(pr[1]).map(([a,b])=>map(a,b,x))});
      else if(pr[0]==='s')prims.push(
        {t:'s',a:pairs(pr[1]).map(([a,b])=>map(a,b,x)),b:pairs(pr[2]).map(([a,b])=>map(a,b,x)),
        ...(pr[3]?.length?{rungs:pr[3].map(/** @param {number[]} q */q=>[map(q[0],q[1],x),map(q[2],q[3],x)])}:{})});
      else if(pr[0]==='f'){const rings=pr[1].map(/** @param {number[]} r */r=>pairs(r).map(([a,b])=>map(a,b,x)));
        if(asOutline)for(const r of rings)prims.push({t:'r',pts:[...r,r[0]]});else prims.push({t:'f',rings});}}}});
  return {prims:bold?embolden(prims,bold,buffer):prims,width:natural*stretch,lines:lines.length,scale};
}

// Bold: fills grow by bold/2 on every side (polygon buffer); satin columns widen by bold/2 per rail; running stitches stay as drawn.
/** @param {Prim[]} prims @param {number} d @param {((rings: Pt[][], d: number) => Pt[][] | null) | undefined} buffer @returns {Prim[]} */
function embolden(prims,d,buffer){return prims.map(p=>{
  if(p.t==='s'){const n=Math.max(12,Math.min(400,Math.max(p.a.length,p.b.length)*2)),A=arclengthResample(p.a,n),B=arclengthResample(p.b,n);
    return {t:'s',...(p.rungs?{rungs:p.rungs}:{}),a:
    A.map((q,i)=>{const o=B[i],dx=q[0]-o[0],dy=q[1]-o[1],l=Math.hypot(dx,dy)||1;return [q[0]+dx/l*d/2,q[1]+dy/l*d/2];}),b:
    B.map((q,i)=>{const o=A[i],dx=q[0]-o[0],dy=q[1]-o[1],l=Math.hypot(dx,dy)||1;return [q[0]+dx/l*d/2,q[1]+dy/l*d/2];})};}
  if(p.t==='f'&&buffer){const grown=buffer(p.rings,d/2);return grown?{t:'f',rings:grown}:p;}
  return p;});}

// Flattened polylines of a layout (what geometry() reports for bounds, hoop checks, alignment and design-view outlines).
/** @param {Prim[]} prims @returns {Pt[][]} */
export function primitiveLines(prims){const out=[];
  for(const p of prims){if(p.t==='r')out.push(p.pts);else if(p.t==='s')out.push([...p.a,...[...p.b].reverse(),p.a[0]]);
  else for(const r of p.rings)out.push([...r,r[0]]);}return out;}
/** @param {Prim[]} prims @param {(p: Pt) => Pt} fn @returns {Prim[]} */
export function mapPrimitives(prims,fn){
  return prims.map(p=>p.t==='r'?{t:'r',pts:p.pts.map(fn)}:p.t==='s'?{t:'s',a:p.a.map(fn),b:p.b.map(fn),...(p.rungs?{rungs:p.rungs.map(r=>r.map(fn))}:{})}:
  {t:'f',rings:p.rings.map(r=>r.map(fn))});}
/** @param {Prim[]} prims @param {number} [step] @returns {Prim[]} */
export function resamplePrimitives(prims,step=.8){const rs=/** @param {Pt[]} line */line=>
  {/** @type {Pt[]} */const out=[line[0]];
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
  for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;};
  return prims.map(p=>p.t==='r'?{t:'r',pts:rs(p.pts)}:p.t==='s'?{t:'s',a:rs(p.a),b:rs(p.b),...(p.rungs?{rungs:p.rungs}:{})}:
  {t:'f',rings:p.rings.map(r=>rs([...r,r[0]]).slice(0,-1))});}
