// Server-side PNG renderings so an agent can look at its own work: the compiled stitches, or the design (shapes before compiling), over a labelled millimetre grid.
// No dependencies beyond zlib: a tiny anti-aliased line and polygon rasteriser writing straight into an RGBA buffer.
import zlib from 'node:zlib';
import {geometry} from './src/engine.js';

const DIGITS={'0':[7,5,5,5,7],'1':[2,6,2,2,7],'2':[7,1,7,4,7],'3':[7,1,7,1,7],'4':[5,5,7,1,1],'5':[7,4,7,1,7],'6':[7,4,7,5,7],'7':[7,1,1,1,1],'8':[7,5,7,5,7],'9':[7,5,7,1,7],'-':[0,0,7,0,0]};
const hexRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');const n=m?parseInt(m[1],16):0x1c725d;return [n>>16&255,n>>8&255,n&255];};

class Canvas{
  constructor(w,h,bg=[255,253,249]){this.w=w;this.h=h;this.px=new Uint8Array(w*h*4);for(let i=0;i<w*h;i++){this.px[i*4]=bg[0];this.px[i*4+1]=bg[1];this.px[i*4+2]=bg[2];this.px[i*4+3]=255;}}
  blend(x,y,c,a){if(x<0||y<0||x>=this.w||y>=this.h||a<=0)return;const i=(y*this.w+x)*4,k=Math.min(1,a);this.px[i]+=(c[0]-this.px[i])*k;this.px[i+1]+=(c[1]-this.px[i+1])*k;this.px[i+2]+=(c[2]-this.px[i+2])*k;}
  // thick anti-aliased line: distance-to-segment coverage over the bounding box
  line(x0,y0,x1,y1,c,width=1,alpha=1){const r=width/2+.7,xa=Math.max(0,Math.floor(Math.min(x0,x1)-r)),xb=Math.min(this.w-1,Math.ceil(Math.max(x0,x1)+r)),ya=Math.max(0,Math.floor(Math.min(y0,y1)-r)),yb=Math.min(this.h-1,Math.ceil(Math.max(y0,y1)+r)),dx=x1-x0,dy=y1-y0,l2=dx*dx+dy*dy;
    for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){const t=l2?Math.max(0,Math.min(1,((x+.5-x0)*dx+(y+.5-y0)*dy)/l2)):0,d=Math.hypot(x+.5-x0-dx*t,y+.5-y0-dy*t),cov=Math.max(0,Math.min(1,width/2+.5-d));if(cov>0)this.blend(x,y,c,cov*alpha);}}
  dashed(x0,y0,x1,y1,c,width,alpha,dash=7,gap=5){const L=Math.hypot(x1-x0,y1-y0),ux=(x1-x0)/(L||1),uy=(y1-y0)/(L||1);for(let s=0;s<L;s+=dash+gap)this.line(x0+ux*s,y0+uy*s,x0+ux*Math.min(L,s+dash),y0+uy*Math.min(L,s+dash),c,width,alpha);}
  // even-odd polygon fill over all rings
  fill(rings,c,alpha){let ya=Infinity,yb=-Infinity;for(const r of rings)for(const p of r){ya=Math.min(ya,p[1]);yb=Math.max(yb,p[1]);}ya=Math.max(0,Math.floor(ya));yb=Math.min(this.h-1,Math.ceil(yb));
    for(let y=ya;y<=yb;y++){const yy=y+.5,xs=[];for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))xs.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      xs.sort((p,q)=>p-q);for(let i=0;i+1<xs.length;i+=2){const xa=Math.max(0,Math.round(xs[i])),xb=Math.min(this.w-1,Math.round(xs[i+1]));for(let x=xa;x<xb;x++)this.blend(x,y,c,alpha);}}}
  text(str,x,y,c,scale=2){let cx=x;for(const ch of String(str)){const g=DIGITS[ch];if(!g){cx+=2*scale;continue;}for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(g[row]&(4>>col))for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++)this.blend(cx+col*scale+sx,y+row*scale+sy,c,1);cx+=4*scale;}}
  png(){const raw=Buffer.alloc((this.w*4+1)*this.h);for(let y=0;y<this.h;y++){raw[y*(this.w*4+1)]=0;for(let x=0;x<this.w*4;x++)raw[y*(this.w*4+1)+1+x]=Math.round(this.px[y*this.w*4+x]);}
    const crcTable=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;}),crc=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
    const chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),cc=Buffer.alloc(4);cc.writeUInt32BE(crc(td));return Buffer.concat([len,td,cc]);};
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(this.w,0);ihdr.writeUInt32BE(this.h,4);ihdr[8]=8;ihdr[9]=6;
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);}
}

