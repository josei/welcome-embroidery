// Image tracing: turns a picture into stacked colour regions (closed outlines with holes), ready to become filled paths.
// Pipeline: composite on white -> light blur -> median-cut palette (compared in Lab) -> label every pixel -> majority clean-up ->
// crack-following contours per colour -> smoothing and simplification -> holes grouped under their outlines.
import {rdp} from './geom.js';

const srgb=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
export function rgbToLab(r,g,b){const R=srgb(r),G=srgb(g),B=srgb(b),x=(R*.4124+G*.3576+B*.1805)/.95047,y=R*.2126+G*.7152+B*.0722,z=(R*.0193+G*.1192+B*.9505)/1.08883,f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;return [116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))];}
const hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');

// RGBA -> RGB over white, then a 3x3 median per channel: it removes JPEG noise and single stray pixels without inventing in-between colours at edges
function prepare(rgba,w,h){const out=new Uint8ClampedArray(w*h*3);for(let i=0;i<w*h;i++){const a=rgba[i*4+3]/255;for(let c=0;c<3;c++)out[i*3+c]=Math.round(rgba[i*4+c]*a+255*(1-a));}
  const med=new Uint8ClampedArray(out.length),buf=new Array(9);for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++){let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=Math.min(w-1,Math.max(0,x+dx)),yy=Math.min(h-1,Math.max(0,y+dy));buf[n++]=out[(yy*w+xx)*3+c];}buf.sort((p,q)=>p-q);med[(y*w+x)*3+c]=buf[4];}
  return med;}

// Palette: the colours that actually occur are put in a histogram (5 bits per channel); seeds are chosen by farthest-first in Lab, weighted by how common a colour is,
// then refined with a few k-means passes so antialiased in-between colours do not become palette entries.
export function buildPalette(rgb,n){const hist=new Map();for(let i=0;i<rgb.length;i+=3){const k=((rgb[i]>>3)<<10)|((rgb[i+1]>>3)<<5)|(rgb[i+2]>>3);hist.set(k,(hist.get(k)||0)+1);}
  const items=[...hist].map(([k,c])=>{const r=((k>>10)&31)*8+4,g=((k>>5)&31)*8+4,b=(k&31)*8+4;return {rgb:[r,g,b],lab:rgbToLab(r,g,b),c};});
  const d2=(p,q)=>(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;
  const centers=[items.reduce((m,p)=>p.c>m.c?p:m).lab.slice()],minD=items.map(p=>d2(p.lab,centers[0]));
  while(centers.length<Math.min(n,items.length)){let bi=-1,bs=0;items.forEach((p,i)=>{const sc=minD[i]*Math.pow(p.c,.35);if(sc>bs){bs=sc;bi=i;}});if(bi<0||bs<9)break;centers.push(items[bi].lab.slice());items.forEach((p,i)=>{minD[i]=Math.min(minD[i],d2(p.lab,centers.at(-1)));});}
  for(let it=0;it<8;it++){const sum=centers.map(()=>[0,0,0,0]);for(const p of items){let bj=0,bd=Infinity;centers.forEach((q,j)=>{const d=d2(p.lab,q);if(d<bd){bd=d;bj=j;}});const s=sum[bj];s[0]+=p.lab[0]*p.c;s[1]+=p.lab[1]*p.c;s[2]+=p.lab[2]*p.c;s[3]+=p.c;}centers.forEach((q,j)=>{if(sum[j][3]){q[0]=sum[j][0]/sum[j][3];q[1]=sum[j][1]/sum[j][3];q[2]=sum[j][2]/sum[j][3];}});}
  // report the RGB of the most common real colour closest to each centre (a colour that exists in the picture rather than an average)
  return centers.map(q=>{let best=items[0],bd=Infinity;for(const p of items){const d=d2(p.lab,q)/Math.pow(p.c,.2);if(d<bd){bd=d;best=p;}}return best.rgb;});}

function label(rgb,w,h,palette){const labs=palette.map(p=>rgbToLab(...p)),out=new Uint8Array(w*h),cache=new Map();
  for(let i=0;i<w*h;i++){const k=((rgb[i*3]>>2)<<12)|((rgb[i*3+1]>>2)<<6)|(rgb[i*3+2]>>2);let l=cache.get(k);if(l===undefined){const lab=rgbToLab(rgb[i*3],rgb[i*3+1],rgb[i*3+2]);let bd=Infinity;l=0;labs.forEach((q,j)=>{const d=(q[0]-lab[0])**2+(q[1]-lab[1])**2+(q[2]-lab[2])**2;if(d<bd){bd=d;l=j;}});cache.set(k,l);}out[i]=l;}
  return out;}
// replace a pixel by the label most of its 8 neighbours share when it is outvoted (removes salt and pepper)
function majority(lab,w,h,n){const out=lab.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const cnt=new Uint8Array(n);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)cnt[lab[(y+dy)*w+x+dx]]++;let best=lab[y*w+x],bc=cnt[best];for(let j=0;j<n;j++)if(cnt[j]>bc+1){best=j;bc=cnt[j];}out[y*w+x]=best;}return out;}

