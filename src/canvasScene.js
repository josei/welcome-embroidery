// @ts-check
// The canvas scene: the hoop rectangles and the #shapes SVG content, rebuilt from the document on every render.
// canvas.js exposes it as canvasView.drawScene(); app.js calls that in render() before drawControls().
import {geometry,hoopSize,HOOP_PRESETS,textPrimitives} from './engine.js';
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {setHoopFields} from './hoopState.js';
import {isRegistryFont} from './fonts.js';
import {photoUrl} from './photoUrl.js';
import {importMidpoint} from './stitchImport.js';

const NS='http://www.w3.org/2000/svg';
const $=(/** @type {string} */ s)=>/** @type {any} */(document.querySelector(s));
const node=(/** @type {string} */ tag)=>/** @type {any} */(document.createElementNS(NS,tag));

// Lettering drawn with a bundled font: filled outlines, satin columns and running lines, one path per primitive.
function appendTextShapes(/** @type {any} */ group,/** @type {any} */ o){
 const prims=textPrimitives(o)||[],thread=o.thread;
 const mk=(/** @type {any} */ attrs)=>{const el=node('path');for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);group.append(el);};
 const d=(/** @type {any[]} */ rings,/** @type {boolean} */ close)=>rings.map(
  (/** @type {any} */ r)=>'M'+r.map((/** @type {any} */ p)=>`${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')+(close?'Z':'')).join('');
 for(const p of prims){
  if(p.t==='f')mk({d:d(p.rings,true),fill:thread,'fill-opacity':'.85','fill-rule':'evenodd',stroke:'none'});
  else if(p.t==='s')mk({d:d([[...p.a,...[...p.b].reverse()]],true),fill:thread,'fill-opacity':'.7',stroke:'none'});
  else mk({d:d([p.pts],false),fill:'none',stroke:thread,'stroke-width':'.4','stroke-linecap':'round','stroke-linejoin':'round'});
 }
}

// Draws the hoop and every document object into #shapes. Ids and classes are part of the rendered output and must not change.
export function drawScene(){
 const doc=documentNow().doc,{selected,multi}=selState();
 const hoop=hoopSize(doc);
 const setRect=(/** @type {string} */ id,/** @type {number} */ w,/** @type {number} */ h,/** @type {number} */ rx)=>{
  const r=$(id);
  r.setAttribute('x',-w/2);r.setAttribute('y',-h/2);r.setAttribute('width',w);r.setAttribute('height',h);r.setAttribute('rx',rx);
 };
 setRect('#hoopOuter',hoop.w+8,hoop.h+8,7);
 setRect('#hoopRing',hoop.w,hoop.h,4);
 setRect('#hoopLinen',hoop.w-2.4,hoop.h-2.4,3);
 setHoopFields({hoopW:String(hoop.w),hoopH:String(hoop.h),preset:HOOP_PRESETS.find(p=>p.w===hoop.w&&p.h===hoop.h)?.key??'custom'});

 const g=$('#shapes');
 g.replaceChildren();
 const defs=node('defs'),clipDone=new Set();
 g.append(defs);
 for(const o of doc.objects){
  const isText=o.kind==='text'||o.kind==='stitch_layer',isEllipse=o.kind==='ellipse';
  const tag=isText?'g':isEllipse?'ellipse':o.kind==='path'?(o.holes?.length?'path':'polyline'):(Array.isArray(o.radii)?'path':'rect');
  const element=node(tag);
  element.classList.add('shape');
  element.dataset.id=o.id;
  if(o.clipId){
   const m=doc.objects.find((/** @type {any} */ v)=>v.id===o.clipId);
   if(m){
    if(!clipDone.has(m.id)){
     clipDone.add(m.id);
     const cp=node('clipPath');
     cp.setAttribute('id','clip-'+m.id);
     const pa=node('path');
     pa.setAttribute('d',geometry(m,0).map(r=>'M'+r.map(q=>q.join(',')).join('L')+'Z').join(''));
     pa.setAttribute('clip-rule','evenodd');
     cp.append(pa);
     defs.append(cp);
    }
    element.setAttribute('clip-path',`url(#clip-${m.id})`);
   }
  }
  if(o.photo){
   const pat=node('pattern');
   pat.setAttribute('id','photo-'+o.id);
   pat.setAttribute('patternUnits','userSpaceOnUse');
   pat.setAttribute('x',o.x);pat.setAttribute('y',o.y);pat.setAttribute('width',o.w);pat.setAttribute('height',o.h);
   const im=node('image');
   im.setAttribute('href',photoUrl(o.photo));im.setAttribute('width',o.w);im.setAttribute('height',o.h);
   im.setAttribute('preserveAspectRatio','none');
   pat.append(im);
   defs.append(pat);
   element.dataset.gradient='photo-'+o.id;
  }
  if((o.blendThread||o.blendPalette)&&o.stitch==='fill'&&o.kind!=='text'){
   const a=((o.blendAngle!==undefined?o.blendAngle-90:(o.angle??doc.settings.angle))||0)*Math.PI/180,
    c=Math.cos(a),sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2,L=Math.abs(o.w*sn)+Math.abs(o.h*c)||1,
    lg=node('linearGradient');
   lg.setAttribute('id','blend-'+o.id);
   lg.setAttribute('gradientUnits','userSpaceOnUse');
   lg.setAttribute('x1',cx+sn*L/2);lg.setAttribute('y1',cy-c*L/2);
   lg.setAttribute('x2',cx-sn*L/2);lg.setAttribute('y2',cy+c*L/2);
   let s0=o.blendStart??0,s1=o.blendEnd??1,c0=o.thread,c1=o.blendThread;
   if(s0>s1){[s0,s1]=[s1,s0];[c0,c1]=[c1,c0];}
   const pal=o.blendPalette,palN=pal?.length;
   const ramp=pal?pal.map((/** @type {any} */ c,/** @type {number} */ k)=>
    [(o.blendStart??0)+((o.blendEnd??1)-(o.blendStart??0))*k/(palN-1),c]):null;
   const stops=pal?[[0,pal[0]],...ramp,[1,pal[palN-1]]]:[[0,c0],[s0,c0],[s1,c1],[1,c1]];
   for(const [off,col] of stops){const st=node('stop');st.setAttribute('offset',off);st.setAttribute('stop-color',col);lg.append(st);}
   defs.append(lg);
   element.dataset.gradient='blend-'+o.id;
  }
  const bare=o.stitch==='run'||(o.kind==='path'&&!(o.closed&&o.stitch==='fill'))||o.kind==='text'||o.kind==='stitch_layer';
  element.setAttribute('fill',bare?'none':o.thread);
  if(element.dataset.gradient)element.setAttribute('fill',`url(#${element.dataset.gradient})`);
  if(o.mask){element.classList.add('mask-shape');element.setAttribute('fill','none');}
  if(o.kind==='path'&&o.closed&&o.stitch==='fill')element.setAttribute('fill-opacity','.85');
  element.setAttribute('stroke',o.thread);
  element.setAttribute('stroke-width','.45');
  if(o.kind==='stitch_layer'){
   const [x0,y0,x1,y1]=o.source.bounds,[mx,my]=importMidpoint(o.source.bounds),sx=o.w/Math.max(.1,x1-x0),sy=o.h/Math.max(.1,y1-y0),
    a=(o.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2,
    coords=(/** @type {any} */ st)=>{const lx=(st.x-mx)*sx,ly=(st.y-my)*sy;return [cx+lx*c-ly*s,cy+lx*s+ly*c];};
   const paths=new Map();
   let travel='',previous=null;
   for(const st of o.stitches){
    const p=coords(st);
    if(st.cmd==='jump'){if(previous)travel+=`M${previous[0]} ${previous[1]}L${p[0]} ${p[1]}`;previous=p;continue;}
    if(st.cmd==='trim'||st.cmd==='end'){previous=null;continue;}
    if(st.cmd==='stitch'){
     const col=o.threadOverrides[st.thread]||o.threads[st.thread].color||o.thread;
     if(!paths.has(col))paths.set(col,'');
     paths.set(col,paths.get(col)+(previous?`M${previous[0]} ${previous[1]}L${p[0]} ${p[1]}`:`M${p[0]} ${p[1]}`));
     previous=p;
    }
   }
   for(const [col,d] of paths){
    const path=node('path');
    path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',col);path.setAttribute('stroke-width','.32');
    element.append(path);
   }
   if(travel){
    const jumps=node('path');
    jumps.setAttribute('d',travel);jumps.setAttribute('fill','none');jumps.setAttribute('stroke','#909992');
    jumps.setAttribute('stroke-width','.2');jumps.setAttribute('stroke-dasharray','.7 .7');
    element.append(jumps);
   }
  }else if(o.kind==='text'&&isRegistryFont(o.font)){
   appendTextShapes(element,o);
  }else if(o.kind==='text'){
   for(const line of geometry(o)){const p=node('polyline');p.setAttribute('points',line.map(pt=>pt.join(',')).join(' '));element.append(p);}
  }else if(o.kind==='ellipse'){
   element.setAttribute('cx',o.x+o.w/2);
   element.setAttribute('cy',o.y+o.h/2);
   element.setAttribute('rx',o.w/2);
   element.setAttribute('ry',o.h/2);
  }else if(o.kind==='path'&&o.holes?.length){
   element.setAttribute('d',geometry(o).map(r=>'M'+r.map(p=>p.join(' ')).join('L')+'Z').join(''));
   element.setAttribute('fill-rule','evenodd');
  }else if(o.kind==='path'){
   element.setAttribute('points',geometry(o)[0].map(p=>p.join(',')).join(' '));
  }else if(o.kind==='rect'&&Array.isArray(o.radii)){
   element.setAttribute('d','M'+geometry(o)[0].map(p=>p.join(' ')).join('L')+'Z');
  }else{
   element.setAttribute('x',o.x);
   element.setAttribute('y',o.y);
   element.setAttribute('width',o.w);
   element.setAttribute('height',o.h);
   element.setAttribute('rx',Math.min(o.radius||0,o.w/2,o.h/2));
  }
  const rotated=o.rotation&&o.kind!=='path'&&o.kind!=='text'&&o.kind!=='stitch_layer';
  if(rotated)element.setAttribute('transform',`rotate(${o.rotation} ${o.x+o.w/2} ${o.y+o.h/2})`);
  if(o.stitch==='satin'&&o.kind==='path'){
   element.style.strokeWidth=String(o.satinWidth??3);
   element.style.strokeOpacity='.55';
   element.setAttribute('stroke-linejoin','round');
   element.style.strokeLinecap='butt';
  }
  if(o.id===selected)element.classList.add('selected');else if(multi.has(o.id))element.classList.add('multi');
  if(o.border&&o.stitch==='fill'){
   element.setAttribute('stroke',o.borderThread||o.thread);
   element.style.strokeWidth='.9';
  }
  g.append(element);
 }
}