function frame(hoopW,hoopH,size){const m=5,x0=-hoopW/2-m,y0=-hoopH/2-m,W=hoopW+2*m,H=hoopH+2*m,scale=Math.min(size/W,size/H),cv=new Canvas(Math.round(W*scale),Math.round(H*scale)),X=x=>(x-x0)*scale,Y=y=>(y-y0)*scale;
  const grid=[130,160,175],gridMajor=[90,125,150];
  for(let gx=Math.ceil(x0/10)*10;gx<=x0+W;gx+=10){const major=gx%20===0;cv.line(X(gx),0,X(gx),cv.h,major?gridMajor:grid,1,major?.35:.18);if(major)cv.text(gx,X(gx)+3,3,[40,90,115]);}
  for(let gy=Math.ceil(y0/10)*10;gy<=y0+H;gy+=10){const major=gy%20===0;cv.line(0,Y(gy),cv.w,Y(gy),major?gridMajor:grid,1,major?.35:.18);if(major)cv.text(gy,3,Y(gy)+3,[40,90,115]);}
  const red=[208,58,42];cv.dashed(X(-hoopW/2),Y(-hoopH/2),X(hoopW/2),Y(-hoopH/2),red,1.5,.9);cv.dashed(X(hoopW/2),Y(-hoopH/2),X(hoopW/2),Y(hoopH/2),red,1.5,.9);cv.dashed(X(hoopW/2),Y(hoopH/2),X(-hoopW/2),Y(hoopH/2),red,1.5,.9);cv.dashed(X(-hoopW/2),Y(hoopH/2),X(-hoopW/2),Y(-hoopH/2),red,1.5,.9);
  cv.line(X(0)-9,Y(0),X(0)+9,Y(0),red,1.5,.9);cv.line(X(0),Y(0)-9,X(0),Y(0)+9,red,1.5,.9);
  return {cv,X,Y,scale,box:{x:+x0.toFixed(2),y:+y0.toFixed(2),w:+W.toFixed(2),h:+H.toFixed(2),pixelsPerMm:+scale.toFixed(3)}};
}

// The compiled stitches as thread lines (jumps as faint red dashes) on the grid.
export function renderStitches(plan,{hoopW=110,hoopH=110,size=900}={}){
  const {cv,X,Y,scale,box}=frame(hoopW,hoopH,size);let last=null,thread=plan.colors?.[0]||'#527461';const w=Math.max(1,.42*scale);
  for(const s of plan.stitches){if(s.cmd==='color'||s.cmd==='stop'){thread=s.thread||thread;last=[s.x,s.y];continue;}if(s.cmd==='trim'||s.cmd==='end'){last=null;continue;}
    if(s.cmd==='jump'){if(last)cv.dashed(X(last[0]),Y(last[1]),X(s.x),Y(s.y),[200,70,60],1,.45,4,4);last=[s.x,s.y];continue;}
    if(s.cmd==='stitch'){if(last)cv.line(X(last[0]),Y(last[1]),X(s.x),Y(s.y),hexRgb(s.thread||thread),w,.92);last=[s.x,s.y];}}
  return {png:cv.png(),box};
}
// The design before compiling: filled shapes (semi-transparent so overlaps show), satin columns at their width, running lines and lettering outlines.
export function renderDesign(doc,{size=900}={}){
  const hoopW=doc.hoop,hoopH=doc.hoopH??doc.hoop,{cv,X,Y,scale,box}=frame(hoopW,hoopH,size);
  for(const o of doc.objects){if(o.visible===false||o.mask||o.kind==='stitch_layer')continue;let lines;try{lines=geometry(o,0);}catch{continue;}const c=hexRgb(o.thread),px=lines.map(l=>l.map(([x,y])=>[X(x),Y(y)])).filter(l=>l.length>=2);
    const filled=o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed);
    if(filled){cv.fill(px.filter(l=>l.length>=3),c,.55);for(const l of px)for(let i=1;i<l.length;i++)cv.line(l[i-1][0],l[i-1][1],l[i][0],l[i][1],c,1.3,1);}
    else{const w=o.stitch==='satin'?Math.max(1.3,(o.satinWidth||3)*scale):Math.max(1.3,.6*scale);for(const l of px)for(let i=1;i<l.length;i++)cv.line(l[i-1][0],l[i-1][1],l[i][0],l[i][1],c,w,o.stitch==='satin'?.7:1);}}
  return {png:cv.png(),box};
}