// boundary loops of a binary mask (crack following on the pixel corner grid). Returns closed rings of [x,y] corner coordinates.
export function maskLoops(mask,w,h){
  const at=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x]===1,edges=new Map();   // start vertex -> list of end vertices
  const add=(x0,y0,x1,y1)=>{const k=y0*(w+1)+x0;(edges.get(k)||edges.set(k,[]).get(k)).push([x1,y1]);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!at(x,y))continue;   // keep the region on the right-hand side of every edge
    if(!at(x,y-1))add(x,y,x+1,y);if(!at(x+1,y))add(x+1,y,x+1,y+1);if(!at(x,y+1))add(x+1,y+1,x,y+1);if(!at(x-1,y))add(x,y+1,x,y);}
  const loops=[];
  for(const [k0,list0] of edges){while(list0.length){const sx=k0%(w+1),sy=Math.floor(k0/(w+1)),ring=[[sx,sy]];let [cx,cy]=list0.pop(),px=sx,py=sy;
      while(!(cx===sx&&cy===sy)){ring.push([cx,cy]);const list=edges.get(cy*(w+1)+cx);if(!list||!list.length)break;let pick=0;if(list.length>1){const dx=cx-px,dy=cy-py;let bestTurn=-9;list.forEach(([nx,ny],i)=>{const ex=nx-cx,ey=ny-cy,cross=dx*ey-dy*ex;if(cross>bestTurn){bestTurn=cross;pick=i;}});}   // prefer the turn that keeps diagonal neighbours apart
        const [nx,ny]=list.splice(pick,1)[0];px=cx;py=cy;cx=nx;cy=ny;}
      if(ring.length>=3)loops.push(ring);}}
  return loops;
}
const area=r=>{let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
const inside=(ring,p)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)c=!c;}return c;};
function smooth(ring,passes){let r=ring;for(let k=0;k<passes;k++){r=r.map((p,i)=>{const a=r[(i+r.length-1)%r.length],b=r[(i+1)%r.length];return [(a[0]+2*p[0]+b[0])/4,(a[1]+2*p[1]+b[1])/4];});}return r;}
function simplify(ring,tol,maxPts){let t=tol,out=ring;for(let i=0;i<12;i++){const open=[...ring,ring[0]],s=rdp(open,t).slice(0,-1);out=s.length>=3?s:ring;if(out.length<=maxPts)return out;t*=1.5;}return out;}

// options: colors (2-16), detail (px tolerance, 0.4-3), minArea (px²), background ('auto'|'none'|index), maxRegions
export function traceImage(rgba,w,h,{colors=6,detail=.4,minArea=12,background='auto',maxRegions=60,smoothing=2,curves=true}={}){
  if(!(w>=2&&h>=2)||rgba.length<w*h*4)throw Error('The picture is empty.');
  const rgb=prepare(rgba,w,h),palette=buildPalette(rgb,Math.max(2,Math.min(16,colors)));
  let lab=label(rgb,w,h,palette);lab=majority(lab,w,h,palette.length);
  // background: the label that most of the border pixels carry
  let bg=-1;if(background==='auto'){const cnt=new Uint32Array(palette.length);for(let x=0;x<w;x++){cnt[lab[x]]++;cnt[lab[(h-1)*w+x]]++;}for(let y=0;y<h;y++){cnt[lab[y*w]]++;cnt[lab[y*w+w-1]]++;}let m=-1;cnt.forEach((c,j)=>{if(c>m){m=c;bg=j;}});}else if(Number.isInteger(background))bg=background;
  const pixelCount=new Uint32Array(palette.length);for(const l of lab)pixelCount[l]++;
  const regions=[];
  palette.forEach((p,j)=>{if(j===bg||!pixelCount[j])return;const mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)mask[i]=lab[i]===j?1:0;
    const loops=maskLoops(mask,w,h).map(r=>({ring:smooth(r,smoothing),fitSrc:smooth(r,1),a:area(r)})).filter(l=>Math.abs(l.a)>=minArea);
    const outers=loops.filter(l=>l.a>0).map(l=>({ring:l.ring,fitSrc:l.fitSrc,a:l.a,holes:[]})),holes=loops.filter(l=>l.a<0);
    for(const hl of holes){let host=null;for(const o of outers)if(inside(o.ring,hl.ring[0])&&(!host||o.a<host.a))host=o;if(host)host.holes.push(hl.ring);}
    for(const o of outers){const g={color:hex(...p),index:j,area:o.a-o.holes.reduce((s,r)=>s+Math.abs(area(r)),0),rings:[simplify(o.ring,detail,900),...o.holes.slice(0,20).map(r=>simplify(r,detail,190))]};
      if(curves){const err=Math.max(.9,detail*1.8),fit=fitRing(o.ring,err);if(fit&&fit.points.length<=900&&Math.abs(area(fit.flat)-Math.abs(o.a))<=Math.max(2,Math.abs(o.a)*.04)){g.curve={points:fit.points,handles:fit.handles};
        g.rings=[g.rings[0],...o.holes.slice(0,20).map(r=>{const hf=fitRing(r,err);return hf&&Math.abs(area(hf.flat)-Math.abs(area(r)))<=Math.max(2,Math.abs(area(r))*.06)?simplify(hf.flat,.15,190):simplify(r,detail,190);})];}}
      regions.push(g);}});
  regions.sort((a,b)=>b.area-a.area);
  return {palette:palette.map(p=>hex(...p)),background:bg>=0?hex(...palette[bg]):null,regions:regions.slice(0,maxRegions),dropped:Math.max(0,regions.length-maxRegions),width:w,height:h};
}

// Operations that create the traced regions as filled paths (largest first, so smaller regions sit on top), centred and scaled to widthMm.
export function traceOps(result,{widthMm=60,maxHeightMm=null,name='Traced image',prefix='trace'}={}){
  const k0=widthMm/result.width,k=maxHeightMm&&result.height*k0>maxHeightMm?maxHeightMm/result.height:k0,w=result.width*k,h=result.height*k,ops=[],ids=[];
  const map=ring=>ring.map(([x,y])=>[+(x*k-w/2).toFixed(2),+(y*k-h/2).toFixed(2)]);
  result.regions.forEach((g,i)=>{const id=`${prefix}-${i+1}`;ids.push(id);const mp=([x,y])=>[+(x*k-w/2).toFixed(2),+(y*k-h/2).toFixed(2)],pts=g.curve?g.curve.points.map(mp):map(g.rings[0]),handles=g.curve?g.curve.handles.map(hh=>({i:mp(hh.i),o:mp(hh.o)})):null;
    ops.push({op:'add_path',id,name:`${name} ${i+1}`,x:0,y:0,points:pts,closed:true,stitch:'fill',thread:g.color,...(handles?{handles}:{})});
    for(const hole of g.rings.slice(1)){const hp=map(hole);if(hp.length>=3&&hp.length<=200)ops.push({op:'add_hole',id,points:hp});}});
  if(ids.length>=2)ops.push({op:'group',ids});
  return {ops,ids,size:[w,h]};
}

// ---- line art ------------------------------------------------------------------------------------------------
// Dark strokes are thinned to a one pixel skeleton (Zhang-Suen), split into paths between endpoints and junctions, and given the stroke width measured on the picture.
function otsu(gray){const hist=new Uint32Array(256);for(const g of gray)hist[g]++;let total=gray.length,sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let wB=0,sB=0,best=0,thr=128;for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sB+=t*hist[t];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)**2;if(v>best){best=v;thr=t;}}return thr;}
export function thin(bin,w,h){const img=bin.slice(),at=(x,y)=>x<0||y<0||x>=w||y>=h?0:img[y*w+x];let changed=true,guard=0;
  while(changed&&guard++<200){changed=false;for(let pass=0;pass<2;pass++){const del=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!img[y*w+x])continue;const p2=at(x,y-1),p3=at(x+1,y-1),p4=at(x+1,y),p5=at(x+1,y+1),p6=at(x,y+1),p7=at(x-1,y+1),p8=at(x-1,y),p9=at(x-1,y-1),B=p2+p3+p4+p5+p6+p7+p8+p9;if(B<2||B>6)continue;const seq=[p2,p3,p4,p5,p6,p7,p8,p9,p2];let A=0;for(let i=0;i<8;i++)if(!seq[i]&&seq[i+1])A++;if(A!==1)continue;
      if(pass===0){if(p2*p4*p6!==0||p4*p6*p8!==0)continue;}else{if(p2*p4*p8!==0||p2*p6*p8!==0)continue;}del.push(y*w+x);}
      if(del.length){changed=true;for(const i of del)img[i]=0;}}}
  return img;}
function distance(bin,w,h){const INF=1e9,d=new Float32Array(w*h);for(let i=0;i<w*h;i++)d[i]=bin[i]?INF:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;let v=d[i];if(x>0)v=Math.min(v,d[i-1]+1);if(y>0){v=Math.min(v,d[i-w]+1);if(x>0)v=Math.min(v,d[i-w-1]+1.414);if(x<w-1)v=Math.min(v,d[i-w+1]+1.414);}d[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;let v=d[i];if(x<w-1)v=Math.min(v,d[i+1]+1);if(y<h-1){v=Math.min(v,d[i+w]+1);if(x<w-1)v=Math.min(v,d[i+w+1]+1.414);if(x>0)v=Math.min(v,d[i+w-1]+1.414);}d[i]=v;}
  return d;}
// options: threshold (0-255, default Otsu), minLength (px), detail (RDP px), maxPaths
export function traceLines(rgba,w,h,{threshold=null,minLength=6,detail=.8,maxPaths=60}={}){
  if(!(w>=2&&h>=2)||rgba.length<w*h*4)throw Error('The picture is empty.');
  const gray=new Uint8Array(w*h),col=[0,0,0];let nd=0;for(let i=0;i<w*h;i++){const a=rgba[i*4+3]/255,r=rgba[i*4]*a+255*(1-a),g=rgba[i*4+1]*a+255*(1-a),b=rgba[i*4+2]*a+255*(1-a);gray[i]=Math.round(.299*r+.587*g+.114*b);}
  const thr=threshold??otsu(gray),bin=new Uint8Array(w*h);for(let i=0;i<w*h;i++)if(gray[i]<=thr){bin[i]=1;nd++;col[0]+=rgba[i*4];col[1]+=rgba[i*4+1];col[2]+=rgba[i*4+2];}
  if(!nd)return {paths:[],color:'#222222',width:w,height:h,dropped:0,threshold:thr};
  const skel=thin(bin,w,h),dt=distance(bin,w,h),nb=(x,y)=>{const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<w&&yy<h&&skel[yy*w+xx])out.push([xx,yy]);}return out;};
  const key=(x,y)=>y*w+x,groups=(x,y)=>{const ring=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]].map(([dx,dy])=>{const xx=x+dx,yy=y+dy;return xx>=0&&yy>=0&&xx<w&&yy<h?skel[yy*w+xx]:0;});let g=0;for(let i=0;i<8;i++)if(ring[i]&&!ring[(i+7)%8])g++;return g;};
  const nodes=new Set();for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(skel[y*w+x]&&groups(x,y)!==2)nodes.add(key(x,y));
  const visited=new Set(),paths=[];
  const free=(x,y)=>nb(x,y).filter(([a,b])=>!visited.has(key(a,b))).sort((p,q)=>(Math.abs(p[0]-x)+Math.abs(p[1]-y))-(Math.abs(q[0]-x)+Math.abs(q[1]-y)));
  const walk=(sx,sy)=>{const pts=[[sx,sy]];let cx=sx,cy=sy;for(let n=0;n<w*h;n++){const nx=free(cx,cy);let step=null;for(const q of nx){if(nodes.has(key(q[0],q[1]))&&pts.length>1){step=q;break;}if(!nodes.has(key(q[0],q[1]))){step=q;break;}}if(!step){const edgeNode=nx.find(q=>nodes.has(key(q[0],q[1])));if(edgeNode&&pts.length>1){pts.push(edgeNode);}break;}
      pts.push(step);if(nodes.has(key(step[0],step[1])))break;visited.add(key(step[0],step[1]));cx=step[0];cy=step[1];}return pts;};
  for(const k of nodes){visited.add(k);}
  for(const k of nodes){const x=k%w,y=Math.floor(k/w);for(const [nx,ny] of nb(x,y)){if(visited.has(key(nx,ny)))continue;if(nodes.has(key(nx,ny)))continue;visited.add(key(nx,ny));const first=[nx,ny],rest=walk(nx,ny);paths.push([[x,y],...rest.length?rest:[first]]);}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!skel[y*w+x]||visited.has(key(x,y)))continue;visited.add(key(x,y));const p=walk(x,y);if(p.length>=3){const q=[...p];if(Math.hypot(q[0][0]-q.at(-1)[0],q[0][1]-q.at(-1)[1])<=1.5)q.push(q[0]);paths.push(q);}}
  const out=paths.map(p=>{const len=p.reduce((s,q,i)=>i?s+Math.hypot(q[0]-p[i-1][0],q[1]-p[i-1][1]):0,0),ws=p.map(([x,y])=>dt[y*w+x]).sort((a,b)=>a-b),wpx=Math.max(1,2*ws[Math.floor(ws.length/2)]-1),closed=p.length>3&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<=1.5;
    const s=rdp(p.map(([x,y])=>[x+.5,y+.5]),detail),slen=s.reduce((a,q,i)=>i?a+Math.hypot(q[0]-s[i-1][0],q[1]-s[i-1][1]):0,0);return {pts:s,length:Math.min(len,slen),widthPx:wpx,closed};}).filter(p=>p.length>=minLength&&p.pts.length>=2).sort((a,b)=>b.length-a.length);
  const hexc=hex(col[0]/nd,col[1]/nd,col[2]/nd);
  return {paths:out.slice(0,maxPaths),color:hexc,width:w,height:h,dropped:Math.max(0,out.length-maxPaths),threshold:thr};
}
// Operations: thin strokes become running stitch, wider ones satin columns of the measured width.
export function traceLineOps(result,{widthMm=60,maxHeightMm=null,name='Traced line',prefix='line',thread=null}={}){
  const k0=widthMm/result.width,k=maxHeightMm&&result.height*k0>maxHeightMm?maxHeightMm/result.height:k0,w=result.width*k,h=result.height*k,ops=[],ids=[];
  result.paths.forEach((p,i)=>{const id=`${prefix}-${i+1}`,pts=p.pts.map(([x,y])=>[+(x*k-w/2).toFixed(2),+(y*k-h/2).toFixed(2)]);if(pts.length<2)return;ids.push(id);const wmm=p.widthPx*k,satin=wmm>=1.3;
    ops.push({op:'add_path',id,name:`${name} ${i+1}`,x:0,y:0,points:pts,closed:Boolean(p.closed&&pts.length>=3),stitch:satin?'satin':'run',thread:thread||result.color,...(satin?{satinWidth:+Math.max(.8,Math.min(8,wmm)).toFixed(2)}:{})});});
  if(ids.length>=2)ops.push({op:'group',ids});
  return {ops,ids,size:[w,h]};
}

// ---- Bézier fitting (Schneider, "An algorithm for automatically fitting digitized curves") ----------------------------------------
const bz=(p,t)=>{const u=1-t;return [u*u*u*p[0][0]+3*u*u*t*p[1][0]+3*u*t*t*p[2][0]+t*t*t*p[3][0],u*u*u*p[0][1]+3*u*u*t*p[1][1]+3*u*t*t*p[2][1]+t*t*t*p[3][1]];};
const unit=v=>{const l=Math.hypot(v[0],v[1])||1;return [v[0]/l,v[1]/l];};
function fitCubic(pts,t1,t2,err,depth=0){
  const n=pts.length;if(n===2){const d=Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1])/3;return [[pts[0],[pts[0][0]+t1[0]*d,pts[0][1]+t1[1]*d],[pts[1][0]+t2[0]*d,pts[1][1]+t2[1]*d],pts[1]]];}
  let u=[0];for(let i=1;i<n;i++)u.push(u[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const L=u.at(-1)||1;u=u.map(v=>v/L);
  let bez=null,worst=Infinity,split=Math.floor(n/2);
  for(let iter=0;iter<=4;iter++){
    // least-squares handle lengths along the end tangents
    let c00=0,c01=0,c11=0,x0=0,x1=0;const [p0,p3]=[pts[0],pts[n-1]];
    for(let i=0;i<n;i++){const t=u[i],b1=3*(1-t)*(1-t)*t,b2=3*(1-t)*t*t,b0=(1-t)**3,b3=t**3,a1=[t1[0]*b1,t1[1]*b1],a2=[t2[0]*b2,t2[1]*b2],tmp=[pts[i][0]-(p0[0]*(b0+b1)+p3[0]*(b2+b3)),pts[i][1]-(p0[1]*(b0+b1)+p3[1]*(b2+b3))];c00+=a1[0]*a1[0]+a1[1]*a1[1];c01+=a1[0]*a2[0]+a1[1]*a2[1];c11+=a2[0]*a2[0]+a2[1]*a2[1];x0+=a1[0]*tmp[0]+a1[1]*tmp[1];x1+=a2[0]*tmp[0]+a2[1]*tmp[1];}
    const det=c00*c11-c01*c01,seg=Math.hypot(p3[0]-p0[0],p3[1]-p0[1]);let al=det?(x0*c11-x1*c01)/det:0,ar=det?(c00*x1-c01*x0)/det:0;
    if(al<1e-6*seg||ar<1e-6*seg){al=ar=seg/3;}
    bez=[p0,[p0[0]+t1[0]*al,p0[1]+t1[1]*al],[p3[0]+t2[0]*ar,p3[1]+t2[1]*ar],p3];
    worst=0;for(let i=0;i<n;i++){const q=bz(bez,u[i]),d=(q[0]-pts[i][0])**2+(q[1]-pts[i][1])**2;if(d>worst){worst=d;split=i;}}
    if(worst<=err*err)return [bez];
    if(worst>err*err*16)break;
    // Newton-Raphson reparameterisation
    u=u.map((t,i)=>{const q=bz(bez,t),d1=[3*((1-t)**2*(bez[1][0]-bez[0][0])+2*(1-t)*t*(bez[2][0]-bez[1][0])+t*t*(bez[3][0]-bez[2][0])),3*((1-t)**2*(bez[1][1]-bez[0][1])+2*(1-t)*t*(bez[2][1]-bez[1][1])+t*t*(bez[3][1]-bez[2][1]))],d2=[6*((1-t)*(bez[2][0]-2*bez[1][0]+bez[0][0])+t*(bez[3][0]-2*bez[2][0]+bez[1][0])),6*((1-t)*(bez[2][1]-2*bez[1][1]+bez[0][1])+t*(bez[3][1]-2*bez[2][1]+bez[1][1]))],num=(q[0]-pts[i][0])*d1[0]+(q[1]-pts[i][1])*d1[1],den=d1[0]*d1[0]+d1[1]*d1[1]+(q[0]-pts[i][0])*d2[0]+(q[1]-pts[i][1])*d2[1];return den?Math.max(0,Math.min(1,t-num/den)):t;});
  }
  if(depth>8||n<4)return [bez];
  split=Math.max(1,Math.min(n-2,split));const tc=unit([pts[split-1][0]-pts[split+1][0],pts[split-1][1]-pts[split+1][1]]);
  return [...fitCubic(pts.slice(0,split+1),t1,tc,err,depth+1),...fitCubic(pts.slice(split),[-tc[0],-tc[1]],t2,err,depth+1)];
}
// A closed ring (open list of points) -> {points, handles, flat}: corner nodes where the outline turns sharply, smooth nodes elsewhere; flat is the ring sampled from the curves.
export function fitRing(ring,err=.8,cornerAngle=.95){
  const n=ring.length;if(n<6)return null;const P=i=>ring[((i%n)+n)%n],k=Math.max(2,Math.round(n/40)),turn=[];
  for(let i=0;i<n;i++){const v1=unit([P(i)[0]-P(i-k)[0],P(i)[1]-P(i-k)[1]]),v2=unit([P(i+k)[0]-P(i)[0],P(i+k)[1]-P(i)[1]]);const ang=Math.acos(Math.max(-1,Math.min(1,v1[0]*v2[0]+v1[1]*v2[1])));turn.push(ang>cornerAngle?ang:0);}
  let splits=[];for(let i=0;i<n;i++){if(!turn[i])continue;let best=true;for(let d=-k;d<=k;d++){if(!d)continue;const j=((i+d)%n+n)%n;if(turn[j]>turn[i]||(turn[j]===turn[i]&&d<0))best=false;}if(best)splits.push(i);}
  {const kept=[];for(const i of splits){const last=kept.at(-1);if(last!==undefined&&i-last<=2*k){if(turn[i]>turn[last])kept[kept.length-1]=i;}else kept.push(i);}if(kept.length>1&&kept[0]+n-kept.at(-1)<=2*k){if(turn[kept[0]]>=turn[kept.at(-1)])kept.pop();else kept.shift();}splits=kept;}
  if(splits.length<2){const a=splits[0]??0;let far=a,bd=0;for(let i=0;i<n;i++){const d=Math.hypot(P(i)[0]-P(a)[0],P(i)[1]-P(a)[1]);if(d>bd){bd=d;far=i;}}splits=[a,far].sort((x,y)=>x-y);}
  const segCurves=splits.map((a,si)=>{const b=splits[(si+1)%splits.length],len=((b-a)%n+n)%n||n,seg=[];for(let d=0;d<=len;d++)seg.push(P(a+d));const kk=Math.min(k,seg.length-1),t1=unit([seg[kk][0]-seg[0][0],seg[kk][1]-seg[0][1]]),t2=unit([seg[seg.length-1-kk][0]-seg.at(-1)[0],seg[seg.length-1-kk][1]-seg.at(-1)[1]]);return fitCubic(seg,t1,t2,err);});
  const points=[],handles=[],flat=[];
  segCurves.forEach((curves,si)=>{const prev=segCurves[(si-1+segCurves.length)%segCurves.length];curves.forEach((c,j)=>{points.push(c[0]);handles.push({i:j===0?prev.at(-1)[2]:curves[j-1][2],o:c[1]});const steps=Math.max(3,Math.ceil(Math.hypot(c[3][0]-c[0][0],c[3][1]-c[0][1])/.8));for(let q=0;q<steps;q++)flat.push(bz(c,q/steps));});});
  return {points,handles,flat};
}
