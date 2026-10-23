// Deterministic stitch compiler and JEF/VP3 serializers. Document units are mm.
import {polygonClipping,bufferSegments,closedRing,rdp,openRing} from './geom.js';
import {getFont,isRegistryFont,registerDocumentFonts} from './fonts.js';
import {planPhoto,planRippleFill,planCrossStitch,planContourFill,planSpiralFill,planGuidedFill,planMeanderFill,planFill,planContour,planFillUnderlay,sampleRun,makeInside,chainRuns} from './stitchplan.js';
import {layoutText,primitiveLines,mapPrimitives,resamplePrimitives,MAX_TEXT_CHARS} from './textlayout.js';
import {nearestJefColor} from './jefPalette.js';
import {decodeEmbroidery} from './readers.js';
import neonFont from '../fonts/neon_blinking/glyphs.js';
const round = n => Math.round(n * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GLYPHS = {
 A:[[0,1,.5,0],[.5,0,1,1],[.22,.62,.78,.62]],B:[[0,1,0,0],[0,0,.68,0],[.68,0,1,.2],[1,.2,.68,.48],[0,.48,.68,.48],[.68,.48,1,.72],[1,.72,.68,1],[0,1,.68,1]],C:[[1,.12,.72,0],[.72,0,.2,0],[.2,0,0,.22],[0,.22,0,.78],[0,.78,.2,1],[.2,1,.75,1],[.75,1,1,.88]],D:[[0,1,0,0],[0,0,.55,0],[.55,0,1,.22],[1,.22,1,.78],[1,.78,.55,1],[.55,1,0,1]],E:[[1,0,0,0],[0,0,0,1],[0,.5,.8,.5],[0,1,1,1]],F:[[0,1,0,0],[0,0,1,0],[0,.5,.78,.5]],G:[[1,.16,.76,0],[.76,0,.2,0],[.2,0,0,.2],[0,.2,0,.8],[0,.8,.2,1],[.2,1,1,1],[1,1,1,.56],[1,.56,.58,.56]],H:[[0,0,0,1],[1,0,1,1],[0,.5,1,.5]],I:[[.18,0,.82,0],[.5,0,.5,1],[.18,1,.82,1]],J:[[.2,0,1,0],[.65,0,.65,.78],[.65,.78,.48,1],[.48,1,.16,1],[.16,1,0,.82]],K:[[0,0,0,1],[1,0,0,.56],[.42,.42,1,1]],L:[[0,0,0,1],[0,1,1,1]],M:[[0,1,0,0],[0,0,.5,.52],[.5,.52,1,0],[1,0,1,1]],N:[[0,1,0,0],[0,0,1,1],[1,1,1,0]],O:[[.22,0,.78,0],[.78,0,1,.2],[1,.2,1,.8],[1,.8,.78,1],[.78,1,.22,1],[.22,1,0,.8],[0,.8,0,.2],[0,.2,.22,0]],P:[[0,1,0,0],[0,0,.72,0],[.72,0,1,.18],[1,.18,.72,.5],[.72,.5,0,.5]],Q:[[.22,0,.78,0],[.78,0,1,.2],[1,.2,1,.8],[1,.8,.78,1],[.78,1,.22,1],[.22,1,0,.8],[0,.8,0,.2],[0,.2,.22,0],[.58,.68,1,1]],R:[[0,1,0,0],[0,0,.72,0],[.72,0,1,.18],[1,.18,.72,.5],[.72,.5,0,.5],[.55,.5,1,1]],S:[[1,.12,.78,0],[.78,0,.2,0],[.2,0,0,.2],[0,.2,.2,.42],[.2,.42,.8,.58],[.8,.58,1,.78],[1,.78,.78,1],[.78,1,.15,1],[.15,1,0,.87]],T:[[0,0,1,0],[.5,0,.5,1]],U:[[0,0,0,.78],[0,.78,.2,1],[.2,1,.8,1],[.8,1,1,.78],[1,.78,1,0]],V:[[0,0,.5,1],[.5,1,1,0]],W:[[0,0,.18,1],[.18,1,.5,.58],[.5,.58,.82,1],[.82,1,1,0]],X:[[0,0,1,1],[1,0,0,1]],Y:[[0,0,.5,.5],[1,0,.5,.5],[.5,.5,.5,1]],Z:[[0,0,1,0],[1,0,0,1],[0,1,1,1]],'0':[[.2,0,.8,0],[.8,0,1,.2],[1,.2,1,.8],[1,.8,.8,1],[.8,1,.2,1],[.2,1,0,.8],[0,.8,0,.2],[0,.2,.2,0]],'1':[[.2,.18,.5,0],[.5,0,.5,1],[.2,1,.8,1]],'2':[[0,.2,.2,0],[.2,0,.8,0],[.8,0,1,.2],[1,.2,0,1],[0,1,1,1]],'3':[[0,.15,.2,0],[.2,0,.8,0],[.8,0,1,.2],[1,.2,.55,.48],[.55,.48,1,.72],[1,.72,.8,1],[.8,1,.15,1],[.15,1,0,.86]],'4':[[0,0,0,.55],[0,.55,1,.55],[.72,0,.72,1]],'5':[[1,0,0,0],[0,0,0,.48],[0,.48,.8,.48],[.8,.48,1,.7],[1,.7,.8,1],[.8,1,.1,1]],'6':[[.9,0,.2,0],[.2,0,0,.28],[0,.28,0,.8],[0,.8,.2,1],[.2,1,.8,1],[.8,1,1,.8],[1,.8,.8,.56],[.8,.56,0,.56]],'7':[[0,0,1,0],[1,0,.25,1]],'8':[[.2,0,.8,0],[.8,0,1,.22],[1,.22,.5,.5],[.5,.5,0,.22],[0,.22,.2,0],[.5,.5,1,.78],[1,.78,.8,1],[.8,1,.2,1],[.2,1,0,.78],[0,.78,.5,.5]],'9':[[.9,.44,.2,.44],[.2,.44,0,.22],[0,.22,.2,0],[.2,0,.8,0],[.8,0,1,.2],[1,.2,1,.72],[1,.72,.8,1],[.8,1,.2,1]]
};

export function hoopSize(d){const w=Number(d.hoop);return {w,h:Number(d.hoopH??w)};}
export const hoopLabel=({w,h})=>w===h?`${w} mm`:`${w} × ${h} mm`;
// Plain SVG for Inkscape and friends: millimetre units, origin at the hoop centre, one element per object (fills with even-odd
// holes, satin as a thick butt-capped stroke along the centreline, running stitches and lettering as thin strokes, imported
// machine stitches as per-colour polylines). It is a design interchange file, not a stitch plan.
export function exportSvg(doc){
  const hs=hoopSize(doc),f=v=>+Number(v).toFixed(3),esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),d=(lines,close=false)=>lines.map(l=>'M'+l.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')+(close?'Z':'')).join('');
  const out=[];
  for(const o of doc.objects){if(o.visible===false)continue;const title=`<title>${esc(o.name||o.kind)}</title>`;
    if(o.kind==='stitch_layer'){const [x0,y0,x1,y1]=o.source.bounds,sx=o.w/Math.max(.1,x1-x0),sy=o.h/Math.max(.1,y1-y0),a=(Number(o.rotation)||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2,paths=new Map();let prev=null;
      for(const st of o.stitches){const lx=(st.x-(x0+x1)/2)*sx,ly=(st.y-(y0+y1)/2)*sy,p=[cx+lx*c-ly*sn,cy+lx*sn+ly*c];if(st.cmd==='stitch'){const col=o.threadOverrides?.[st.thread]||o.threads[st.thread]?.color||o.thread;if(!paths.has(col))paths.set(col,'');paths.set(col,paths.get(col)+(prev?`M${f(prev[0])} ${f(prev[1])}L${f(p[0])} ${f(p[1])}`:`M${f(p[0])} ${f(p[1])}`));prev=p;}else prev=(st.cmd==='trim'||st.cmd==='end')?null:p;}
      out.push(`<g>${title}${[...paths].map(([col,dd])=>`<path d="${dd}" fill="none" stroke="${col}" stroke-width=".3" stroke-linecap="round"/>`).join('')}</g>`);continue;}
    const lines=geometry(o,0);if(!lines.length)continue;
    if(o.kind==='path'&&o.stitch==='satin')out.push(`<path d="${d([lines[0]])}" fill="none" stroke="${o.thread}" stroke-width="${f(o.satinWidth??3)}" stroke-linecap="butt" stroke-linejoin="round">${title}</path>`);
    else if(o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed))out.push(`<path d="${d(lines,true)}" fill="${o.thread}" fill-rule="evenodd"${o.border?` stroke="${o.borderThread||o.thread}" stroke-width="${f(Math.max(.5,Number(o.borderWidth)||0))}"`:''}>${title}</path>`);
    else out.push(`<path d="${d(lines)}" fill="none" stroke="${o.thread}" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round">${title}</path>`);}
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${f(hs.w)}mm" height="${f(hs.h)}mm" viewBox="${f(-hs.w/2)} ${f(-hs.h/2)} ${f(hs.w)} ${f(hs.h)}">\n<title>${esc(doc.name)}</title>\n${out.join('\n')}\n</svg>\n`;
}
export function jefWarnings(plan,format='jef'){if(format!=='jef'||!plan.bounds)return [];const w=plan.bounds[2]-plan.bounds[0],h=plan.bounds[3]-plan.bounds[1];return w>=200||h>=200?[`Warning: ${w.toFixed(0)} × ${h.toFixed(0)} mm is beyond the largest JEF hoop code (200 × 200 mm); the file gets hoop code 0 and no hoop-edge distances, and machines may reject it.`]:[];}
export function initialDocument() {
  return {schema:'welcom/1',name:'Botanical badge',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:true,compensation:.2},objects:[
    // Six-petal blossom: a smooth Bézier rosette (not a flat ellipse) filled with tatami rows blended across a
    // three-colour palette (coral -> peach -> gold) for thread-painted shading, finished with a crisp satin-like border.
    {id:'flower',name:'Wildflower',kind:'path',closed:true,smooth:true,
      points:[[0,-28.8],[3.6,-22.24],[11.09,-22.4],[7.2,-16],[11.09,-9.6],[3.6,-9.76],[0,-3.2],[-3.6,-9.76],[-11.09,-9.6],[-7.2,-16],[-11.09,-22.4],[-3.6,-22.24]],
      handles:[{i:[-2.5,-28.8],o:[2.5,-28.8]},{i:[1.44,-23.48],o:[5.76,-20.99]},{i:[9.84,-24.56],o:[12.33,-20.24]},{i:[7.2,-18.5],o:[7.2,-13.5]},{i:[12.33,-11.76],o:[9.84,-7.44]},{i:[5.76,-11.01],o:[1.44,-8.52]},{i:[2.5,-3.2],o:[-2.5,-3.2]},{i:[-1.44,-8.52],o:[-5.76,-11.01]},{i:[-9.84,-7.44],o:[-12.33,-11.76]},{i:[-7.2,-13.5],o:[-7.2,-18.5]},{i:[-12.33,-20.24],o:[-9.84,-24.56]},{i:[-5.76,-20.99],o:[-1.44,-23.48]}],
      x:-11.09,y:-28.8,w:22.18,h:25.6,
      thread:'#d9897e',stitch:'fill',fillMethod:'rows',blendPalette:['#d9897e','#e5b089','#d3ad61'],blendAngle:-100,border:true,borderThread:'#b5614f'},
    // Spiral-stitched center with its own ring border, so the eye lands on a round swirl rather than a flat dot.
    {id:'center',name:'Flower center',kind:'ellipse',x:-4.2,y:-20.2,w:8.4,h:8.4,thread:'#d3ad61',stitch:'fill',fillMethod:'spiral',underlayType:'center',border:true,borderThread:'#9c7a3a'},
    // Curved satin stem tapering from a wider base to a fine tip at the blossom: real tapered rails, not a thin running line.
    {id:'stem',name:'Stem',kind:'path',closed:false,smooth:false,
      points:[[2,24],[-3,10],[1,-3]],
      handles:[{i:[3.67,28.67],o:[0.33,19.33]},{i:[-2.67,19],o:[-3.33,1]},{i:[-0.33,1.33],o:[2.33,-7.33]}],
      x:-3,y:-3,w:5,h:27,
      thread:'#89a377',stitch:'satin',satinWidth:2.4,satinWidthEnd:.8,cap:'round'},
    // Pointed lanceolate leaf (Bézier again, not an ellipse) with a contour fill that reads as natural venation, plus a border.
    {id:'leaf',name:'Leaf',kind:'path',closed:true,smooth:true,
      points:[[-7,5],[-10.6,-6.45],[-27.35,-7.72],[-21.45,1.86]],
      handles:[{i:[-9.44,3.47],o:[-4.56,6.53]},{i:[-3.88,-2.25],o:[-17.32,-10.65]},{i:[-24.5,-5.94],o:[-30.2,-9.5]},{i:[-28.17,-2.34],o:[-14.73,6.06]}],
      x:-27.35,y:-7.72,w:20.35,h:12.72,
      thread:'#527461',stitch:'fill',fillMethod:'contour',border:true,borderThread:'#38503f'},
    // Cursive wordmark in a bundled script font (filled, not a mono running line), so the lettering reads as sewn calligraphy.
    {id:'letters',name:'Lettering',kind:'text',text:'Bloom',x:-13.45,y:33,w:26.9,h:11,thread:'#527461',stitch:'fill',fillMethod:'rows',font:'ttf/greatvibes'}
  ]};
}
// Batch plan: how many copies of the whole design fit in one hoop, with a gap between copies, and how many hoops N copies need.
export function batchPlan(doc,{copies=1,gap=3}={}){if(!doc.objects.length)return null;const boxes=doc.objects.map(objectBounds),x0=Math.min(...boxes.map(b=>b[0])),y0=Math.min(...boxes.map(b=>b[1])),x1=Math.max(...boxes.map(b=>b[2])),y1=Math.max(...boxes.map(b=>b[3])),hoopW=doc.hoop,hoopH=doc.hoopH??doc.hoop,cols=Math.floor((hoopW+gap)/(x1-x0+gap)),rows=Math.floor((hoopH+gap)/(y1-y0+gap)),perHoop=Math.max(0,cols*rows);return {design:[x1-x0,y1-y0],origin:[x0,y0],hoop:[hoopW,hoopH],cols,rows,perHoop,copies,hoopsNeeded:perHoop?Math.ceil(copies/perHoop):null,gap};}
// One document per hoop: copies laid out in the batch grid, centred on the hoop.
export function batchDocuments(doc,{copies=1,gap=3}={}){const p=batchPlan(doc,{copies,gap});if(!p||!p.perHoop)return [];if(doc.objects.some(o=>o.kind==='stitch_layer'))throw Error('Batch export does not support imported machine files.');const [dw,dh]=p.design,cw=dw+gap,ch=dh+gap,gridW=p.cols*cw-gap,gridH=Math.ceil(p.perHoop/p.cols)*ch-gap,docs=[];for(let start=0;start<copies;start+=p.perHoop){const n=Math.min(p.perHoop,copies-start),d={...structuredClone(doc),objects:[]};for(let k=0;k<n;k++){const col=k%p.cols,row=Math.floor(k/p.cols),dx=-gridW/2+col*cw-p.origin[0],dy=-gridH/2+row*ch-p.origin[1],tag=`${start+k+1}`;for(const o of doc.objects){const c=structuredClone(o);c.id=`${o.id}-${tag}`;if(c.clipId)c.clipId=`${c.clipId}-${tag}`;c.x+=dx;c.y+=dy;const sh=([x,y])=>[x+dx,y+dy];if(c.points)c.points=c.points.map(sh);if(c.handles)c.handles=c.handles.map(h=>h?{i:sh(h.i),o:sh(h.o)}:null);if(c.holes)c.holes=c.holes.map(hl=>hl.map(sh));d.objects.push(c);}}validateDocument(d);docs.push(d);}return docs;}
export function makeStitchLayer(decoded,format,{id=crypto.randomUUID(),name='Imported embroidery',fileName='design',originalBytesBase64=null,sha256=null,size=0}={}){
  if(!['jef','vp3','dst'].includes(format)||!Array.isArray(decoded?.stitches)||!Array.isArray(decoded?.threads)||!Array.isArray(decoded?.bounds))throw Error('Invalid decoded embroidery source.');
  const [x0,y0,x1,y1]=decoded.bounds,w=Math.max(.1,x1-x0),h=Math.max(.1,y1-y0);
  if(decoded.stitches.length>250000)throw Error('This design exceeds the 250,000 stitch import limit.');
  const first=decoded.threads.find(t=>/^#[0-9a-f]{6}$/i.test(t.color||'')),defaultThread=first?.color||'#527461';
  const placement={x:-w/2,y:-h/2,w,h};
  return {id,name,kind:'stitch_layer',...placement,rotation:0,thread:defaultThread,stitch:'run',threads:structuredClone(decoded.threads),stitches:structuredClone(decoded.stitches),threadOverrides:{},source:{format,fileName:String(fileName).slice(0,240),size,sha256,bounds:[...decoded.bounds],coordinateMapping:'source_mm_centered_on_editor_origin',defaultPlacement:placement,defaultThread,warnings:[...(decoded.warnings||[])],originalBytesBase64}};
}
export function importStitchLayer(bytes,format,metadata={}){
  const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(input.byteLength>1_048_576)throw Error('Integrated machine-file import is limited to 1 MiB so source bytes can be preserved in the .welcome project.');
  const decoded=decodeEmbroidery(input,format),b64=typeof Buffer!=='undefined'?Buffer.from(input).toString('base64'):btoa(String.fromCharCode(...input));
  return makeStitchLayer(decoded,format,{...metadata,size:input.byteLength,originalBytesBase64:b64});
}
export function measureText(text,font='welcom-mono/1',size=8,options={}){if(isRegistryFont(font)){const f=getFont(font);if(f)return layoutText({...options,text,font,h:size,w:0,x:0,y:0},f,{buffer:null}).width;return String(text).length*size*.6;}if(font==='neon-blinking/1')return [...String(text).toUpperCase()].reduce((n,ch)=>n+(neonFont.glyphs[ch]?.advance||neonFont.glyphs[' '].advance)*size/neonFont.unitsPerEm,0);return String(text).length*size*.72;}
export function applyOperations(doc,operations) {
  if(!doc||doc.schema!=='welcom/1'||!Array.isArray(doc.objects)||!Array.isArray(operations))throw Error('Invalid Welcome document operation.');
  for(const op of operations){
    if(op.op==='add_shape')doc.objects.push({id:op.id||crypto.randomUUID(),name:op.name|| (op.kind==='ellipse'?'Ellipse':'Rectangle'),kind:op.kind,x:op.x,y:op.y,w:op.width,h:op.height,thread:op.thread||'#527461',stitch:op.stitch||'fill',...(op.radius>0&&op.kind==='rect'?{radius:op.radius}:{})});
    else if(op.op==='add_path')doc.objects.push({id:op.id||crypto.randomUUID(),name:op.name||'Path',kind:'path',x:op.x,y:op.y,w:op.width||0,h:op.height||0,points:structuredClone(op.points),thread:op.thread||'#527461',stitch:op.stitch==='satin'?'satin':op.closed?(op.stitch||'run'):'run',...(op.satinWidth!==undefined?{satinWidth:op.satinWidth}:{}),...(op.closed?{closed:true}:{}),...(op.smooth?{smooth:true}:{}),...(op.border?{border:true}:{}),...(op.handles?{handles:structuredClone(op.handles)}:{})}),refreshPathBounds(doc.objects.at(-1));
    else if(op.op==='add_text'){const rf=isRegistryFont(op.font)?getFont(op.font):null,h=op.height??(rf?rf.size:8),opts=Object.fromEntries([...TEXT_OPTION_KEYS,'stitchLength','stagger','underlayType','underlayInset','underlaySpacing','angle','spacing'].filter(k=>op[k]!==undefined).map(k=>[k,op[k]]));doc.objects.push({id:op.id||crypto.randomUUID(),name:`Lettering: ${String(op.text).split('\n')[0]}`,kind:'text',text:op.text,x:op.x,y:op.y,w:op.width||measureText(op.text,op.font||'welcom-mono/1',h,opts),h,thread:op.thread||'#527461',stitch:op.stitch||(rf?.kind==='outline'?'fill':'run'),font:op.font||'welcom-mono/1',...opts});}
    else if(op.op==='clear'){doc.objects=[];}
    else if(op.op==='restore'){if(!Array.isArray(op.objects))throw Error('restore needs the objects to bring back.');doc.objects=structuredClone(op.objects);if(op.settings)doc.settings=structuredClone(op.settings);if(op.name)doc.name=op.name;if(op.hoop)doc.hoop=op.hoop;if(op.hoopH===undefined)delete doc.hoopH;else doc.hoopH=op.hoopH;if(op.guides)doc.guides=structuredClone(op.guides);else delete doc.guides;}
    else if(op.op==='set_reference'){const r=doc.reference?{...doc.reference}:{};for(const k of ['data','x','y','w','h','opacity','visible','locked','name'])if(op[k]!==undefined)r[k]=op[k];if(!r.data)throw Error('A reference image needs its picture data.');doc.reference=r;}
    else if(op.op==='clear_reference'){delete doc.reference;}
    else if(op.op==='set_settings'){for(const k of ['spacing','angle','underlay','compensation','ties','trims','stitchLength','stagger','underlayType'])if(op[k]!==undefined)doc.settings[k]=op[k];}
    else if(op.op==='rename_document')doc.name=op.name;
    else if(op.op==='set_object'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);for(const k of ['stitch','thread','name','text','font','border','borderThread','satinWidth','angle','spacing','visible','locked','stitchLength','stagger','underlayType','underlayInset','underlaySpacing','startAt','endAt','fillMethod','guide','radius','satinWidthEnd','raised','buttonhole','motifPair','motifSpacing','motifSize','motifShape','blingShape','edgeClose','borderWidth','join','cap','widthStops','blendThread','blendPalette','blendStart','blendEnd','blendAngle','rippleCenter','photo','compensation','underpath','runStyle','lengthVariance','crossSize','applique','appliqueWidth',...TEXT_OPTION_KEYS])if(op[k]!==undefined){if(op[k]===null)delete o[k];else o[k]=op[k];}
      if(o.kind==='text'&&(['text','font',...TEXT_OPTION_KEYS].some(k=>op[k]!==undefined))){const f=isRegistryFont(o.font)?getFont(o.font):null;if(f&&op.font!==undefined&&op.h===undefined&&!(o.h>=f.size*f.minScale&&o.h<=f.size*f.maxScale))o.h=f.size;o.w=measureText(o.text,o.font||'welcom-mono/1',o.h,o);if(op.text!==undefined&&typeof op.text==='string')o.name=`Lettering: ${op.text.split('\n')[0]}`;}if(o.kind==='stitch_layer'&&op.thread!==undefined)o.threadOverrides=Object.fromEntries(o.threads.map((_,i)=>[i,op.thread]));}
    else if(op.op==='set_path_point'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);{const old=o.points[op.index],dx=op.x-old[0],dy=op.y-old[1],h=o.handles?.[op.index];o.points[op.index]=[op.x,op.y];if(h){h.i=[h.i[0]+dx,h.i[1]+dy];h.o=[h.o[0]+dx,h.o[1]+dy];}}refreshPathBounds(o);}
    else if(op.op==='transform'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);const oldX=o.x,oldY=o.y,oldW=o.w||0,oldH=o.h||0,nx=op.x??oldX,ny=op.y??oldY,nw=op.width??oldW,nh=op.height??oldH;if(o.along)o.along.points=o.along.points.map(([x,y])=>[x+nx-oldX,y+ny-oldY]);if(o.kind==='path')mapPathPoints(o,([x,y])=>[nx+(oldW?(x-oldX)*nw/oldW:x-oldX),ny+(oldH?(y-oldY)*nh/oldH:y-oldY)]);o.x=nx;o.y=ny;o.w=nw;o.h=nh;if(op.rotation!==undefined)o.rotation=op.rotation;}
    else if(op.op==='continue_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Array.isArray(op.points)||op.points.length<2)throw Error(`Cannot continue path ${op.id}.`);if(op.points.length>1000)throw Error('A path is limited to 1,000 points.');o.points=structuredClone(op.points);if(op.handles)o.handles=structuredClone(op.handles);else delete o.handles;o.closed=Boolean(op.closed)&&o.points.length>=3;if(op.stitch)o.stitch=op.stitch;refreshPathBounds(o);}
    else if(op.op==='insert_path_point'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||op.index<1||op.index>o.points.length)throw Error(`Cannot insert path point at ${op.id}[${op.index}].`);if(o.points.length>=1000)throw Error('A path is limited to 1,000 points.');o.points.splice(op.index,0,[op.x,op.y]);if(o.handles)o.handles.splice(op.index,0,null);refreshPathBounds(o);}
    else if(op.op==='delete_path_point'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);if(o.points.length<=2)throw Error('A path needs at least two points.');o.points.splice(op.index,1);if(o.handles){o.handles.splice(op.index,1);if(!o.handles.some(Boolean))delete o.handles;}if(o.closed&&o.points.length<3)o.closed=false;refreshPathBounds(o);}
    else if(op.op==='set_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);if(op.closed!==undefined){if(op.closed&&o.points.length<3)throw Error('Closing a path needs at least three points.');o.closed=op.closed;if(!op.closed&&o.stitch==='fill')o.stitch='run';}if(op.smooth!==undefined)o.smooth=op.smooth;}
    else if(op.op==='add_hole'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!o.closed)throw Error(`Holes need a closed path: ${op.id}`);if(!Array.isArray(op.points)||op.points.length<3||op.points.length>200)throw Error('A hole needs 3–200 points.');(o.holes||=[]).push(structuredClone(op.points));}
    else if(op.op==='clear_holes'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);delete o.holes;}
    else if(op.op==='text_on_path'){const t=doc.objects.find(v=>v.id===op.textId),p=doc.objects.find(v=>v.id===op.pathId);if(!t||t.kind!=='text')throw Error(`Unknown lettering object: ${op.textId}`);if(!p||p.kind!=='path')throw Error(`Lettering follows a path object: ${op.pathId}`);
      const pts=alongPoints(p);delete t.rotation;t.along={points:pts,closed:Boolean(p.closed),offset:Number(op.offset)||0,pathId:p.id,sig:pathSig(p)};}
    else if(op.op==='set_along_offset'){const t=doc.objects.find(v=>v.id===op.textId);if(!t?.along)throw Error(`Lettering ${op.textId} is not attached to a path.`);t.along.offset=Number(op.offset);}
    else if(op.op==='set_width_at_node'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||o.stitch!=='satin')throw Error(`Node widths need a satin path: ${op.id}`);if(!Number.isInteger(op.index)||op.index<0||op.index>=o.points.length)throw Error(`Unknown node ${op.index} on ${op.id}.`);
      const t=nodeFraction(o,op.index);let stops=o.widthStops?structuredClone(o.widthStops):[[0,Math.max(.5,Number(o.satinWidth)||3)],[1,Math.max(.5,Number(o.satinWidthEnd)||Number(o.satinWidth)||3)]];
      stops=stops.filter(st=>Math.abs(st[0]-t)>.015);if(op.width!==null&&op.width!==undefined){if(!(op.width>=.5&&op.width<=12))throw Error('Width must be 0.5–12 mm.');stops.push([+t.toFixed(4),op.width]);}
      stops.sort((x,y)=>x[0]-y[0]);if(stops.length)o.widthStops=stops;else delete o.widthStops;if(stops.length>50)throw Error('A width profile is limited to 50 stops.');}
    else if(op.op==='clip'){const m=doc.objects.find(v=>v.id===op.maskId);if(!m||!isClosedShape(m))throw Error(`A clipping mask must be a rectangle, ellipse or closed path: ${op.maskId}`);if(!Array.isArray(op.ids)||!op.ids.length||op.ids.includes(op.maskId))throw Error('Choose the objects to clip, not including the mask itself.');
      if(m.clipId&&op.ids.includes(m.clipId))throw Error('A mask cannot be clipped by the objects it clips.');for(const id of op.ids){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);if(o.mask)throw Error('A mask cannot itself be clipped to another mask in the same step; release it first.');o.clipId=op.maskId;}m.mask=true;}
    else if(op.op==='release_clip'){for(const id of op.ids||[]){const o=doc.objects.find(v=>v.id===id);if(o)delete o.clipId;}}
    else if(op.op==='round_corners'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Round corners needs a path: ${op.id}`);if(!(Number.isFinite(op.radius)&&op.radius>0&&op.radius<=200))throw Error('Corner radius must be between 0 and 200 mm.');if(o.smooth)throw Error('Turn off Smooth curve before rounding corners.');roundPathCorners(o,op.radius,op.indexes);}
    else if(op.op==='text_off_path'){const t=doc.objects.find(v=>v.id===op.textId);if(!t||t.kind!=='text')throw Error(`Unknown lettering object: ${op.textId}`);delete t.along;}
    else if(op.op==='move_path_points'){const o=objById(doc,op.id);if(o.kind!=='path'||!Array.isArray(op.indexes)||!op.indexes.length)throw Error('move_path_points needs a path and a list of node indexes.');const dx=Number(op.dx),dy=Number(op.dy);if(![dx,dy].every(Number.isFinite))throw Error('Move needs numeric dx and dy.');for(const i of new Set(op.indexes)){if(!Number.isInteger(i)||!o.points[i])throw Error(`Unknown path point: ${op.id}[${i}].`);o.points[i]=[o.points[i][0]+dx,o.points[i][1]+dy];const h=o.handles?.[i];if(h){h.i=[h.i[0]+dx,h.i[1]+dy];h.o=[h.o[0]+dx,h.o[1]+dy];}}refreshPathBounds(o);}
    else if(op.op==='delete_path_points'){const o=objById(doc,op.id);if(o.kind!=='path'||!Array.isArray(op.indexes)||!op.indexes.length)throw Error('delete_path_points needs a path and a list of node indexes.');const idx=[...new Set(op.indexes)].sort((a,b)=>b-a);if(idx.some(i=>!Number.isInteger(i)||!o.points[i]))throw Error('Unknown path point in delete_path_points.');if(o.points.length-idx.length<(o.closed?3:2))throw Error(o.closed?'A closed path needs at least three nodes.':'A path needs at least two nodes.');for(const i of idx){o.points.splice(i,1);if(o.handles)o.handles.splice(i,1);}if(o.handles&&!o.handles.some(Boolean))delete o.handles;refreshPathBounds(o);}
    else if(op.op==='add_guide'){if(!['x','y'].includes(op.axis)||!Number.isFinite(op.pos)||Math.abs(op.pos)>1000)throw Error('A guide needs an axis (x or y) and a position within ±1000 mm.');(doc.guides||=[]);if(doc.guides.length>=40)throw Error('At most 40 guides.');doc.guides.push({axis:op.axis,pos:+op.pos.toFixed(3)});}
    else if(op.op==='move_guide'){const g=doc.guides?.[op.index];if(!g||!Number.isFinite(op.pos)||Math.abs(op.pos)>1000)throw Error('Unknown guide or invalid position.');g.pos=+op.pos.toFixed(3);}
    else if(op.op==='remove_guide'){if(!doc.guides?.[op.index])throw Error('Unknown guide.');doc.guides.splice(op.index,1);if(!doc.guides.length)delete doc.guides;}
    else if(op.op==='clear_guides'){delete doc.guides;}
    else if(op.op==='scale')scaleObjects(doc,op.ids,Number(op.sx),Number(op.sy),Number(op.ox),Number(op.oy));
    else if(op.op==='rotate')rotateObjects(doc,op.ids,Number(op.angle),Number(op.cx),Number(op.cy));
    else if(op.op==='flip')flipObjects(doc,op.ids,op.axis,op.pivot);
    else if(op.op==='translate'){const dx=Number(op.dx),dy=Number(op.dy);if(![dx,dy].every(Number.isFinite))throw Error('Translate needs numeric dx and dy.');for(const id of op.ids)translateObject(objById(doc,id),dx,dy);}
    else if(op.op==='to_path'){for(const id of op.ids)toPathObject(doc,id);}
    else if(op.op==='offset')offsetShape(doc,op.id,op.distance);
    else if(op.op==='stroke_to_shape')strokeToShape(doc,op.id,op.width);
    else if(op.op==='array')arrayCopies(doc,op);
    else if(op.op==='reverse_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);o.points.reverse();if(o.handles){o.handles.reverse();o.handles=o.handles.map(h=>h&&{i:h.o,o:h.i});}}
    else if(op.op==='simplify_path')simplifyPath(doc.objects.find(v=>v.id===op.id),op.tolerance??.2);
    else if(op.op==='split_path')splitPath(doc,op.id,op.index);
    else if(op.op==='join_paths')joinPaths(doc,op.ids,op.close===true);
    else if(op.op==='reorder')reorderObject(doc,op.id,op.to,op.index);
    else if(op.op==='sort_by_color')sortByColor(doc);
    else if(op.op==='boolean')booleanShapes(doc,op.mode,op.ids);
    else if(op.op==='subtract')booleanShapes(doc,'subtract',[op.targetId,op.cutterId]);
    else if(op.op==='set_path_node_type'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);const n=o.points.length;if(!o.handles)o.handles=Array(n).fill(null);
      if(op.type==='corner')o.handles[op.index]=null;else if(op.type==='smooth'){const prev=o.points[(op.index-1+n)%n],next=o.points[(op.index+1)%n],p=o.points[op.index],hasPrev=o.closed||op.index>0,hasNext=o.closed||op.index<n-1,a=hasPrev?prev:p,b=hasNext?next:p;let tx=b[0]-a[0],ty=b[1]-a[1];const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;const dp=hasPrev?Math.hypot(p[0]-prev[0],p[1]-prev[1]):0,dn=hasNext?Math.hypot(next[0]-p[0],next[1]-p[1]):0;o.handles[op.index]={i:[p[0]-tx*dp/3,p[1]-ty*dp/3],o:[p[0]+tx*dn/3,p[1]+ty*dn/3]};}else throw Error(`Unknown node type: ${op.type}`);
      if(!o.handles.some(Boolean))delete o.handles;}
    else if(op.op==='set_path_handle'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!o.handles?.[op.index])throw Error(`Path point ${op.id}[${op.index}] has no handles; make it a smooth node first.`);const h=o.handles[op.index],p=o.points[op.index],key=op.which==='in'?'i':op.which==='out'?'o':null;if(!key)throw Error(`Unknown handle: ${op.which}`);h[key]=[op.x,op.y];if(op.mirror!==false){const other=key==='i'?'o':'i';h[other]=[2*p[0]-op.x,2*p[1]-op.y];}}
    else if(op.op==='group'){if(!Array.isArray(op.ids)||op.ids.length<2)throw Error('Group needs at least two objects.');const gid=op.groupId||crypto.randomUUID();for(const id of op.ids){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);o.groupId=gid;}}
    else if(op.op==='ungroup'){const gids=new Set(op.ids.map(id=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o.groupId;}).filter(Boolean));for(const o of doc.objects)if(gids.has(o.groupId))delete o.groupId;}
    else if(op.op==='set_hoop'){const w=Number(op.width),h=Number(op.height??op.width);if(![w,h].every(v=>Number.isFinite(v)&&v>=10&&v<=400))throw Error('Hoop width and height must be between 10 and 400 mm.');doc.hoop=Math.round(w*10)/10;if(Math.round(h*10)/10===doc.hoop)delete doc.hoopH;else doc.hoopH=Math.round(h*10)/10;}
    else if(op.op==='align'){const objs=op.ids.map(id=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o;}),boxes=objs.map(objectBounds);if(op.to==='hoop'&&objs.length<1||op.to!=='hoop'&&objs.length<2)throw Error('Align needs at least two objects, or one object aligned to the hoop.');const hs=hoopSize(doc),hx=hs.w/2,hy=hs.h/2,ref=op.to==='hoop'?[-hx,-hy,hx,hy]:[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
      objs.forEach((o,i)=>{const b=boxes[i];let dx=0,dy=0;if(op.edge==='left')dx=ref[0]-b[0];else if(op.edge==='right')dx=ref[2]-b[2];else if(op.edge==='hcenter')dx=(ref[0]+ref[2])/2-(b[0]+b[2])/2;else if(op.edge==='top')dy=ref[1]-b[1];else if(op.edge==='bottom')dy=ref[3]-b[3];else if(op.edge==='vcenter')dy=(ref[1]+ref[3])/2-(b[1]+b[3])/2;else throw Error(`Unknown align edge: ${op.edge}`);translateObject(o,dx,dy);});}
    else if(op.op==='distribute'){const objs=op.ids.map(id=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o;});if(objs.length<3)throw Error('Distribute needs at least three objects.');const ax=op.axis==='vertical'?1:0;if(op.axis!=='horizontal'&&op.axis!=='vertical')throw Error(`Unknown distribute axis: ${op.axis}`);const items=objs.map(o=>({o,b:objectBounds(o)})).sort((a,b)=>(a.b[ax]+a.b[ax+2])-(b.b[ax]+b.b[ax+2])),first=items[0].b,last=items.at(-1).b,total=items.reduce((n,i)=>n+i.b[ax+2]-i.b[ax],0),gap=((last[ax+2]-first[ax])-total)/(items.length-1);let cursor=first[ax+2]+gap;for(const item of items.slice(1,-1)){const d=cursor-item.b[ax];translateObject(item.o,ax?0:d,ax?d:0);cursor+=item.b[ax+2]-item.b[ax]+gap;}}
    else if(op.op==='delete'){const i=doc.objects.findIndex(v=>v.id===op.id);if(i<0)throw Error(`Unknown object: ${op.id}`);doc.objects.splice(i,1);}
    else if(op.op==='duplicate'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);const copy=structuredClone(o);delete copy.groupId;copy.id=op.newId||crypto.randomUUID();if(copy.along)copy.along.points=copy.along.points.map(([x,y])=>[x+(op.dx??3),y+(op.dy??3)]);copy.name=op.name||`${o.name} copy`;copy.x+=op.dx??3;copy.y+=op.dy??3;if(copy.kind==='path')mapPathPoints(copy,([x,y])=>[x+(op.dx??3),y+(op.dy??3)]);doc.objects.push(copy);}
    else throw Error(`Unsupported operation: ${op.op}`);
  }
  refreshAlong(doc);refreshClips(doc);
  return doc;
}
// Replace each straight corner node by two nodes joined with a circular arc (cubic approximation) of the given radius; limited to half of each neighbouring segment.
function roundPathCorners(o,radius,only=null){
  const n=o.points.length,pts=o.points.map(p=>[Number(p[0]),Number(p[1])]),hs=o.handles?o.handles.map(h=>h||null):pts.map(()=>null),outP=[],outH=[];let changed=0;
  const straightOut=i=>!hs[i]||!hs[i].o||(Math.abs(hs[i].o[0]-pts[i][0])<1e-9&&Math.abs(hs[i].o[1]-pts[i][1])<1e-9),straightIn=i=>!hs[i]||!hs[i].i||(Math.abs(hs[i].i[0]-pts[i][0])<1e-9&&Math.abs(hs[i].i[1]-pts[i][1])<1e-9);
  for(let i=0;i<n;i++){
    const inner=o.closed||(i>0&&i<n-1),pi=(i+n-1)%n,ni=(i+1)%n;
    if(!inner||(only&&!only.includes(i))||!straightIn(i)||!straightOut(i)||!straightOut(pi)||!straightIn(ni)){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const P=pts[i],A=pts[pi],B=pts[ni],l1=Math.hypot(A[0]-P[0],A[1]-P[1]),l2=Math.hypot(B[0]-P[0],B[1]-P[1]);if(l1<1e-6||l2<1e-6){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const u=[(A[0]-P[0])/l1,(A[1]-P[1])/l1],v=[(B[0]-P[0])/l2,(B[1]-P[1])/l2],cos=Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1])),th=Math.acos(cos);
    if(th<.06||th>Math.PI-.06){outP.push(o.points[i]);outH.push(hs[i]);continue;}
    const d=Math.min(radius/Math.tan(th/2),l1/2,l2/2),r=d*Math.tan(th/2),h=4/3*Math.tan((Math.PI-th)/4)*r,t1=[P[0]+u[0]*d,P[1]+u[1]*d],t2=[P[0]+v[0]*d,P[1]+v[1]*d],q=x=>+x.toFixed(3);
    outP.push([q(t1[0]),q(t1[1])],[q(t2[0]),q(t2[1])]);
    outH.push({i:[q(t1[0]),q(t1[1])],o:[q(t1[0]-u[0]*h),q(t1[1]-u[1]*h)]},{i:[q(t2[0]-v[0]*h),q(t2[1]-v[1]*h)],o:[q(t2[0]),q(t2[1])]});changed++;}
  if(!changed)throw Error('No straight corner nodes to round. Select a path with corners, or select the corner nodes.');
  if(outP.length>1000)throw Error('A path is limited to 1,000 points.');
  o.points=outP;o.handles=outH;refreshPathBounds(o);
}
// Position of a path node as a fraction (0..1) of the path's length.
export function nodeFraction(o,index){const line=pathOutline(o),P=o.points[index],cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+distP(line[i],line[i-1]));const total=cum.at(-1)||1;let best=Infinity,at=0;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,u=l2?Math.max(0,Math.min(1,((P[0]-a[0])*dx+(P[1]-a[1])*dy)/l2)):0,d=Math.hypot(P[0]-a[0]-dx*u,P[1]-a[1]-dy*u);if(d<best-1e-9){best=d;at=cum[i-1]+Math.sqrt(l2)*u;}}return at/total;}
function decodeBase64(s){if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(s,'base64'));const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
// Geometry clipping to a mask: closed outlines are intersected exactly; runs of stitches are cut where they leave the mask.
const closeRing=r=>{const q=r.map(([x,y])=>[x,y]);if(q.length&&(q[0][0]!==q.at(-1)[0]||q[0][1]!==q.at(-1)[1]))q.push([...q[0]]);return q;};
function clipLines(lines,maskLines){const poly=ls=>ls.filter(l=>l.length>=3).map(closeRing),a=poly(lines),b=poly(maskLines);if(!a.length||!b.length)return [];
  try{return polygonClipping.intersection(a,b).flatMap(pg=>pg.map(r=>r.map(([x,y])=>[x,y])));}catch{return [];}}
function insideRings(rings,p){let inside=false;for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
// edgeClose: each cut end gets a short back-stitch over its last segment, so a cut run closes on the mask edge.
function clipRuns(runs,rings,edgeClose=false){
  const edges=[];for(const r of rings)for(let i=1;i<r.length;i++)edges.push([r[i-1],r[i]]);const out=[];
  for(const run of runs){let cur=null,first=true;const flush=()=>{if(cur&&cur.length>1){const pts=edgeClose&&cur.length>2?[...cur,...cur.slice(-3,-1).reverse()]:cur;out.push({...run,pts,jump:first?run.jump:true});}first=false;cur=null;};
    const pts=run.pts;if(pts.length<2)continue;
    if(insideRings(rings,pts[0])){cur=[pts[0]];}
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],ts=[0,1],dx=b[0]-a[0],dy=b[1]-a[1];
      for(const [c,d] of edges){const ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;if(t>1e-9&&t<1-1e-9&&u>=0&&u<=1)ts.push(t);}
      ts.sort((x,y)=>x-y);
      for(let k=1;k<ts.length;k++){const t0=ts[k-1],t1=ts[k];if(t1-t0<1e-9)continue;const p0=[a[0]+dx*t0,a[1]+dy*t0],p1=[a[0]+dx*t1,a[1]+dy*t1],mid=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2];
        if(insideRings(rings,mid)){if(!cur)cur=[p0];cur.push(p1);}else flush();}}
    flush();}
  return out;}
// Clipping masks: a clipped object is sewn only inside its mask (a closed shape that is itself not sewn). Dangling links are cleaned up after every edit.
const isClosedShape=o=>o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed);
function refreshClips(doc){const ids=new Set(doc.objects.map(o=>o.id));for(const o of doc.objects)if(o.clipId&&(!ids.has(o.clipId)||o.clipId===o.id||!isClosedShape(doc.objects.find(v=>v.id===o.clipId))))delete o.clipId;const used=new Set(doc.objects.map(o=>o.clipId).filter(Boolean));for(const o of doc.objects){if(o.mask&&!used.has(o.id))delete o.mask;else if(!o.mask&&used.has(o.id))o.mask=true;}}
// Lettering attached to a path keeps following it: the path's outline is re-read whenever the path changes (moving the lettering itself does not reattach it).
const pathSig=p=>JSON.stringify([p.points,p.handles,p.closed,p.smooth,p.rotation]);
function alongPoints(p){const raw=geometry(p,0)[0],pts=[];for(const q of raw)if(!pts.length||Math.hypot(q[0]-pts.at(-1)[0],q[1]-pts.at(-1)[1])>1e-6)pts.push([+q[0].toFixed(3),+q[1].toFixed(3)]);if(p.closed&&pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();if(pts.length<2||pts.length>1500)throw Error('The path needs 2–1,500 points after smoothing.');return pts;}
function refreshAlong(doc){for(const t of doc.objects){if(t.kind!=='text'||!t.along?.pathId)continue;const p=doc.objects.find(v=>v.id===t.along.pathId);if(!p||p.kind!=='path'){delete t.along.pathId;delete t.along.sig;continue;}const sig=pathSig(p);if(t.along.sig!==sig){try{t.along.points=alongPoints(p);t.along.closed=Boolean(p.closed);t.along.sig=sig;}catch{}}}}
function translateObject(o,dx,dy){o.x+=dx;o.y+=dy;if(o.along)o.along.points=o.along.points.map(([x,y])=>[x+dx,y+dy]);if(o.kind==='path')mapPathPoints(o,([x,y])=>[x+dx,y+dy]);}
// Edge travel for fills: when two points lie on the same outline (outer edge or hole edge), walk the shorter way round it
// with running stitches instead of jumping, but only for short detours (≤ 10 mm); long ones stay jumps because edge stitches would clutter the fill. The route follows the border, where later rows or the border pass cover it.
function locateOnRing(ring,p,eps=.05){let arc=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy,len=Math.sqrt(len2);if(len2>0){const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2));if(Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)<=eps)return arc+len*t;}arc+=len;}return null;}
function ringRoute(rings,p,q,maxLength=10){for(const ring of rings){const s1=locateOnRing(ring,p),s2=locateOnRing(ring,q);if(s1===null||s2===null)continue;
  const cum=[0];for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const L=cum.at(-1);if(L<=0)continue;
  const fwd=(s2-s1+L)%L,back=L-fwd,forward=fwd<=back,dist=Math.min(fwd,back);if(dist>maxLength)return null;
  const out=[];if(forward){for(let i=0;i<ring.length-1;i++){const pos=(cum[i]-s1+L)%L;if(pos>1e-6&&pos<fwd-1e-6)out.push({pos,pt:ring[i]});}}else{for(let i=ring.length-2;i>=0;i--){const pos=(s1-cum[i]+L)%L;if(pos>1e-6&&pos<back-1e-6)out.push({pos,pt:ring[i]});}}
  out.sort((a,b)=>a.pos-b.pos);return [...out.map(o=>o.pt),q];}return null;}
// Boolean shape operations on closed shapes (rectangle, ellipse, closed path, with holes) using polygon-clipping.
// The result replaces the operands: the first result polygon keeps the first operand's id, further pieces get new ids.
function booleanShapes(doc,mode,ids){
  if(!['union','intersect','subtract','xor'].includes(mode))throw Error(`Unknown boolean mode: ${mode}`);if(!Array.isArray(ids)||ids.length<2||new Set(ids).size!==ids.length)throw Error('A boolean operation needs at least two different objects.');
  const objs=ids.map(id=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);if(o.kind==='text'||o.kind==='stitch_layer'||(o.kind==='path'&&!o.closed))throw Error('Boolean operations work on closed shapes: rectangle, ellipse or closed path.');return o;});
  const ring=r=>{const pts=r.map(([x,y])=>[x,y]);if(pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();return pts;};
  const polys=objs.map(o=>geometry(o,0).map(ring)),[first,...rest]=polys;
  const result=(mode==='union'?polygonClipping.union:mode==='intersect'?polygonClipping.intersection:mode==='xor'?polygonClipping.xor:polygonClipping.difference)(first,...rest);
  if(!result.length)throw Error(mode==='intersect'?'The shapes do not overlap, so the intersection is empty.':'The result is empty.');
  replaceWithPolygons(doc,objs[0],objs,result);
}
// Replace `objs` by the polygons of a polygon-clipping result; the first piece keeps the base object's id, others get new ids.
function replaceWithPolygons(doc,base,objs,result){
  const round=r=>r.slice(0,-1).map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]),made=[];
  result.forEach((poly,k)=>{const [outer,...holes]=poly.map(round);if(outer.length<3||outer.length>1000||holes.length>20||holes.some(h=>h.length<3||h.length>200))throw Error('The result is too complex (outer ring up to 1,000 points, up to 20 holes of up to 200 points). Simplify the shapes first.');
    const o=k===0?base:{id:crypto.randomUUID(),name:`${base.name||'Shape'} ${k+1}`,thread:base.thread,stitch:base.stitch,...(base.border?{border:true,borderThread:base.borderThread}:{})};
    for(const key of ['rotation','smooth','handles','holes','satinWidth','text','font','along'])delete o[key];Object.assign(o,{kind:'path',points:outer,closed:true,stitch:base.stitch==='run'?'run':'fill',w:0,h:0,x:0,y:0});if(holes.length)o.holes=holes;refreshPathBounds(o);made.push(o);});
  doc.objects=doc.objects.filter(o=>!objs.includes(o)||o===base);const baseAt=doc.objects.indexOf(base);doc.objects.splice(baseAt+1,0,...made.slice(1));
}
// Lettering on a path: glyph points are resampled to <= 0.8 mm, then mapped so that distance along the text becomes arc length
// along the path (starting at `offset` mm) and height above the baseline becomes the path's upward normal. The path is a
// snapshot (obj.along) copied by `text_on_path`, so later edits to the path do not move the lettering until it is attached again.
function mapAlongPoint(obj){
  const pts=obj.along.points,closed=Boolean(obj.along.closed),ring=closed?[...pts,pts[0]]:pts,cum=[0];for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const total=cum.at(-1)||1;
  const at=sRaw=>{let sPos=closed?((sRaw%total)+total)%total:sRaw,i=1;if(sPos>=0)while(i<cum.length-1&&cum[i]<sPos)i++;const a=ring[i-1],b=ring[i],seg=cum[i]-cum[i-1]||1,f=(sPos-cum[i-1])/seg,tx=(b[0]-a[0])/seg,ty=(b[1]-a[1])/seg;return {p:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],t:[tx,ty]};};
  const offset=Number(obj.along.offset)||0;
  return ([X,Y])=>{const {p,t}=at(offset+(X-obj.x)),v=obj.y-Y;return [p[0]+t[1]*v,p[1]-t[0]*v];};
}
function mapAlongPath(lines,obj){
  const map=mapAlongPoint(obj),resample=line=>{const out=[line[0]];for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.8));for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;};
  return lines.map(line=>resample(line).map(map));
}

// ---- Inkscape-style path tools -------------------------------------------------------------------------------
// Offset and stroke-to-shape build a buffer as the union of "capsules" (a segment grown by a radius, round caps and joins).
function closedShapeOrThrow(doc,id){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);if(o.kind==='text'||o.kind==='stitch_layer'||(o.kind==='path'&&!o.closed))throw Error('This works on closed shapes: rectangle, ellipse or closed path.');return o;}
function offsetShape(doc,id,distance){const o=closedShapeOrThrow(doc,id),d=Number(distance);if(!Number.isFinite(d)||d===0||Math.abs(d)>50)throw Error('Offset distance must be a non-zero number of mm, at most 50 in either direction.');
  const rings=geometry(o,0).map(closedRing),poly=rings.map(r=>r.slice(0,-1)),grown=bufferSegments(rings,Math.abs(d));
  const result=d>0?polygonClipping.union(poly,...grown):polygonClipping.difference(poly,...grown);if(!result.length)throw Error('The inset removes the whole shape; use a smaller distance.');replaceWithPolygons(doc,o,[o],result);}
function strokeToShape(doc,id,width){const o=doc.objects.find(v=>v.id===id);if(!o||o.kind!=='path')throw Error(`Stroke to shape needs a path: ${id}`);const w=Number(width);if(!Number.isFinite(w)||w<=0||w>40)throw Error('Stroke width must be between 0 and 40 mm.');
  const ring=geometry(o,0)[0],grown=bufferSegments([ring],w/2);if(!grown.length)throw Error('The path has no length.');replaceWithPolygons(doc,Object.assign(o,{stitch:'fill'}),[o],grown);}
function objectCenter(o){const unrotated={...o};delete unrotated.rotation;const pts=geometry(unrotated).flat();if(o.kind==='stitch_layer'||!pts.length)return [o.x+o.w/2,o.y+o.h/2];const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];}
const normAngle=a=>{let r=((a%360)+360)%360;return r>180?r-360:r;};
function placeCopy(src,center,pivot,degrees,ids){const copy=structuredClone(src);delete copy.groupId;copy.id=ids.next();copy.name=`${src.name||'Object'} copy`;const c0=objectCenter(src),th=degrees*Math.PI/180;let target=center;if(pivot){const dx=c0[0]-pivot[0],dy=c0[1]-pivot[1];target=[pivot[0]+dx*Math.cos(th)-dy*Math.sin(th),pivot[1]+dx*Math.sin(th)+dy*Math.cos(th)];}
  translateObject(copy,target[0]-c0[0],target[1]-c0[1]);if(degrees)copy.rotation=normAngle((Number(src.rotation)||0)+degrees);return copy;}
function makeIds(op,n){const given=Array.isArray(op.ids)?op.ids:[];let i=0;return {next:()=>given[i++]||crypto.randomUUID()};}
function arrayCopies(doc,op){const src=doc.objects.find(v=>v.id===op.id);if(!src)throw Error(`Unknown object: ${op.id}`);const n=Math.round(Number(op.count));if(!Number.isInteger(n)||n<2||n>60)throw Error('An array needs 2–60 copies in total (including the original).');if(doc.objects.length+n-1>100)throw Error('The array would exceed the 100-object limit.');
  const ids=makeIds(op),made=[];
  if(op.mode==='linear'){const dx=Number(op.dx),dy=Number(op.dy);if(![dx,dy].every(Number.isFinite)||(!dx&&!dy))throw Error('A linear array needs a non-zero dx/dy step in mm.');const c0=objectCenter(src);for(let k=1;k<n;k++)made.push(placeCopy(src,[c0[0]+dx*k,c0[1]+dy*k],null,0,ids));}
  else if(op.mode==='radial'){const pivot=[Number(op.cx),Number(op.cy)],total=op.angle===undefined?360:Number(op.angle);if(![...pivot,total].every(Number.isFinite)||!total)throw Error('A radial array needs a centre (cx, cy) and a non-zero total angle.');const step=Math.abs(total)>=360?total/n:total/(n-1);for(let k=1;k<n;k++)made.push(placeCopy(src,null,pivot,step*k,ids));}
  else if(op.mode==='along'){const path=doc.objects.find(v=>v.id===op.pathId);if(!path||path.kind!=='path')throw Error(`The array path must be a path object: ${op.pathId}`);const ring=geometry(path,0)[0],cum=[0];for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const total=cum.at(-1);if(total<1e-6)throw Error('The path has no length.');
    const at=t=>{let i=1;while(i<cum.length-1&&cum[i]<t)i++;const seg=cum[i]-cum[i-1]||1,f=(t-cum[i-1])/seg,a=ring[i-1],b=ring[i];return {p:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],deg:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI};};const rotate=op.rotate!==false,steps=path.closed?n:n-1;
    for(let k=0;k<n;k++){const {p,deg}=at(Math.min(total,total*k/steps));if(k===0){const c0=objectCenter(src);translateObject(src,p[0]-c0[0],p[1]-c0[1]);if(rotate)src.rotation=normAngle(deg);}else made.push(placeCopy(Object.assign(structuredClone(src),{id:src.id,rotation:rotate?0:src.rotation}),p,null,0,ids));
      if(k>0&&rotate)made.at(-1).rotation=normAngle(deg);}}
  else throw Error(`Unknown array mode: ${op.mode}`);
  doc.objects.splice(doc.objects.indexOf(src)+1,0,...made);}
function simplifyPath(o,tol){if(o?.kind!=='path')throw Error('Simplify needs a path.');const t=Number(tol);if(!Number.isFinite(t)||t<=0||t>10)throw Error('Simplify tolerance must be between 0 and 10 mm.');let pts=o.points;const min=o.closed?3:2;
  const out=o.closed?(()=>{const ring=[...pts,pts[0]],r=rdp(ring,t).slice(0,-1);return r;})():rdp(pts,t);if(out.length<min)return;o.points=out.map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]);delete o.handles;refreshPathBounds(o);}
function splitPath(doc,id,index){const o=doc.objects.find(v=>v.id===id);if(!o||o.kind!=='path'||!Number.isInteger(index)||!o.points[index])throw Error(`Unknown path point: ${id}[${index}].`);const pts=o.points;
  if(o.closed){const rot=[...pts.slice(index),...pts.slice(0,index),pts[index]];Object.assign(o,{points:rot,closed:false,stitch:'run'});delete o.holes;delete o.handles;refreshPathBounds(o);return;}
  if(index===0||index===pts.length-1)throw Error('Split at an interior node of an open path.');const second={...structuredClone(o),id:crypto.randomUUID(),name:`${o.name||'Path'} 2`,points:pts.slice(index)};delete second.handles;delete second.groupId;o.points=pts.slice(0,index+1);delete o.handles;refreshPathBounds(o);refreshPathBounds(second);doc.objects.splice(doc.objects.indexOf(o)+1,0,second);}
function joinPaths(doc,ids,close){const objs=(ids||[]).map(id=>{const o=doc.objects.find(v=>v.id===id);if(!o||o.kind!=='path'||o.closed)throw Error('Join works on open paths.');return o;});if(objs.length<2||new Set(ids).size!==ids.length)throw Error('Join needs at least two different open paths.');
  const d=(u,v)=>Math.hypot(u[0]-v[0],u[1]-v[1]),dedupe=pts=>pts.filter((p,i)=>!i||d(p,pts[i-1])>1e-6);let pts=[...objs[0].points];
  for(const o of objs.slice(1)){const q=o.points,rq=[...q].reverse(),best=[{dist:d(pts.at(-1),q[0]),out:[...pts,...q]},{dist:d(pts.at(-1),q.at(-1)),out:[...pts,...rq]},{dist:d(pts[0],q.at(-1)),out:[...q,...pts]},{dist:d(pts[0],q[0]),out:[...rq,...pts]}].sort((a,b)=>a.dist-b.dist)[0];pts=dedupe(best.out);}
  const first=objs[0];first.points=pts.map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]);delete first.handles;if(close&&first.points.length>=4){first.closed=true;if(d(first.points[0],first.points.at(-1))<1e-6)first.points.pop();}
  if(first.points.length>1000)throw Error('The joined path would exceed 1,000 points.');refreshPathBounds(first);doc.objects=doc.objects.filter(o=>o===first||!objs.includes(o));}
function reorderObject(doc,id,to,index){const i=doc.objects.findIndex(v=>v.id===id);if(i<0)throw Error(`Unknown object: ${id}`);if(index!==undefined){if(!Number.isInteger(index)||index<0||index>=doc.objects.length)throw Error('Reorder index is outside the object list.');const [m]=doc.objects.splice(i,1);doc.objects.splice(index,0,m);return;}const [o]=doc.objects.splice(i,1),n=doc.objects.length;const at=to==='front'?n:to==='back'?0:to==='forward'?Math.min(n,i+1):to==='backward'?Math.max(0,i-1):-1;if(at<0){doc.objects.splice(i,0,o);throw Error(`Unknown reorder target: ${to}`);}doc.objects.splice(at,0,o);}
function sortByColor(doc){const order=[];for(const o of doc.objects)if(!order.includes(o.thread.toLowerCase()))order.push(o.thread.toLowerCase());doc.objects=order.flatMap(c=>doc.objects.filter(o=>o.thread.toLowerCase()===c));}

// Registry-font lettering: layout -> optional text-on-path -> rotation, returning stitchable primitives in mm (see textlayout.js).
const TEXT_OPTION_KEYS=['tracking','wordSpacing','lineHeight','align','italic','bold'];
function bufferRingsForBold(rings,d){try{const closed=rings.map(closedRing),poly=rings.map(r=>r),grown=bufferSegments(closed,d),result=polygonClipping.union(poly,...grown);const out=[];for(const polygon of result)for(const ring of polygon)out.push(ring.slice(0,-1));return out.length?out:null;}catch{return null;}}
export function textPrimitives(obj){
  const font=getFont(obj.font);if(!font)return null;
  let prims=layoutText(obj,font,{buffer:bufferRingsForBold}).prims;
  if(obj.along)prims=mapPrimitives(resamplePrimitives(prims),mapAlongPoint(obj));
  const angle=(Number(obj.rotation)||0)*Math.PI/180;if(angle&&prims.length){const pts=primitiveLines(prims).flat(),cx=(Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2,cy=(Math.min(...pts.map(p=>p[1]))+Math.max(...pts.map(p=>p[1])))/2,c=Math.cos(angle),sn=Math.sin(angle);prims=mapPrimitives(prims,([x,y])=>[cx+(x-cx)*c-(y-cy)*sn,cy+(x-cx)*sn+(y-cy)*c]);}
  return prims;
}
// Two-rail satin: needles alternate between the rails every `spacing` mm of rail length; pull compensation widens the column.
export function satinFromRails(a,b,spacing,comp,rungs=[]){
  const cum=r=>{const c=[0];for(let i=1;i<r.length;i++)c.push(c[i-1]+Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1]));return c;},ca=cum(a),cb=cum(b),La=ca.at(-1),Lb=cb.at(-1);if(Math.max(La,Lb)<.2)return {zig:[],centre:[],pairs:[]};
  const at=(r,c,t)=>{let i=1;while(i<c.length-1&&c[i]<t)i++;const seg=c[i]-c[i-1]||1,f=Math.max(0,Math.min(1,(t-c[i-1])/seg));return [r[i-1][0]+(r[i][0]-r[i-1][0])*f,r[i-1][1]+(r[i][1]-r[i-1][1])*f];};
  // Rungs pair a position on rail A with one on rail B; between two rungs the rails advance in proportion, so letters whose rails differ in length do not twist.
  // A rung end can sit close to several parts of a rail (bends, rings), so each end keeps every plausible position and a small dynamic program picks the sequence that is nearest overall while advancing along the rail.
  const options=(r,c,p)=>{const out=[];for(let i=1;i<r.length;i++){const dx=r[i][0]-r[i-1][0],dy=r[i][1]-r[i-1][1],l2=dx*dx+dy*dy,u=l2?Math.max(0,Math.min(1,((p[0]-r[i-1][0])*dx+(p[1]-r[i-1][1])*dy)/l2)):0;out.push([c[i-1]+Math.sqrt(l2)*u,Math.hypot(p[0]-r[i-1][0]-dx*u,p[1]-r[i-1][1]-dy*u)]);}const best=Math.min(...out.map(v=>v[1])),keep=out.filter(v=>v[1]<=best*1.6+.8).sort((u,v)=>u[0]-v[0]),res=[];for(const v of keep){const last=res.at(-1);if(last&&v[0]-last[0]<.05){if(v[1]<last[1])res[res.length-1]=v;}else res.push(v);}return res;};
  // Rungs usually overshoot the rails, so the rail position of a rung is where the rung crosses the rail; only a rung that misses a rail falls back to the nearest point of that rail.
  const crossings=(r,c,p,q)=>{const out=[],rx=q[0]-p[0],ry=q[1]-p[1];for(let i=1;i<r.length;i++){const sx=r[i][0]-r[i-1][0],sy=r[i][1]-r[i-1][1],den=rx*sy-ry*sx;if(Math.abs(den)<1e-9)continue;const t=((r[i-1][0]-p[0])*sy-(r[i-1][1]-p[1])*sx)/den,u=((r[i-1][0]-p[0])*ry-(r[i-1][1]-p[1])*rx)/den;if(t>=0&&t<=1&&u>=0&&u<=1)out.push([c[i-1]+Math.hypot(sx,sy)*u,0]);}return out;};
  const railOptions=(r,c,p,q,end)=>{const x=crossings(r,c,p,q);return x.length?x:options(r,c,end);};
  const monotone=sets=>{const n=sets.length,cost=sets.map(s=>s.map(()=>0)),from=sets.map(s=>s.map(()=>-1));sets[0]?.forEach((v,j)=>{cost[0][j]=v[1];});
    for(let k=1;k<n;k++)sets[k].forEach((v,j)=>{let bestC=Infinity,bestI=-1;sets[k-1].forEach((u,i)=>{const c=cost[k-1][i]+Math.max(0,u[0]-v[0])*3;if(c<bestC){bestC=c;bestI=i;}});cost[k][j]=bestC+v[1];from[k][j]=bestI;});
    const out=Array(n);if(!n)return out;let j=cost[n-1].indexOf(Math.min(...cost[n-1]));for(let k=n-1;k>=0;k--){out[k]=sets[k][j][0];j=from[k][j];}return out;};
  const sides=rungs.map(([p,q])=>{const d=(r,v)=>Math.min(...r.map(w=>Math.hypot(w[0]-v[0],w[1]-v[1])));return d(a,p)+d(b,q)<=d(a,q)+d(b,p)?[p,q]:[q,p];});
  const order=sides.map((sd,i)=>[(railOptions(a,ca,rungs[i][0],rungs[i][1],sd[0])[0]||[0])[0],i]).sort((u,v)=>u[0]-v[0]).map(v=>v[1]),ta=monotone(order.map(i=>railOptions(a,ca,rungs[i][0],rungs[i][1],sides[i][0]))),tb=monotone(order.map(i=>railOptions(b,cb,rungs[i][0],rungs[i][1],sides[i][1])));
  const anchors=[[0,0]];order.forEach((_,k)=>anchors.push([ta[k],tb[k]]));
  anchors.sort((u,v)=>u[0]-v[0]);anchors.push([La,Lb]);for(let i=1;i<anchors.length;i++)anchors[i][1]=Math.max(anchors[i][1],anchors[i-1][1]);
  if(globalThis.__dbgAnchors)globalThis.__dbgAnchors(anchors,ca,cb);
  const zig=[],centre=[],pairs=[];let flip=0;
  for(let s=1;s<anchors.length;s++){const [a0,b0]=anchors[s-1],[a1,b1]=anchors[s],len=Math.max(a1-a0,b1-b0);if(len<1e-6&&s<anchors.length-1)continue;const n=Math.max(1,Math.ceil(len/spacing));
    for(let k=(s===1?0:1);k<=n;k++){const f=k/n,pa=at(a,ca,a0+(a1-a0)*f),pb=at(b,cb,b0+(b1-b0)*f),dx=pa[0]-pb[0],dy=pa[1]-pb[1],l=Math.hypot(dx,dy)||1;pairs.push([pa,pb]);centre.push([(pa[0]+pb[0])/2,(pa[1]+pb[1])/2]);zig.push(flip++%2?[pb[0]-dx/l*comp,pb[1]-dy/l*comp]:[pa[0]+dx/l*comp,pa[1]+dy/l*comp]);}}
  return {zig,centre,pairs};
}

// ---- Direct-manipulation transforms (selection handles, nudging, flip, convert to path) ---------------------
const rotatePoint=(p,c,th)=>{const dx=p[0]-c[0],dy=p[1]-c[1],co=Math.cos(th),si=Math.sin(th);return [c[0]+dx*co-dy*si,c[1]+dx*si+dy*co];};
function bakeRotation(o){if(!o.rotation||o.kind!=='path')return;const c=objectCenter(o),th=o.rotation*Math.PI/180;mapPathPoints(o,p=>rotatePoint(p,c,th));delete o.rotation;refreshPathBounds(o);}
function objById(doc,id){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o;}
function ellipseToPath(o){const cx=o.x+o.w/2,cy=o.y+o.h/2,rx=o.w/2,ry=o.h/2,k=.5522847498,th=(Number(o.rotation)||0)*Math.PI/180,c=[cx,cy],R=p=>th?rotatePoint(p,c,th):p;
  const nodes=[[cx+rx,cy],[cx,cy+ry],[cx-rx,cy],[cx,cy-ry]],hs=[[[cx+rx,cy-ry*k],[cx+rx,cy+ry*k]],[[cx+rx*k,cy+ry],[cx-rx*k,cy+ry]],[[cx-rx,cy+ry*k],[cx-rx,cy-ry*k]],[[cx-rx*k,cy-ry],[cx+rx*k,cy-ry]]];
  return {points:nodes.map(R),handles:hs.map(([i,out])=>({i:R(i),o:R(out)}))};}
// Convert a rectangle, ellipse or lettering into editable path(s). Rotation is baked into the points; the first result keeps the object's id.
function toPathObject(doc,id){
  const o=objById(doc,id),at=doc.objects.indexOf(o);
  if(o.kind==='path')return;
  if(o.kind==='stitch_layer')throw Error('Imported machine stitches cannot be converted to a path.');
  const common={thread:o.thread,stitch:o.stitch==='satin'?'fill':o.stitch,...(o.border?{border:true,borderThread:o.borderThread}:{}),...(o.groupId?{groupId:o.groupId}:{}),...(o.visible===false?{visible:false}:{}),...(o.locked?{locked:true}:{})};
  const keep=Object.fromEntries(['angle','spacing'].filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
  if(o.kind==='rect'||o.kind==='ellipse'){
    const base={id:o.id,name:o.name,kind:'path',x:0,y:0,w:0,h:0,closed:true,...common,...keep};
    if(o.kind==='rect'){const ring=geometry(o)[0].slice(0,-1).map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]);Object.assign(base,{points:ring});}
    else{const e=ellipseToPath(o);Object.assign(base,{points:e.points.map(p=>p.map(v=>+v.toFixed(3))),handles:e.handles.map(h=>({i:h.i.map(v=>+v.toFixed(3)),o:h.o.map(v=>+v.toFixed(3))}))});}
    doc.objects[at]=base;refreshPathBounds(base);return;}
  // lettering -> one path per stitch primitive, grouped
  let prims;if(o.kind==='text'&&isRegistryFont(o.font)){prims=textPrimitives(o);if(!prims)throw Error('Load the font before converting this lettering.');}
  else prims=geometry(o).map(pts=>({t:'r',pts}));
  const tidy=r=>{let pts=r.map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]);if(pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();return pts;};
  const limited=(pts,max)=>{let r=pts,tol=.02;while(r.length>max&&tol<2){r=simplifyRing(pts,tol);tol*=1.8;}return r;};
  const made=[];const gid=crypto.randomUUID();
  for(const pr of prims){
    if(pr.t==='f'){const [outer,...holes]=pr.rings.map(tidy).map((r,i)=>limited(r,i?200:1000));if(outer.length<3)continue;made.push({kind:'path',points:outer,closed:true,...(holes.length?{holes:holes.filter(h=>h.length>=3).slice(0,20)}:{}),...common,stitch:o.stitch==='run'?'run':'fill'});}
    else if(pr.t==='s'){const band=tidy([...pr.a,...[...pr.b].reverse()]);if(band.length>=3)made.push({kind:'path',points:limited(band,1000),closed:true,...common,stitch:'fill'});}
    else if(pr.pts.length>=2)made.push({kind:'path',points:limitedOpen(pr.pts.map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)])),closed:false,...common,stitch:'run'});}
  if(!made.length)throw Error('This lettering has no outlines to convert.');if(doc.objects.length-1+made.length>100)throw Error(`Converting would create ${made.length} objects and exceed the 100-object limit; shorten the text first.`);
  made.forEach((m,i)=>{m.id=i?crypto.randomUUID():o.id;m.name=`${(o.name||'Lettering').replace(/^Lettering: /,'')} ${i+1}`;m.w=0;m.h=0;m.x=0;m.y=0;if(made.length>1&&!m.groupId)m.groupId=gid;refreshPathBounds(m);});
  doc.objects.splice(at,1,...made);
}
const simplifyRing=(pts,tol)=>{const r=rdp([...pts,pts[0]],tol).slice(0,-1);return r.length>=3?r:pts;};
function limitedOpen(pts){let r=pts,tol=.02;while(r.length>1000&&tol<2){r=rdp(pts,tol);tol*=1.8;}return r;}
function textRange(o){if(isRegistryFont(o.font)){const f=getFont(o.font);return f?[f.size*f.minScale,f.size*f.maxScale]:[2,200];}return o.font==='neon-blinking/1'?[20,60]:[4,16];}
// Scale objects about (ox,oy). Rotated rectangles/ellipses are converted to paths for non-uniform scaling so the result is exact.
function scaleObjects(doc,ids,sx,sy,ox,oy){
  if(![sx,sy,ox,oy].every(Number.isFinite)||Math.abs(sx)<.01||Math.abs(sy)<.01||Math.abs(sx)>100||Math.abs(sy)>100)throw Error('Scale factors must be between 0.01 and 100 (not zero).');
  if(!Array.isArray(ids)||!ids.length)throw Error('Nothing to scale.');
  const f=(x,y)=>[ox+(x-ox)*sx,oy+(y-oy)*sy],uniform=Math.abs(Math.abs(sx)-Math.abs(sy))<1e-6,ax=Math.abs(sx),ay=Math.abs(sy);
  for(const id of ids){let o=objById(doc,id);
    if((o.kind==='rect'||o.kind==='ellipse')&&o.rotation&&!uniform){toPathObject(doc,id);o=objById(doc,id);}
    if(o.kind==='path'){bakeRotation(o);mapPathPoints(o,([x,y])=>f(x,y));if(o.satinWidth)o.satinWidth=Math.max(.5,Math.min(12,o.satinWidth*Math.sqrt(ax*ay)));if(o.satinWidthEnd)o.satinWidthEnd=Math.max(.5,Math.min(12,o.satinWidthEnd*Math.sqrt(ax*ay)));refreshPathBounds(o);}
    else if(o.kind==='rect'||o.kind==='ellipse'||o.kind==='stitch_layer'){const [cx,cy]=f(o.x+o.w/2,o.y+o.h/2);o.w=o.w*ax;o.h=o.h*ay;o.x=cx-o.w/2;o.y=cy-o.h/2;if(o.radius)o.radius=+(o.radius*Math.min(ax,ay)).toFixed(3);}
    else if(o.kind==='text'){const [lo,hi]=textRange(o),h=Math.max(lo,Math.min(hi,o.h*ay)),np=f(o.x,o.y);if(o.along)o.along.points=o.along.points.map(([x,y])=>f(x,y));o.w=Math.min(1000,Math.max(.5,o.w*ax));o.h=+h.toFixed(3);o.x=np[0];o.y=np[1];for(const k of ['tracking','wordSpacing'])if(o[k])o[k]*=ax;if(o.bold)o.bold=Math.min(3,o.bold*ay);}
  }
}
function rotateObjects(doc,ids,angle,cx,cy){
  if(![angle,cx,cy].every(Number.isFinite))throw Error('Rotation needs an angle and a pivot.');const th=angle*Math.PI/180;
  for(const id of ids){const o=objById(doc,id),c0=objectCenter(o),c1=rotatePoint(c0,[cx,cy],th);translateObject(o,c1[0]-c0[0],c1[1]-c0[1]);o.rotation=normAngle((Number(o.rotation)||0)+angle);}
}
function flipObjects(doc,ids,axis,pivotRaw){
  if(axis!=='horizontal'&&axis!=='vertical')throw Error('Flip axis must be horizontal or vertical.');const objs=ids.map(id=>objById(doc,id));
  for(const o of objs)if(o.kind==='text'||o.kind==='stitch_layer')throw Error('Lettering and imported stitches cannot be flipped; convert lettering to paths first.');
  const bs=objs.map(objectBounds),pivot=pivotRaw??(axis==='horizontal'?(Math.min(...bs.map(b=>b[0]))+Math.max(...bs.map(b=>b[2])))/2:(Math.min(...bs.map(b=>b[1]))+Math.max(...bs.map(b=>b[3])))/2);
  const m=([x,y])=>axis==='horizontal'?[2*pivot-x,y]:[x,2*pivot-y];
  for(const o of objs){if(o.kind==='path'){bakeRotation(o);mapPathPoints(o,m);refreshPathBounds(o);}else{const c=[o.x+o.w/2,o.y+o.h/2],nc=m(c);o.x=nc[0]-o.w/2;o.y=nc[1]-o.h/2;if(o.rotation)o.rotation=normAngle(-o.rotation);}}
}
function textLines(obj) {
  if(obj.font==='neon-blinking/1')return neonLines(obj);
  const s=String(obj.text||'').toUpperCase().slice(0,24),h=clamp(Number(obj.h)||8,4,16),w=Number(obj.w)||h*.72*s.length;
  const cell=w/Math.max(1,s.length),out=[];
  [...s].forEach((ch,i)=>{if(ch===' ')return;const glyph=GLYPHS[ch]||GLYPHS['?'];if(!glyph)return;glyph.forEach(([x1,y1,x2,y2])=>out.push([[obj.x+i*cell+x1*cell*.78+cell*.1,obj.y-h+y1*h],[obj.x+i*cell+x2*cell*.78+cell*.1,obj.y-h+y2*h]]));});return out;
}
function neonLines(obj){
  const sizeScale=Number(obj.h)/neonFont.nominalSizeMm,scale=Number(obj.h)/neonFont.unitsPerEm,requested=String(obj.text||'').toUpperCase();
  if(!Number.isFinite(scale)||sizeScale<neonFont.minScale||sizeScale>neonFont.maxScale)throw Error('Néon blinking lettering size must be 20–60 mm (OFL embroidery font limits).');
  const missing=[...new Set([...requested].filter(ch=>ch!==' '&&!neonFont.glyphs[ch]))];if(missing.length)throw Error(`Néon blinking supports A–Z, 0–9, space, period, comma, exclamation, question and hyphen; unsupported: ${missing.join(' ')}.`);
  const out=[];let cursor=0;for(const ch of requested){const glyph=neonFont.glyphs[ch];if(!glyph){cursor+=neonFont.glyphs[' '].advance*scale;continue;}for(const sourcePath of glyph.paths)for(const pts of parseSvgPath(sourcePath.d))out.push(pts.map(([x,y])=>[obj.x+(cursor+x*scale),obj.y+(y-151.18)*scale]));cursor+=glyph.advance*scale;}
  const natural=cursor;if(obj.w>0&&natural>0){const sx=obj.w/natural;return out.map(line=>line.map(([x,y])=>[obj.x+(x-obj.x)*sx,y]));}return out;
}
export function parseSvgPath(d){
  const t=d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[a-zA-Z]/g)||[];let i=0,cmd=null,x=0,y=0,sx=0,sy=0,lastC=null,lines=[],line=[];
  const num=()=>Number(t[i++]),point=(a,b)=>{x=a;y=b;line.push([x,y]);},flush=()=>{if(line.length>1)lines.push(line);line=[];};
  while(i<t.length){if(/^[a-z]$/i.test(t[i]))cmd=t[i++];if(!cmd)throw Error('Invalid bundled font path.');const rel=cmd===cmd.toLowerCase(),c=cmd.toLowerCase();
    if(c==='m'){const a=num(),b=num();flush();x=rel?x+a:a;y=rel?y+b:b;sx=x;sy=y;line=[[x,y]];lastC=null;cmd=rel?'l':'L';}
    else if(c==='l'){const a=num(),b=num();point(rel?x+a:a,rel?y+b:b);lastC=null;}
    else if(c==='h'){const a=num();point(rel?x+a:a,y);lastC=null;}
    else if(c==='v'){const a=num();point(x,rel?y+a:a);lastC=null;}
    else if(c==='c'){const a=num(),b=num(),cc=num(),dd=num(),e=num(),f=num(),x0=x,y0=y,p1=[rel?x+a:a,rel?y+b:b],p2=[rel?x+cc:cc,rel?y+dd:dd],p3=[rel?x+e:e,rel?y+f:f];for(let k=1;k<=8;k++){const q=k/8,r=1-q;line.push([r*r*r*x0+3*r*r*q*p1[0]+3*r*q*q*p2[0]+q*q*q*p3[0],r*r*r*y0+3*r*r*q*p1[1]+3*r*q*q*p2[1]+q*q*q*p3[1]]);}x=p3[0];y=p3[1];lastC=p2;}
    else if(c==='z'){point(sx,sy);flush();x=sx;y=sy;cmd=null;lastC=null;}
    else throw Error(`Unsupported command in bundled font: ${cmd}`);
  }flush();return lines;
}
function splinePoints(pts,closed){
  // Centripetal-free uniform Catmull-Rom through every node, sampled per segment.
  const n=pts.length,out=[],segments=closed?n:n-1,at=i=>closed?pts[((i%n)+n)%n]:pts[Math.max(0,Math.min(n-1,i))];
  for(let i=0;i<segments;i++){const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2),steps=Math.max(4,Math.min(24,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/1.5)));for(let k=0;k<steps;k++){const t=k/steps,t2=t*t,t3=t2*t;out.push([0,1].map(a=>.5*((2*p1[a])+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t2+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t3)));}}
  out.push(closed?out[0]:[...pts[n-1]]);return out;
}
function bezierOutline(o){
  const pts=o.points.map(p=>[Number(p[0]),Number(p[1])]),n=pts.length,segments=o.closed?n:n-1,out=[[...pts[0]]];
  for(let i=0;i<segments;i++){const j=(i+1)%n,p0=pts[i],p3=pts[j],p1=o.handles[i]?.o||p0,p2=o.handles[j]?.i||p3,steps=Math.max(4,Math.min(32,Math.ceil((Math.hypot(p1[0]-p0[0],p1[1]-p0[1])+Math.hypot(p2[0]-p1[0],p2[1]-p1[1])+Math.hypot(p3[0]-p2[0],p3[1]-p2[1]))/1.5)));
    for(let k=1;k<=steps;k++){const t=k/steps,u=1-t;out.push([0,1].map(a=>u*u*u*p0[a]+3*u*u*t*p1[a]+3*u*t*t*p2[a]+t*t*t*p3[a]));}}
  return out;
}
function hasHandles(o){return Array.isArray(o.handles)&&o.handles.some(Boolean);}
function mapPathPoints(o,fn){o.points=o.points.map(p=>fn(p));if(o.holes)o.holes=o.holes.map(h=>h.map(p=>fn(p)));if(o.handles)o.handles=o.handles.map(h=>h?{i:fn(h.i),o:fn(h.o)}:h);}
function pathOutline(o){if(hasHandles(o)&&o.points.length>=2)return bezierOutline(o);const pts=o.points.map(p=>[Number(p[0]),Number(p[1])]);if(o.smooth&&pts.length>=3)return splinePoints(pts,Boolean(o.closed));return o.closed?[...pts,pts[0]]:pts;}
function satinZigzag(o,spacing,comp){
  // Satin column: needles alternate between the two rails (centerline offset by half the width plus pull compensation), one crossing every `spacing` mm along the path.
  const line=pathOutline(o),half=Math.max(.25,(Number(o.satinWidth)||3)/2+comp),cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]));
  const total=cum.at(-1);if(total<.2)return [];
  const at=t=>{t=Math.max(0,Math.min(total,t));let i=1;while(i<cum.length-1&&cum[i]<t)i++;const seg=cum[i]-cum[i-1]||1,f=(t-cum[i-1])/seg;return [line[i-1][0]+(line[i][0]-line[i-1][0])*f,line[i-1][1]+(line[i][1]-line[i-1][1])*f];};
  const n=Math.max(1,Math.ceil(total/spacing)),out=[];
  for(let k=0;k<=n;k++){const t=Math.min(total,k*total/n),a=at(t-Math.min(.3,spacing/2)),b=at(t+Math.min(.3,spacing/2)),tx=b[0]-a[0],ty=b[1]-a[1],tl=Math.hypot(tx,ty)||1,side=k%2?-1:1,p=at(t);out.push([p[0]-ty/tl*half*side,p[1]+tx/tl*half*side]);}
  return out;
}
function refreshPathBounds(o){const xs=o.points.map(p=>p[0]),ys=o.points.map(p=>p[1]);o.x=Math.min(...xs);o.y=Math.min(...ys);o.w=Math.max(...xs)-o.x;o.h=Math.max(...ys)-o.y;}
function objectBounds(o){const pts=geometry(o).flat();if(!pts.length)return [o.x,o.y,o.x+o.w,o.y+o.h];return [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];}
function geometry(obj,comp=0) {
  let lines;
  if(obj.kind==='text'&&isRegistryFont(obj.font)){const prims=textPrimitives(obj);return prims?primitiveLines(prims):[];}
  if(obj.kind==='text'){lines=textLines(obj);if(obj.along)lines=mapAlongPath(lines,obj);}
  else if(obj.kind==='path')lines=[pathOutline(obj),...(obj.holes||[]).map(h=>{const r=h.map(p=>[Number(p[0]),Number(p[1])]);return [...r,r[0]];})];
  else if(obj.kind==='ellipse') {const pts=[];for(let i=0;i<=64;i++){const a=2*Math.PI*i/64;pts.push([obj.x+obj.w/2+Math.cos(a)*(obj.w/2+comp),obj.y+obj.h/2+Math.sin(a)*(obj.h/2+comp)]);}lines=[pts];}
  else {const x=obj.x-comp,y=obj.y-comp,w=obj.w+2*comp,h=obj.h+2*comp,r=Math.max(0,Math.min((Number(obj.radius)||0)+(obj.radius>0?comp:0),Math.min(w,h)/2));
    if(r>.05){const pts=[],arc=(cx,cy,a0)=>{for(let k=0;k<=8;k++){const a=a0+Math.PI/2*k/8;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}};arc(x+w-r,y+r,-Math.PI/2);arc(x+w-r,y+h-r,0);arc(x+r,y+h-r,Math.PI/2);arc(x+r,y+r,Math.PI);pts.push(pts[0]);lines=[pts];}
    else lines=[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]];}
  const angle=(Number(obj.rotation)||0)*Math.PI/180;if(!angle)return lines;
  const points=lines.flat(),cx=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,cy=(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2,c=Math.cos(angle),s=Math.sin(angle);
  return lines.map(line=>line.map(([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c]));
}
function polygonFill(rings,spacing,angle) {
  // Evenly spaced parallel rows with even/odd polygon clipping; each row becomes a boustrophedon path.
  const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),rotRings=rings.map(r=>r.map(([x,y])=>[x*c+y*s,-x*s+y*c])),rot=rotRings.flat();
  const minY=Math.min(...rot.map(p=>p[1])),maxY=Math.max(...rot.map(p=>p[1])),lines=[];
  // One direction per row: every other row runs right-to-left with its pieces visited in reverse, so the needle always leaves a
  // piece at the edge nearest the next one (a hole edge in the middle of a row, the outer edge between rows).
  const un=p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c];let reverse=false;
  for(let y=minY+spacing/2;y<maxY;y+=spacing){const xs=[];for(const ring of rotRings)for(let i=0;i<ring.length-1;i++){const [x1,y1]=ring[i],[x2,y2]=ring[i+1];if((y1<=y&&y2>y)||(y2<=y&&y1>y))xs.push(x1+(y-y1)*(x2-x1)/(y2-y1));}xs.sort((a,b)=>a-b);
    const row=[];for(let i=0;i+1<xs.length;i+=2)row.push([[xs[i],y],[xs[i+1],y]]);if(reverse){row.reverse();for(const seg of row)seg.reverse();}for(const [a,b] of row)lines.push([un(a),un(b)]);if(row.length)reverse=!reverse;}
  return lines;
}
function sampleLine(a,b,maxLen=2.5){const dist=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(dist/maxLen)),o=[];for(let i=1;i<=n;i++)o.push([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]);return o;}
// A reference (background) picture for tracing by hand: shown under the shapes in the editor, never sewn.
function validateReference(r,fail){if(r===undefined)return;const num=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
  if(!r||typeof r!=='object'||typeof r.data!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.data)||r.data.length>1_500_000)fail('the reference image must be a PNG, JPEG, WebP or GIF data URL under 1.5 MB.');
  if(!num(r.x,-2000,2000)||!num(r.y,-2000,2000)||!num(r.w,1,4000)||!num(r.h,1,4000))fail('the reference image needs a position and a size in millimetres.');
  if(r.opacity!==undefined&&!num(r.opacity,.05,1))fail('the reference image opacity must be between 0.05 and 1.');
  for(const k of ['visible','locked'])if(r[k]!==undefined&&typeof r[k]!=='boolean')fail(`the reference image ${k} flag must be true or false.`);
  if(r.name!==undefined&&(typeof r.name!=='string'||r.name.length>200))fail('the reference image name is too long.');}
export function validateDocument(doc){
  const fail=m=>{throw Error(`Invalid Welcome project: ${m}`);};
  if(!doc||typeof doc!=='object'||Array.isArray(doc)||doc.schema!=='welcom/1')fail('expected schema welcom/1.');
  if(typeof doc.name!=='string'||!doc.name.trim()||doc.name.length>120)fail('name must contain 1–120 characters.');
  validateReference(doc.reference,fail);
  if(!Number.isSafeInteger(doc.revision)||doc.revision<0)fail('revision must be a nonnegative integer.');
  if(!Number.isFinite(doc.hoop)||doc.hoop<10||doc.hoop>400||(doc.hoopH!==undefined&&(!Number.isFinite(doc.hoopH)||doc.hoopH<10||doc.hoopH>400)))fail('hoop width and height must be between 10 and 400 mm.');
  if(!doc.settings||typeof doc.settings!=='object'||!Number.isFinite(doc.settings.spacing)||doc.settings.spacing<.25||doc.settings.spacing>1.2||!Number.isFinite(doc.settings.angle)||doc.settings.angle<0||doc.settings.angle>180||typeof doc.settings.underlay!=='boolean'||!Number.isFinite(doc.settings.compensation)||doc.settings.compensation<0||doc.settings.compensation>2)fail('stitch settings are outside the supported ranges.');
  {const st=doc.settings;if(st.stitchLength!==undefined&&!(Number.isFinite(st.stitchLength)&&st.stitchLength>=.5&&st.stitchLength<=7)||st.stagger!==undefined&&!(Number.isInteger(st.stagger)&&st.stagger>=1&&st.stagger<=8)||st.underlayType!==undefined&&!['none','auto','contour','fill','contour+fill','center','zigzag','center+zigzag','contour+zigzag','center+contour','center+contour+zigzag'].includes(st.underlayType))fail('stitch length must be 0.5–7 mm, stagger 1–8 and underlay type a known value.');}
  if(doc.settings.ties!==undefined&&typeof doc.settings.ties!=='boolean'||doc.settings.trims!==undefined&&typeof doc.settings.trims!=='boolean')fail('ties and trims must be true or false.');
  if(!Array.isArray(doc.objects)||doc.objects.length>100)fail('objects must be an array containing at most 100 items.');
  if(doc.guides!==undefined&&(!Array.isArray(doc.guides)||doc.guides.length>40||doc.guides.some(g=>!g||!['x','y'].includes(g.axis)||!Number.isFinite(g.pos)||Math.abs(g.pos)>1000)))fail('guides must be an array of at most 40 {axis:"x"|"y",pos} entries within ±1000 mm.');
  if(doc.customFonts!==undefined){const cf=doc.customFonts;if(!cf||typeof cf!=='object'||Array.isArray(cf)||Object.keys(cf).length>8)fail('customFonts must be an object with at most 8 fonts.');for(const [id,f] of Object.entries(cf)){if(!/^[A-Za-z0-9_.-]{1,40}$/.test(id)||!f||!f.glyphs||typeof f.glyphs!=='object'||Array.isArray(f.glyphs)||Object.keys(f.glyphs).length>400||!(f.unitsPerEm>0)||!Number.isFinite(f.baseline)||!(f.size>0))fail(`custom font ${id} is invalid (at most 400 glyphs).`);}}
  const ids=new Set();let pointCount=0,stitchCommandCount=0,sourceByteCount=0;const color=/^#[0-9a-fA-F]{6}$/;
  for(const o of doc.objects){
    if(!o||typeof o!=='object'||Array.isArray(o))fail('each object must be an object.');
    if(typeof o.id!=='string'||!o.id||o.id.length>100||ids.has(o.id))fail('object IDs must be unique nonempty strings.');ids.add(o.id);
    if(!['rect','ellipse','path','text','stitch_layer'].includes(o.kind))fail(`object ${o.id} has unsupported kind “${String(o.kind)}”.`);
    if(o.name!==undefined&&(typeof o.name!=='string'||o.name.length>120))fail(`object ${o.id} has an invalid name.`);
    if(o.radius!==undefined&&!(o.kind==='rect'&&Number.isFinite(o.radius)&&o.radius>=0&&o.radius<=500))fail(`object ${o.id} radius must be 0–500 mm and only applies to rectangles.`);
    if(o.satinWidthEnd!==undefined&&!(o.kind==='path'&&['satin','motif'].includes(o.stitch)&&Number.isFinite(o.satinWidthEnd)&&o.satinWidthEnd>=.5&&o.satinWidthEnd<=12))fail(`object ${o.id} end width must be 0.5–12 mm and only applies to satin or motif paths.`);
    if(o.clipId!==undefined&&typeof o.clipId!=='string'||o.mask!==undefined&&typeof o.mask!=='boolean')fail(`object ${o.id} has an invalid clipping mask link.`);
    if(o.blendThread!==undefined&&!(color.test(o.blendThread)&&o.stitch==='fill'&&o.kind!=='text'&&o.kind!=='stitch_layer'))fail(`object ${o.id} can only blend a second thread colour into fills.`);
    if(o.blendPalette!==undefined&&o.blendPalette!==null){if(!(Array.isArray(o.blendPalette)&&o.blendPalette.length>=2&&o.blendPalette.length<=5&&o.blendPalette.every(c=>color.test(c))&&o.stitch==='fill'&&o.kind!=='text'&&o.kind!=='stitch_layer'))fail(`object ${o.id} blendPalette must be 2–5 thread colours for a fill.`);if(o.blendThread)fail(`object ${o.id} uses either blendThread or blendPalette, not both.`);}
    if(o.blendAngle!==undefined&&!(Number.isFinite(o.blendAngle)&&o.blendAngle>=-360&&o.blendAngle<=360))fail(`object ${o.id} blendAngle must be −360 to 360 degrees.`);
    for(const k of ['blendStart','blendEnd'])if(o[k]!==undefined&&!(Number.isFinite(o[k])&&o[k]>=0&&o[k]<=1))fail(`object ${o.id} ${k} must be 0–1.`);
    if(o.join!==undefined&&!['round','miter','bevel'].includes(o.join)||o.cap!==undefined&&!['butt','round','square'].includes(o.cap))fail(`object ${o.id} has an invalid cap or join.`);
    if(o.widthStops!==undefined&&!(o.kind==='path'&&['satin','motif'].includes(o.stitch)&&Array.isArray(o.widthStops)&&o.widthStops.length>=1&&o.widthStops.length<=50&&o.widthStops.every((st,i)=>Array.isArray(st)&&st.length===2&&Number.isFinite(st[0])&&st[0]>=0&&st[0]<=1&&Number.isFinite(st[1])&&st[1]>=.5&&st[1]<=12&&(!i||st[0]>=o.widthStops[i-1][0]))))fail(`object ${o.id} width stops must be 1–50 sorted [position 0–1, width 0.5–12 mm] pairs on a satin or motif path.`);
    if(o.borderWidth!==undefined&&!(Number.isFinite(o.borderWidth)&&o.borderWidth>=0&&o.borderWidth<=12))fail(`object ${o.id} border width must be 0–12 mm.`);
    if(!color.test(o.thread)||!['fill','run','satin','motif','sequin','bead','bling'].includes(o.stitch))fail(`object ${o.id} has an invalid thread color or stitch type.`);if(o.stitch==='satin'&&(o.kind!=='path'||(o.satinWidth!==undefined&&!(Number.isFinite(o.satinWidth)&&o.satinWidth>=.5&&o.satinWidth<=12))))fail(`satin stitching needs a path and a column width of 0.5–12 mm (${o.id}).`);if(o.satinWidth!==undefined&&o.kind!=='path')fail(`object ${o.id} cannot have a satin width.`);
    if(!Number.isFinite(o.rotation??0)||(o.rotation??0)<-360||(o.rotation??0)>360)fail(`object ${o.id} has invalid rotation.`);
    if(![o.x,o.y].every(Number.isFinite)||Math.abs(o.x)>1000||Math.abs(o.y)>1000)fail(`object ${o.id} has invalid coordinates.`);
    if(o.groupId!==undefined&&(typeof o.groupId!=='string'||!o.groupId||o.groupId.length>100))fail(`object ${o.id} has an invalid group.`);
    if(o.along!==undefined&&(o.kind!=='text'||!o.along||typeof o.along!=='object'||typeof o.along.closed!=='boolean'||!Number.isFinite(o.along.offset)||!Array.isArray(o.along.points)||o.along.points.length<2||o.along.points.length>1500||o.along.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1000))))fail(`lettering ${o.id} has an invalid text-on-path attachment.`);
    {const inRange=(v,lo,hi)=>v===undefined||(Number.isFinite(v)&&v>=lo&&v<=hi),types=['none','auto','contour','fill','contour+fill','center','zigzag','center+zigzag','contour+zigzag','center+contour','center+contour+zigzag'];
      if(o.fillMethod!==undefined&&!['rows','contour','spiral','meander','guided','cross','ripple','motif'].includes(o.fillMethod))fail(`object ${o.id} fillMethod must be rows, contour, spiral, meander, guided, cross or ripple.`);
      if(o.rippleCenter!==undefined&&!(Array.isArray(o.rippleCenter)&&o.rippleCenter.length===2&&o.rippleCenter.every(v=>Number.isFinite(v)&&v>=-1&&v<=2)))fail(`object ${o.id} rippleCenter must be [x, y] fractions of the object's bounding box.`);
      if(o.guide!==undefined&&!(Array.isArray(o.guide)&&o.guide.length>=2&&o.guide.length<=50&&o.guide.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=-1&&v<=2))))fail(`object ${o.id} guide needs 2–50 [x, y] points as fractions of the object's bounding box.`);
      for(const k of ['startAt','endAt'])if(o[k]!==undefined&&!(Array.isArray(o[k])&&o[k].length===2&&o[k].every(v=>Number.isFinite(v)&&v>=0&&v<=1)))fail(`object ${o.id} ${k} must be [x, y] fractions (0–1) of the object's bounding box.`);
      if(o.compensation!==undefined&&!inRange(o.compensation,0,2))fail(`object ${o.id} needs a pull compensation of 0–2 mm.`);
      if(o.photo!==undefined){const ph=o.photo;if(!(o.kind==='rect'&&o.stitch==='fill')||!ph||typeof ph!=='object'||!Number.isInteger(ph.pw)||!Number.isInteger(ph.ph)||ph.pw<2||ph.ph<2||ph.pw>320||ph.ph>320||typeof ph.data!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(ph.data)||Math.floor(ph.data.length*3/4)<ph.pw*ph.ph-2||ph.data.length>140000)fail(`object ${o.id} has an invalid photo (a rectangle with a grey picture of up to 320 × 320 samples).`);
        if(ph.thread2!==undefined&&!color.test(ph.thread2)||ph.thread3!==undefined&&(!color.test(ph.thread3)||ph.thread2===undefined))fail(`object ${o.id} has an invalid photo second or third thread (a third thread needs a second).`);
        if(ph.thread4!==undefined&&(!color.test(ph.thread4)||ph.thread3===undefined))fail(`object ${o.id} has an invalid photo fourth thread (a fourth thread needs a third).`);
        if(ph.spacing!==undefined&&!inRange(ph.spacing,.3,2)||ph.contrast!==undefined&&!inRange(ph.contrast,.4,3)||ph.invert!==undefined&&typeof ph.invert!=='boolean')fail(`object ${o.id} has invalid photo settings.`);}
      if(o.underpath!==undefined&&typeof o.underpath!=='boolean')fail(`object ${o.id} underpath must be true or false.`);
      if(o.runStyle!==undefined&&!['single','bean','redwork'].includes(o.runStyle))fail(`object ${o.id} runStyle must be single, bean or redwork.`);
      if(o.lengthVariance!==undefined&&!inRange(o.lengthVariance,0,.5))fail(`object ${o.id} needs a stitch length variance of 0–0.5.`);
      if(o.crossSize!==undefined&&!inRange(o.crossSize,1,8))fail(`object ${o.id} needs a cross stitch size of 1–8 mm.`);
      if(o.applique!==undefined&&!(typeof o.applique==='boolean'&&(!o.applique||(o.stitch==='fill'&&o.kind!=='text'&&o.kind!=='stitch_layer'&&(o.kind!=='path'||o.closed)))))fail(`object ${o.id} can only be an appliqué if it is a closed filled shape.`);
      if(o.appliqueWidth!==undefined&&!inRange(o.appliqueWidth,1,8))fail(`object ${o.id} needs an appliqué cover width of 1–8 mm.`);
      if(!inRange(o.stitchLength,.5,7))fail(`object ${o.id} needs a fill stitch length of 0.5–7 mm.`);if(o.stagger!==undefined&&!(Number.isInteger(o.stagger)&&o.stagger>=1&&o.stagger<=8))fail(`object ${o.id} needs a stagger of 1–8 (whole number).`);
      if(o.edgeClose!==undefined&&typeof o.edgeClose!=='boolean')fail(`object ${o.id} edgeClose must be true or false.`);if(o.motifShape!==undefined&&!['circle','leaf'].includes(o.motifShape))fail(`object ${o.id} has an unknown motif shape.`);if(o.blingShape!==undefined&&!['round','square'].includes(o.blingShape))fail(`object ${o.id} has an unknown bling shape.`);if(o.motifSpacing!==undefined&&!inRange(o.motifSpacing,1,20)||o.motifSize!==undefined&&!inRange(o.motifSize,.4,6))fail(`object ${o.id} has a motif spacing or size out of range.`);if(o.underlayType!==undefined&&!types.includes(o.underlayType))fail(`object ${o.id} has an unknown underlay type.`);if(!inRange(o.underlayInset,0,3)||!inRange(o.underlaySpacing,.5,8))fail(`object ${o.id} needs an underlay inset of 0–3 mm and underlay spacing of 0.5–8 mm.`);}
    if(o.angle!==undefined&&!(Number.isFinite(o.angle)&&o.angle>=0&&o.angle<=180)||o.spacing!==undefined&&!(Number.isFinite(o.spacing)&&o.spacing>=.25&&o.spacing<=1.2))fail(`object ${o.id} has a fill angle outside 0–180° or row spacing outside 0.25–1.2 mm.`);
    if(o.border!==undefined&&typeof o.border!=='boolean'||o.borderThread!==undefined&&!color.test(o.borderThread))fail(`object ${o.id} has an invalid border.`);
    if(o.visible!==undefined&&typeof o.visible!=='boolean'||o.locked!==undefined&&typeof o.locked!=='boolean')fail(`object ${o.id} has invalid visibility or lock state.`);
    if(o.kind==='path'){if(![o.w,o.h].every(Number.isFinite)||o.w<0||o.h<0||o.w>2000||o.h>2000)fail(`path ${o.id} has invalid geometry bounds.`);if(o.closed!==undefined&&typeof o.closed!=='boolean'||o.smooth!==undefined&&typeof o.smooth!=='boolean'||(o.closed&&o.points?.length<3))fail(`path ${o.id} has invalid closed/smooth flags.`);if(o.handles!==undefined&&(!Array.isArray(o.handles)||o.handles.length!==o.points?.length||o.handles.some(h=>h!==null&&(!h||![h.i,h.o].every(q=>Array.isArray(q)&&q.length===2&&q.every(v=>Number.isFinite(v)&&Math.abs(v)<=1000))))))fail(`path ${o.id} has invalid node handles.`);if(o.holes!==undefined&&(!o.closed||!Array.isArray(o.holes)||o.holes.length>20||o.holes.some(h=>!Array.isArray(h)||h.length<3||h.length>200||h.some(p=>!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1000)))))fail(`path ${o.id} has invalid holes (closed paths only, up to 20 holes of 3–200 points).`);if(o.stitch==='fill'&&!o.closed)fail(`path ${o.id} needs to be closed to be filled.`);if(!Array.isArray(o.points)||o.points.length<2||o.points.length>1000)fail(`path ${o.id} needs 2–1,000 points.`);pointCount+=o.points.length;if(o.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p.some(v=>Math.abs(v)>1000)))fail(`path ${o.id} contains invalid points.`);}
    else if(!Number.isFinite(o.w)||!Number.isFinite(o.h)||o.w<=0||o.h<=0||o.w>(o.kind==='stitch_layer'?2000:o.kind==='text'?1000:260)||o.h>(o.kind==='stitch_layer'?2000:260))fail(`object ${o.id} needs positive finite dimensions within its supported range.`);
    if(o.kind==='stitch_layer'){
      if(!['jef','vp3','dst'].includes(o.source?.format)||!Array.isArray(o.threads)||o.threads.length<1||o.threads.length>256||!Array.isArray(o.stitches)||o.stitches.length<1||o.stitches.length>250000)fail(`stitch layer ${o.id} exceeds import bounds or has invalid source metadata.`);
      if(!Array.isArray(o.source.bounds)||o.source.bounds.length!==4||o.source.bounds.some(v=>!Number.isFinite(v)||Math.abs(v)>1000)||!o.source.defaultPlacement||!['x','y','w','h'].every(k=>Number.isFinite(o.source.defaultPlacement[k]))||o.source.coordinateMapping!=='source_mm_centered_on_editor_origin'||typeof o.source.fileName!=='string'||o.source.fileName.length>240||!Number.isSafeInteger(o.source.size)||o.source.size<0||o.source.size>1048576||!(o.source.sha256===null||/^[a-f0-9]{64}$/i.test(o.source.sha256))||!color.test(o.source.defaultThread)||o.thread!==o.source.defaultThread&&Object.keys(o.threadOverrides||{}).length===0)fail(`stitch layer ${o.id} has invalid source metadata.`);
      const [bx0,by0,bx1,by1]=o.source.bounds,dw=Math.max(.1,bx1-bx0),dh=Math.max(.1,by1-by0),dp=o.source.defaultPlacement;
      if(dp.x!==-dw/2||dp.y!==-dh/2||dp.w!==dw||dp.h!==dh)fail(`stitch layer ${o.id} has invalid default placement metadata.`);
      if(o.source.originalBytesBase64!==null&&o.source.originalBytesBase64!==undefined&&(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(o.source.originalBytesBase64)||o.source.originalBytesBase64.length>1398104))fail(`stitch layer ${o.id} has invalid preserved source bytes.`);
      if(o.source.originalBytesBase64&&Math.floor(o.source.originalBytesBase64.length*3/4)-(o.source.originalBytesBase64.endsWith('==')?2:o.source.originalBytesBase64.endsWith('=')?1:0)!==o.source.size)fail(`stitch layer ${o.id} source byte count does not match its preserved bytes.`);
      sourceByteCount+=o.source.size;if(sourceByteCount>2097152)fail('combined preserved machine source bytes exceed 2 MiB.');
      if(!Array.isArray(o.source.warnings)||o.source.warnings.length>100||o.source.warnings.some(v=>typeof v!=='string'||v.length>500))fail(`stitch layer ${o.id} has invalid reader warnings.`);
      if(o.threads.some((t,i)=>!t||Array.isArray(t)||typeof t!=='object'||t.index!==i||!(t.color===null||color.test(t.color))||Object.entries(t).length>24||Object.entries(t).some(([k,v])=>k.length>64||!(v===null||typeof v==='string'&&v.length<=240||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)))))fail(`stitch layer ${o.id} has invalid ordered thread metadata.`);
      stitchCommandCount+=o.stitches.length;if(stitchCommandCount>250000)fail('total imported stitch command count exceeds 250,000.');let sewable=false,ended=false,endCount=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const s of o.stitches){if(!s||Array.isArray(s)||Object.keys(s).sort().join(',')!=='cmd,thread,x,y'||!['stitch','jump','trim','color','stop','end'].includes(s.cmd)||!Number.isFinite(s.x)||!Number.isFinite(s.y)||Math.abs(s.x)>1000||Math.abs(s.y)>1000||!Number.isInteger(s.thread)||s.thread<0||s.thread>=o.threads.length)fail(`stitch layer ${o.id} contains an invalid command.`);if(ended)fail(`stitch layer ${o.id} has commands after end.`);minX=Math.min(minX,s.x);minY=Math.min(minY,s.y);maxX=Math.max(maxX,s.x);maxY=Math.max(maxY,s.y);if(s.cmd==='stitch')sewable=true;if(s.cmd==='end'){ended=true;endCount++;}}
      if(minX!==bx0||minY!==by0||maxX!==bx1||maxY!==by1)fail(`stitch layer ${o.id} source bounds do not match its command coordinates.`);
      if(!sewable)fail(`stitch layer ${o.id} has no needle stitches.`);if(!ended||endCount!==1)fail(`stitch layer ${o.id} must have exactly one terminal end command.`);
      if(o.threadOverrides===undefined)o.threadOverrides={};
      if(!o.threadOverrides||typeof o.threadOverrides!=='object'||Array.isArray(o.threadOverrides)||Object.entries(o.threadOverrides).some(([i,v])=>!/^\d+$/.test(i)||Number(i)>=o.threads.length||!color.test(v)))fail(`stitch layer ${o.id} has invalid thread replacements.`);
    }
    if(o.kind==='text'&&(typeof o.text!=='string'||!o.text.trim()||[...o.text].length>(isRegistryFont(o.font)?MAX_TEXT_CHARS:24)||!Number.isFinite(o.h)||(isRegistryFont(o.font)?(()=>{const f=getFont(o.font);return f?o.h<f.size*f.minScale-1e-6||o.h>f.size*f.maxScale+1e-6:o.h<2||o.h>200;})():(o.font==='neon-blinking/1')?(o.h<20||o.h>60):(o.h<4||o.h>16))))fail(`lettering ${o.id} has unsupported text or size (Welcome Mono 4–16 mm; Néon blinking 20–60 mm; other fonts follow their own size range).`);
    if(o.kind==='text'){const num=(v,lo,hi)=>v===undefined||(Number.isFinite(v)&&v>=lo&&v<=hi);if(!num(o.tracking,-10,30)||!num(o.wordSpacing,-10,50)||!num(o.lineHeight,.5,3)||!num(o.italic,0,35)||!num(o.bold,0,3)||(o.align!==undefined&&!['left','center','right'].includes(o.align)))fail(`lettering ${o.id} has an invalid letter spacing, word spacing, line height, italic, bold or alignment value.`);if([...String(o.text)].filter(c=>c==='\n').length>=6)fail(`lettering ${o.id} has too many lines (6 maximum).`);}
    if(o.kind==='text'&&!['welcom-mono/1','neon-blinking/1',undefined].includes(o.font)&&!(isRegistryFont(o.font)&&(!o.font.startsWith('custom/')||doc.customFonts?.[o.font.slice(7)])))fail(`lettering ${o.id} selects an unsupported or missing font.`);
  }
  if(pointCount>5000)fail('total path point count exceeds 5,000.');
  return doc;
}

// ---- stitch planning per object: underlay, auto-fill, satin ---------------------------------------------------
const distP=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ringArea=r=>{let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(a/2);};
function shapeArea(rings){const as=rings.map(ringArea).sort((a,b)=>b-a);return Math.max(0,as[0]-as.slice(1).reduce((n,v)=>n+v,0));}
function underlayTypes(o,doc,kind,metric){
  let t=o.underlayType;if(t===undefined)t=doc.settings.underlay===false?'none':(doc.settings.underlayType??'auto');
  const set=t==='none'?new Set():t==='auto'?new Set(kind==='fill'?(metric>=40?['contour','fill']:['contour']):(metric<2?['center']:metric<4.5?['contour']:['contour','zigzag'])):new Set(String(t).split('+').filter(x=>(kind==='fill'?['contour','fill']:['center','contour','zigzag']).includes(x)));
  if(o.raised&&kind==='satin')for(const x of ['center','zigzag'])set.add(x);
  return set;
}
// Open runs start at their nearer end; closed rings (contour underlay) are rotated to start at their point nearest to the needle.
const orientRuns=(runs,from,rotateLoops=false)=>{let cur=from;return runs.map(r=>{let pts=r.pts;if(cur&&rotateLoops&&r.loop&&pts.length>3){let k=0,best=Infinity;pts.forEach((p,i)=>{const d=distP(cur,p);if(d<best){best=d;k=i;}});pts=[...pts.slice(k),...pts.slice(0,k)];}else if(cur&&pts.length>3&&distP(pts[0],pts.at(-1))<1e-6){let k=0,best=Infinity;pts.forEach((p,i)=>{const d=distP(cur,p);if(d<best){best=d;k=i;}});if(k&&k<pts.length-1)pts=[...pts.slice(k,-1),...pts.slice(0,k+1)];}else if(cur&&distP(cur,pts[0])>distP(cur,pts.at(-1)))pts=[...pts].reverse();cur=pts.at(-1);return {...r,pts};});};
// Fill: [contour underlay] -> [tatami underlay at 90°] -> top fill planned as a routed auto-fill. All parameters can be set per object.
const pinCache=new WeakMap();
// startAt / endAt are fractions of the object's bounding box, so they follow the object when it moves or scales. Lettering sews glyph by glyph and ignores them.
function pinPoint(o,f){if(!f||o.kind==='text')return null;let b=pinCache.get(o);if(!b){b=objectBounds(o);pinCache.set(o,b);}return [b[0]+f[0]*(b[2]-b[0]),b[1]+f[1]*(b[3]-b[1])];}
const reverseRuns=runs=>[...runs].reverse().map(r=>({...r,pts:[...r.pts].reverse()}));
function fillRuns(rings,o,doc,comp,from=null){
  const sPt=pinPoint(o,o.startAt),ePt=pinPoint(o,o.endAt);if(sPt)from=sPt;
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return {under:[],top:[]};
  const sp=o.spacing??doc.settings.spacing,an=o.angle??doc.settings.angle,L=o.stitchLength??doc.settings.stitchLength??3,st=o.stagger??doc.settings.stagger??4,area=shapeArea(closed),perimeter=closed.reduce((n,r)=>n+r.reduce((m,p,i)=>i?m+distP(p,r[i-1]):0,0),0),meanWidth=perimeter?2*area/perimeter:0,types=meanWidth<1.4?new Set():underlayTypes(o,doc,'fill',area),under=[];
  if(types.has('contour'))under.push(...planContour(closed,{inset:(o.underlayInset??.4)+comp}));
  if(types.has('fill'))under.push(...planFillUnderlay(closed,{angle:an+90,spacing:o.underlaySpacing??2.2,length:3.5,inset:(o.underlayInset??.6)+comp}));
  const oriented=orientRuns(under,from),last=oriented.at(-1)?.pts.at(-1)??from,inside=makeInside(closed),fillOpts={spacing:sp,angle:an,length:L,stagger:st,variance:o.lengthVariance??0,underpath:o.underpath??true};
  const guide=o.fillMethod==='guided'&&o.guide?o.guide.map(f=>pinPoint(o,f)).filter(Boolean):null,
    planTop=(at,rs=closed)=>{switch(o.fillMethod){case 'contour':return planContourFill(rs,{spacing:sp,length:L,from:at});case 'spiral':return planSpiralFill(rs,{spacing:sp,length:L,from:at});case 'meander':return planMeanderFill(rs,{spacing:sp,length:L,from:at});case 'ripple':{const rc=pinPoint(o,o.rippleCenter||[.5,.5]);return clipRuns(planRippleFill(rs,{spacing:sp,length:L,center:rc,from:at}),rs.map(closeRing));}case 'cross':return planCrossStitch(rs,{size:o.crossSize??2.5,from:at});case 'motif':return motifFillRuns(rs,o.motifSpacing??4,(o.motifSize??1.6)/2);case 'guided':return guide&&guide.length>=2?planGuidedFill(rs,guide,{...fillOpts,from:at}):planFill(rs,{...fillOpts,from:at});default:return planFill(rs,{...fillOpts,from:at});}};
  // Colour blend: the rows are shared between two threads by an ordered dither whose share of the second thread grows across the rows (from blendStart to blendEnd of the shape's height).
  const rowBlend=Boolean(o.blendThread)&&(!o.fillMethod||o.fillMethod==='rows')&&o.blendAngle===undefined,bandBlend=(Boolean(o.blendThread)&&!rowBlend)||Boolean(o.blendPalette);
  const blended=rowBlend;
  const isB=(k,y,y0,y1)=>{const s0=o.blendStart??0,s1=o.blendEnd??1,u=(y1>y0?(y-y0)/(y1-y0):.5),t=Math.max(0,Math.min(1,s1===s0?(u>=s0?1:0):(u-s0)/(s1-s0))),g=((k+1)*0.6180339887)%1;return g<t;};
  // Band blend (any direction, any pattern): the shape is cut into thin strips across the blend direction and the strips are shared between the two threads by the same ordered dither.
  if(bandBlend){const ang=((o.blendAngle??(an+90))*Math.PI/180),dir=[Math.cos(ang),Math.sin(ang)],perp=[-dir[1],dir[0]],pts=closed.flat(),us=pts.map(p=>p[0]*dir[0]+p[1]*dir[1]),vs=pts.map(p=>p[0]*perp[0]+p[1]*perp[1]),u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs)-1,v1=Math.max(...vs)+1,bw=Math.max(.8,sp*2),nb=Math.max(1,Math.ceil((u1-u0)/bw)),polys=[];
    if(o.blendPalette){const N=o.blendPalette.length,groups=o.blendPalette.map(()=>[]),shape=closed.map(closeRing);
      for(let i=0;i<nb;i++){const t0=o.blendStart??0,t1=o.blendEnd??1,u=(i+.5)/nb,t=Math.max(0,Math.min(1,t1===t0?(u>=t0?1:0):(u-t0)/(t1-t0))),g=((i+1)*0.6180339887)%1,p=t*(N-1),lo=Math.min(N-2,Math.floor(p)),a=u0+i*bw,b=Math.min(u1+1e-6,u0+(i+1)*bw+.02),P=(uu,vv)=>[dir[0]*uu+perp[0]*vv,dir[1]*uu+perp[1]*vv];groups[g<p-lo?lo+1:lo].push([[P(a,v0),P(b,v0),P(b,v1),P(a,v1),P(a,v0)]]);}
      let at=last;const runs=groups.map(strips=>{let rs=[];try{rs=strips.length?polygonClipping.intersection(shape,polygonClipping.union(...strips)).flatMap(pg=>pg):[];}catch{rs=[];}const r=rs.length?planTop(at,rs):[];at=r.at(-1)?.pts.at(-1)??at;return chainRuns(r,28,inside);});
      return {under:[],top:chainRuns(oriented,28,inside),groups:runs};}
    for(let i=0;i<nb;i++){const t0=o.blendStart??0,t1=o.blendEnd??1,u=(i+.5)/nb,t=Math.max(0,Math.min(1,t1===t0?(u>=t0?1:0):(u-t0)/(t1-t0))),g=((i+1)*0.6180339887)%1;if(g>=t)continue;const a=u0+i*bw,b=Math.min(u1+1e-6,u0+(i+1)*bw+.02),P=(uu,vv)=>[dir[0]*uu+perp[0]*vv,dir[1]*uu+perp[1]*vv];polys.push([[P(a,v0),P(b,v0),P(b,v1),P(a,v1),P(a,v0)]]);}
    let Brs=[],Ars=closed;if(polys.length){try{const mask=polygonClipping.union(...polys),shape=closed.map(closeRing);Brs=polygonClipping.intersection(shape,mask).flatMap(pg=>pg);Ars=polygonClipping.difference(shape,mask).flatMap(pg=>pg);}catch{Brs=[];Ars=closed;}}
    const A=Ars.length?planTop(last,Ars):[],endA=A.at(-1)?.pts.at(-1)??last,B=Brs.length?planTop(endA,Brs):[];
    return {under:[],top:chainRuns([...oriented,...A],28,inside),top2:chainRuns(B,28,inside)};}
  if(blended){const A=planFill(closed,{...fillOpts,from:last,rowPick:(k,y,a,b)=>!isB(k,y,a,b)}),endA=A.at(-1)?.pts.at(-1)??last,B=planFill(closed,{...fillOpts,from:endA,rowPick:isB});
    return {under:[],top:chainRuns([...oriented,...A],28,inside),top2:chainRuns(B,28,inside)};}
  let topPlan=planTop(last);
  // End point: plan from the end point and reverse (it then finishes there); keep whichever plan starts and ends closer to what was asked for.
  if(ePt&&topPlan.length){const alt=reverseRuns(planTop(ePt)),score=r=>(last?distP(r[0].pts[0],last)*(sPt?3:.25):0)+distP(r.at(-1).pts.at(-1),ePt)*3;if(alt.length&&score(alt)<score(topPlan))topPlan=alt;}
  return {under:[],top:chainRuns([...oriented,...topPlan],28,inside)};
}
// Satin between two rails: [centre walk] [contour walk] [zigzag] underlay, then the column itself.
// Motif loops: a small closed loop every few mm along the path, sewn as one run.
// A loop ring at p: a circle, or a leaf whose long axis (ux,uy) follows the path so the motif warps with the curve.
function loopRing(p,ux,uy,radius,shape){return Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;if(shape!=='leaf')return [p[0]+Math.cos(t)*radius,p[1]+Math.sin(t)*radius];const x=Math.cos(t)*radius*1.6,y=Math.sin(t)*radius*.6;return [p[0]+x*ux-y*uy,p[1]+x*uy+y*ux];});}
function pathDirs(pts){return pts.map((p,i)=>{const q=pts[Math.min(i+1,pts.length-1)],r=pts[Math.max(i-1,0)],dx=q[0]-r[0],dy=q[1]-r[1],l=Math.hypot(dx,dy)||1;return [dx/l,dy/l];});}
function motifLoops(line,spacing=4,radius=.8,shape='circle'){const pts=sampleRun(line,spacing),dirs=pathDirs(pts);return pts.map((p,i)=>({pts:loopRing(p,dirs[i][0],dirs[i][1],radius,shape),jump:false}));}
// Paired motif loops: a loop on each side of the centre line, half the satin width away, every few mm.
function motifPairLoops(line,widthOf,spacing=4,radius=.8,shape='circle'){const pts=sampleRun(line,spacing),loops=[];pts.forEach((p,i)=>{const q=pts[Math.min(i+1,pts.length-1)],r=pts[Math.max(i-1,0)],dx=q[0]-r[0],dy=q[1]-r[1],l=Math.hypot(dx,dy)||1,width=widthOf(i/Math.max(1,pts.length-1)),nx=-dy/l*width/2,ny=dx/l*width/2;for(const s of [1,-1])loops.push({pts:loopRing([p[0]+s*nx,p[1]+s*ny],dx/l,dy/l,radius,shape),jump:false});});return loops;}
// Motif fill: one small loop on a staggered grid inside the shape, every row offset by half a spacing.
function motifFillRuns(rings,spacing,radius=.8){const inside=makeInside(rings);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const r of rings)for(const [x,y] of r){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}const out=[];let row=0;for(let y=y0+spacing/2;y<=y1;y+=spacing,row++)for(let x=x0+(row%2?spacing/2:0);x<=x1;x+=spacing)if(inside([x,y],[x+.01,y]))out.push({pts:Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;return [x+Math.cos(t)*radius,y+Math.sin(t)*radius];}),jump:false});return out;}
// Sequins: a centre stitch with a fixing loop around it, every few mm along the path.
function sequinRuns(line,spacing=8,radius=1.5){return sampleRun(line,spacing).flatMap(p=>[{pts:[p,[p[0]+.01,p[1]]],jump:false},{pts:Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;return [p[0]+Math.cos(t)*radius,p[1]+Math.sin(t)*radius];}),jump:false}]);}
// Beads: short passes back and forth across the path at each point, the way beads are sewn on.
function beadRuns(line,spacing=6,length=2){const pts=sampleRun(line,spacing),out=[];pts.forEach((p,i)=>{const q=pts[Math.min(i+1,pts.length-1)],r=pts[Math.max(i-1,0)],dx=q[0]-r[0],dy=q[1]-r[1],l=Math.hypot(dx,dy)||1,ux=dx/l*length/2,uy=dy/l*length/2;for(let k=0;k<3;k++)out.push({pts:[[p[0]-ux,p[1]-uy],[p[0]+ux,p[1]+uy]],jump:false});});return out;}
// Bling: a stone at each point, a centre stitch with two concentric fixing rings (round, or square of the same width: size is the stone's width).
function blingRuns(line,spacing=8,size=4,shape='round'){const ring=(p,r)=>({pts:Array.from({length:13},(_,k)=>{const t=k/12*Math.PI*2;return [p[0]+Math.cos(t)*r,p[1]+Math.sin(t)*r];}),jump:false});const square=(p,s)=>{const h=s/2;return {pts:[[p[0]-h,p[1]-h],[p[0]+h,p[1]-h],[p[0]+h,p[1]+h],[p[0]-h,p[1]+h],[p[0]-h,p[1]-h]],jump:false};};return sampleRun(line,spacing).flatMap(p=>[{pts:[p,[p[0]+.01,p[1]]],jump:false},...(shape==='square'?[square(p,size),square(p,size*2/3)]:[ring(p,size/2),ring(p,size/3)])]);}
// Bar tack across the end of a buttonhole: a short zigzag between the two rails, stepping outwards from the column.
function bartack(a,b,na,nb,jump){const dx=a[0]-na[0],dy=a[1]-na[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l,pts=[];for(let k=0;k<6;k++){const p=k%2?b:a,s=Math.floor(k/2)*.35;pts.push([p[0]+ux*s,p[1]+uy*s]);}return [{pts,jump}];}
function satinRuns(a,b,rungs,o,doc,spacing,comp,from=null){
  const sPt=pinPoint(o,o.startAt),ePt=pinPoint(o,o.endAt);if(sPt)from=sPt;
  const {zig,pairs}=satinFromRails(a,b,spacing,comp,rungs);if(zig.length<2)return {under:[],top:[]};
  // Rails that cannot be paired sensibly (stitches longer than a machine accepts) are reported so the caller can sew the column as a fill instead.
  if(zig.some((p,i)=>i&&distP(p,zig[i-1])>12.2))return {bad:true,under:[],top:[]};
  const widths=pairs.map(([p,q])=>distP(p,q)).sort((x,y)=>x-y),w=widths[Math.floor(widths.length/2)]||0,types=underlayTypes(o,doc,'satin',w),inset=Math.min(o.underlayInset??.35,w*.22),towards=(p,q,d)=>{const l=distP(p,q)||1;return [p[0]+(q[0]-p[0])/l*d,p[1]+(q[1]-p[1])/l*d];};
  const under=[];
  if(types.has('center'))under.push({pts:sampleRun(pairs.map(([p,q])=>[(p[0]+q[0])/2,(p[1]+q[1])/2]),2.5)});
  if(types.has('contour')){const A=pairs.map(([p,q])=>towards(p,q,inset)),B=pairs.map(([p,q])=>towards(q,p,inset));under.push({pts:sampleRun([...A,...B.reverse()],2.5),loop:true});}
  if(types.has('zigzag')){const step=Math.max(.8,o.underlaySpacing??2),pts=[];let acc=step,flip=0;pairs.forEach(([p,q],i)=>{if(i)acc+=distP(pairs[i-1][0],p);if(i===0||acc>=step||i===pairs.length-1){if(i)acc=0;pts.push(flip++%2?towards(q,p,inset):towards(p,q,inset));}});if(pts.length>1)under.push({pts});}
  // A requested start or end point fixes the sewing direction of the column: the underlay starts at the top's first end and open underlay runs go there and back, so the top starts where the underlay stops.
  if(sPt||ePt){const fwd=(sPt?distP(zig[0],sPt):0)+(ePt?distP(zig.at(-1),ePt):0),bwd=(sPt?distP(zig.at(-1),sPt):0)+(ePt?distP(zig[0],ePt):0),top=bwd<fwd?[...zig].reverse():zig,oriented=orientRuns(under,top[0],true).map(r=>r.loop||distP(r.pts[0],r.pts.at(-1))<1e-6?r:{...r,pts:[...r.pts,...r.pts.slice(0,-1).reverse()]});return {under:[],top:chainRuns([...oriented,{pts:top}],8)};}
  const oriented=orientRuns(under,from),end=oriented.at(-1)?.pts.at(-1)??from,top=end&&distP(end,zig[0])>distP(end,zig.at(-1))?[...zig].reverse():zig;
  return {under:[],top:chainRuns([...oriented,{pts:top}],8)};
}
// Rails of a satin column drawn as a centre line with a width.
// Rails of a satin column drawn along a line. `halfAt(t)` is the half width at fraction t (0..1) of the length, so columns can taper or follow a width profile.
// Corners get a join (round, miter or bevel) and open ends a cap (butt, round or square). The pairs that matter at corners and caps are returned as rungs so
// the needles fan around the inner corner instead of being paired by length.
export function railsFromLine(line,halfAt,opt={}){
  const join=opt.join||'round',capS=opt.capStart||opt.cap||'butt',capE=opt.capEnd||opt.cap||'butt',closed=Boolean(opt.closed);
  const pts=[];for(const p of line)if(!pts.length||distP(p,pts.at(-1))>1e-6)pts.push([p[0],p[1]]);
  if(closed&&pts.length>2&&distP(pts[0],pts.at(-1))<1e-6)pts.pop();
  const n=pts.length;if(n<2)return null;
  const segs=closed?n:n-1,dirs=[],lens=[],cum=[0];
  for(let i=0;i<segs;i++){const a=pts[i],b=pts[(i+1)%n],l=distP(a,b);lens.push(l);dirs.push([(b[0]-a[0])/l,(b[1]-a[1])/l]);cum.push(cum[i]+l);}
  const total=cum[segs];if(total<.2)return null;
  const A=[],B=[],rungs=[],left=d=>[-d[1],d[0]],hw=s=>Math.max(.25,halfAt(Math.min(1,Math.max(0,s/total))));
  const emit=(pa,pb,rung=false)=>{A.push(pa);B.push(pb);if(rung)rungs.push([pa,pb]);};
  const off=(P,d,h)=>{const nrm=left(d);return [[P[0]+nrm[0]*h,P[1]+nrm[1]*h],[P[0]-nrm[0]*h,P[1]-nrm[1]*h]];};
  const cap=(P,d,h,kind,atStart)=>{ // pairs beyond the end point, ordered along the rails
    if(kind==='butt'){const [pa,pb]=off(P,d,h);emit(pa,pb,true);return;}
    const m=Math.max(2,Math.ceil(h/.3)),out=[];
    for(let k=0;k<=m;k++){const x=h*(1-k/m),w=kind==='round'?h*Math.sqrt(Math.max(0,1-(x/h)**2)):h,c=[P[0]+(atStart?-1:1)*d[0]*x,P[1]+(atStart?-1:1)*d[1]*x],[pa,pb]=off(c,d,w);out.push([pa,pb]);}
    if(atStart){out.forEach(([pa,pb],k)=>emit(pa,pb,k===0||k===out.length-1));}
    else{out.reverse().forEach(([pa,pb],k)=>emit(pa,pb,k===0||k===out.length-1));}
  };
  const corner=(P,dp,dn,s,minLen)=>{
    const h=hw(s),cross=dp[0]*dn[1]-dp[1]*dn[0],dot=dp[0]*dn[0]+dp[1]*dn[1],ang=Math.atan2(cross,dot),np=left(dp),nn=left(dn);
    let mx=np[0]+nn[0],my=np[1]+nn[1];const ml=Math.hypot(mx,my);
    if(Math.abs(ang)<.3||ml<1e-6){if(ml<1e-6){const [pa,pb]=off(P,dn,h);emit(pa,pb);return;}mx/=ml;my/=ml;const k=h/Math.cos(ang/2);emit([P[0]+mx*k,P[1]+my*k],[P[0]-mx*k,P[1]-my*k]);return;}
    mx/=ml;my/=ml;
    const so=cross>0?-1:1,innerD=Math.min(h/Math.cos(ang/2),Math.max(.2,minLen*.9)+h),inner=[P[0]-so*mx*innerD,P[1]-so*my*innerD];
    const pair=(outer,rung)=>{if(cross>0)emit(inner,outer,rung);else emit(outer,inner,rung);};
    const o0=[P[0]+so*np[0]*h,P[1]+so*np[1]*h],o1=[P[0]+so*nn[0]*h,P[1]+so*nn[1]*h];
    if(join==='miter'&&Math.cos(ang/2)>=1/3&&innerD+h/Math.cos(ang/2)<=11.5){pair([P[0]+so*mx*h/Math.cos(ang/2),P[1]+so*my*h/Math.cos(ang/2)],true);}
    else if(join==='round'){const t0=Math.atan2(so*np[1],so*np[0]);let dl=Math.atan2(so*nn[1],so*nn[0])-t0;while(dl>Math.PI)dl-=2*Math.PI;while(dl<-Math.PI)dl+=2*Math.PI;const k=Math.max(2,Math.ceil(Math.abs(dl)*h/.4));for(let j=0;j<=k;j++){const t=t0+dl*j/k;pair([P[0]+Math.cos(t)*h,P[1]+Math.sin(t)*h],j===0||j===k);}}
    else{pair(o0,true);pair(o1,true);}
  };
  // where the inner rails meet at a sharp corner, the offset lines end earlier than the segment does
  const setback=Array.from({length:n},(_,i)=>{if(!closed&&(i===0||i===n-1))return 0;const dp=dirs[(i+segs-1)%segs],dn=dirs[i%segs],ang=Math.atan2(dp[0]*dn[1]-dp[1]*dn[0],dp[0]*dn[0]+dp[1]*dn[1]);return Math.abs(ang)<.3?0:Math.min(hw(cum[i])*Math.abs(Math.tan(ang/2)),lens[(i+segs-1)%segs]/2,lens[i%segs]/2);});
  const along=(i,from0,to0)=>{const from=from0+setback[i],to=to0-setback[(i+1)%n],step=.5,m=Math.floor((to-from)/step);for(let k=1;k<m;k++){const u=from+(to-from)*k/m,P=[pts[i][0]+dirs[i][0]*u,pts[i][1]+dirs[i][1]*u],[pa,pb]=off(P,dirs[i],hw(cum[i]+u));emit(pa,pb);}};
  if(closed)corner(pts[0],dirs[segs-1],dirs[0],0,Math.min(lens[segs-1],lens[0]));else cap(pts[0],dirs[0],hw(0),capS,true);
  if(!closed){const [pa,pb]=off(pts[0],dirs[0],hw(0));emit(pa,pb,true);}
  for(let i=0;i<segs;i++){
    along(i,0,lens[i]);
    if(i<segs-1)corner(pts[i+1],dirs[i],dirs[i+1],cum[i+1],Math.min(lens[i],lens[i+1]));
    else if(!closed){const [pa,pb]=off(pts.at(-1),dirs[i],hw(total));emit(pa,pb,true);cap(pts.at(-1),dirs[i],hw(total),capE,false);}
  }
  if(closed){A.push(A[0]);B.push(B[0]);}
  return {a:A,b:B,rungs};
}
// Width of a satin path at fraction t: a width profile (`widthStops`, smooth between stops) wins over the plain start/end taper.
export function widthAt(o,t){const st=o.widthStops;if(Array.isArray(st)&&st.length){if(t<=st[0][0])return st[0][1];for(let i=1;i<st.length;i++)if(t<=st[i][0]){const f=(t-st[i-1][0])/((st[i][0]-st[i-1][0])||1),e=f*f*(3-2*f);return st[i-1][1]+(st[i][1]-st[i-1][1])*e;}return st.at(-1)[1];}
  const w0=Math.max(.5,Number(o.satinWidth)||3),w1=Math.max(.5,Number(o.satinWidthEnd)||w0);return w0+(w1-w0)*t;}
function railsFromCenterline(o){return railsFromLine(pathOutline(o),t=>widthAt(o,t)/2,{join:o.join,cap:o.cap,closed:Boolean(o.closed)});}
export function compile(doc) {
  validateDocument(doc);
  const spacing=doc.settings.spacing,angle=doc.settings.angle,comp=doc.settings.compensation,hoop=hoopSize(doc);
  registerDocumentFonts(doc);const unloaded=doc.objects.find(o=>o.kind==='text'&&isRegistryFont(o.font)&&!getFont(o.font));if(unloaded)throw Error(`Font ${unloaded.font} is not loaded yet. Open it in the editor or wait for it to load, then try again.`);
  const missing=[...new Set(doc.objects.filter(o=>o.kind==='text'&&o.font!=='neon-blinking/1'&&!isRegistryFont(o.font)).flatMap(o=>[...String(o.text||'').toUpperCase()]).filter(ch=>ch!==' '&&!GLYPHS[ch]))];
  if(missing.length)throw Error(`The bundled single-line alphabet does not support: ${missing.join(' ')}. Use A–Z, 0–9 and spaces.`);
  const records=[],errors=[],issues=[];let complexity=0,overall=[Infinity,Infinity,-Infinity,-Infinity];
  for(const o of doc.objects){
    if(o.visible===false||o.mask)continue;
    const comp=o.compensation??doc.settings.compensation;
    if(o.kind==='stitch_layer'){
      const [sx0,sy0,sx1,sy1]=o.source.bounds,sx=o.w/Math.max(.1,sx1-sx0),sy=o.h/Math.max(.1,sy1-sy0),a=(Number(o.rotation)||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2;
      const corners=[[sx0,sy0],[sx1,sy0],[sx1,sy1],[sx0,sy1]].map(([x,y])=>{const lx=(x-(sx0+sx1)/2)*sx,ly=(y-(sy0+sy1)/2)*sy;return [cx+lx*c-ly*sn,cy+lx*sn+ly*c];});const b=[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];overall=[Math.min(overall[0],b[0]),Math.min(overall[1],b[1]),Math.max(overall[2],b[2]),Math.max(overall[3],b[3])];if(b[0]<-hoop.w/2||b[1]<-hoop.h/2||b[2]>hoop.w/2||b[3]>hoop.h/2){const m=`Object ${o.name||o.id} exceeds the selected ${hoopLabel(hoop)} hoop.`;errors.push(m);issues.push({id:o.id,message:m});};records.push({o,stitchLayer:true});complexity+=o.stitches.length;continue;
    }
    const satin=o.stitch==='satin'&&o.kind==='path',rails=satin?railsFromCenterline(o):null,lines=satin?(rails?[[...rails.a,...rails.b].map(([x,y])=>[x,y])]:[]):geometry(o,o.stitch==='fill'&&o.kind!=='text'?comp:0),points=lines.flat();if(!points.length)continue;
    const maskObj=o.clipId?doc.objects.find(v=>v.id===o.clipId):null,maskRings=maskObj?geometry(maskObj,0).map(closeRing):null;
    const b=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
    overall=[Math.min(overall[0],b[0]),Math.min(overall[1],b[1]),Math.max(overall[2],b[2]),Math.max(overall[3],b[3])];
    if(b[0]<-hoop.w/2||b[1]<-hoop.h/2||b[2]>hoop.w/2||b[3]>hoop.h/2){const m=`Object ${o.name||o.id} exceeds the selected ${hoopLabel(hoop)} hoop.`;errors.push(m);issues.push({id:o.id,message:m});};
    if(o.stitch==='fill'&&o.kind!=='text')complexity+=Math.ceil((b[3]-b[1])/spacing)*points.length;
    const clippedFill=maskRings&&o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed),useLines=clippedFill?clipLines(lines,maskRings):lines;
    if(clippedFill&&!useLines.length){issues.push({id:o.id,message:`Object ${o.name||o.id} lies outside its clipping mask, so nothing is sewn.`});continue;}
    records.push({o,lines:useLines,satin,rails,maskRings,clippedFill});
  }
  if(complexity>2_000_000)throw Error('Design exceeds the safe digitizing complexity limit. Simplify geometry or increase row spacing.');
  const stitches=[];let previous=null,currentThread=null,lastNeedle=null,position=null,hasImportedLayer=false;
  const push=(x,y,cmd,thread,preserve=false)=>{const rx=round(x),ry=round(y);if(!preserve&&cmd==='stitch'&&lastNeedle&&rx===lastNeedle[0]&&ry===lastNeedle[1])return;if(stitches.length>=250_000)throw Error('Design exceeds the 250,000 stitch safety limit. Simplify geometry or increase row spacing.');stitches.push({x:rx,y:ry,cmd,thread});position=[rx,ry];if(cmd==='stitch')lastNeedle=[rx,ry];};
  const ties=doc.settings.ties===true,trims=doc.settings.trims===true;let lastDir=[1,0];
  // With trims on, any jump of 5 mm or more after sewing is preceded by a thread cut at the last needle position.
  const trimIf=(from,to,thread)=>{if(trims&&lastNeedle&&Math.hypot(to[0]-from[0],to[1]-from[1])>=5)push(lastNeedle[0],lastNeedle[1],'trim',thread);};
  const unit=(a,b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
  // Lock stitches: four 0.4 mm back-and-forth needles. Tie-in runs along the first segment; tie-off runs back along the last one.
  const tieIn=(start,dir,thread)=>{if(!ties)return;const q=[start[0]+dir[0]*.4,start[1]+dir[1]*.4];push(...q,'stitch',thread);push(...start,'stitch',thread);push(...q,'stitch',thread);push(...start,'stitch',thread);};
  const tieOff=thread=>{if(!ties||!lastNeedle)return;const n=lastNeedle,q=[n[0]-lastDir[0]*.4,n[1]-lastDir[1]*.4];push(...q,'stitch',thread);push(...n,'stitch',thread);push(...q,'stitch',thread);push(...n,'stitch',thread);};
  for(const {o,lines,satin,rails,maskRings,clippedFill} of records){
    const comp=o.compensation??doc.settings.compensation;
    if(o.kind==='stitch_layer'){
      hasImportedLayer=true;
      const [sx0,sy0,sx1,sy1]=o.source.bounds,sx=o.w/Math.max(.1,sx1-sx0),sy=o.h/Math.max(.1,sy1-sy0),a=(Number(o.rotation)||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2;
      const firstNeedle=o.stitches.find(s=>s.cmd==='stitch'),firstThread=firstNeedle?(o.threadOverrides[firstNeedle.thread]||o.threads[firstNeedle.thread].color||o.thread):o.thread,firstSewEvent=o.stitches.find(s=>s.cmd==='stitch'||s.cmd==='color'),hasSourceColorBeforeNeedle=firstSewEvent?.cmd==='color';
      if(position&&firstNeedle&&currentThread!==firstThread&&!hasSourceColorBeforeNeedle)push(position[0],position[1],'color',firstThread,true);
      for(const s of o.stitches){const lx=(s.x-(sx0+sx1)/2)*sx,ly=(s.y-(sy0+sy1)/2)*sy,x=cx+lx*c-ly*sn,y=cy+lx*sn+ly*c,thread=o.threadOverrides[s.thread]||o.threads[s.thread].color||o.thread;if(s.cmd==='end'){position=[round(x),round(y)];continue;}push(x,y,s.cmd,thread,true);currentThread=thread;previous=s.cmd==='trim'?null:[round(x),round(y)];}
      continue;
    }
    // Every object becomes ordered runs of needle positions: underlay, top stitching, optional border.
    const filled=!satin&&o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed),runLen=o.stitch==='run'&&o.stitchLength?o.stitchLength:2.5,sp=o.spacing??spacing;
    let top=[],border=[],blend=[],paletteRuns=null,appl=null,photoSecond=false,tail=previous;
    const cursor=()=>previous||tail;
    const bean=pts=>{const out=[pts[0]];for(let i=1;i<pts.length;i++)out.push(pts[i],pts[i-1],pts[i]);return out;},asRun=(line,jump=false)=>{const pts=sampleRun(line,runLen);const redwork=o.runStyle==='redwork'&&o.stitch==='run';return {pts:o.runStyle==='bean'&&o.stitch==='run'?bean(pts):redwork?[...pts,...pts.slice(0,-1).reverse()]:pts,jump};};
    if(satin){const r=rails;if(r){const sat=satinRuns(r.a,r.b,r.rungs||[],o,doc,sp,comp,cursor());top=sat.bad?fillRuns([[...r.a,...[...r.b].reverse()]],o,doc,comp,cursor()).top:[...sat.under,...sat.top];if(o.buttonhole&&r.a.length>1)top=[...bartack(r.a[0],r.b[0],r.a[1],r.b[1],true),...top,...bartack(r.a.at(-1),r.b.at(-1),r.a.at(-2),r.b.at(-2),false)];}}
    else if(o.kind==='text'&&isRegistryFont(o.font)){
      for(const pr of textPrimitives(o)||[]){
        const from=top.at(-1)?.pts.at(-1)??cursor();
        if(pr.t==='r')top.push(asRun(pr.pts,true));
        else if(pr.t==='s'){const sat=satinRuns(pr.a,pr.b,pr.rungs,o,doc,sp,comp,from);let all;if(sat.bad){all=fillRuns([[...pr.a,...[...pr.b].reverse()]],o,doc,comp,from).top;}else all=[...sat.under,...sat.top];if(all.length)all[0].jump=true;top.push(...all);}
        else{const {under,top:t}=fillRuns(pr.rings,o,doc,comp,from);const all=[...under,...t];if(all.length)all[0].jump=true;top.push(...all);}
      }
    }
    else if(o.stitch==='bling'){lines.forEach(line=>{if(line.length>1)top.push(...blingRuns(line,o.motifSpacing??8,o.motifSize??4,o.blingShape??'round'));});}
    else if(o.stitch==='bead'){lines.forEach(line=>{if(line.length>1)top.push(...beadRuns(line,o.motifSpacing??6,o.motifSize??2));});}
    else if(o.stitch==='sequin'){lines.forEach(line=>{if(line.length>1)top.push(...sequinRuns(line,o.motifSpacing??8,(o.motifSize??3)/2));});}
    else if(o.stitch==='motif'){lines.forEach(line=>{if(line.length>1)top.push(...(o.motifPair&&o.satinWidth?motifPairLoops(line,t=>widthAt(o,t),o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifShape??'circle'):motifLoops(line,o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifShape??'circle')));});}
    else if(!filled){lines.forEach((line,i)=>{if(line.length>1)top.push(asRun(line,o.kind==='text'&&i>=0));});}
    else if(o.photo){
      const ph=o.photo,gray=decodeBase64(ph.data),c=[o.x+o.w/2,o.y+o.h/2],rot=(Number(o.rotation)||0)*Math.PI/180,cs=Math.cos(rot),sn=Math.sin(rot);
      const turn=r=>({...r,pts:rot?r.pts.map(([x,y])=>[c[0]+(x-c[0])*cs-(y-c[1])*sn,c[1]+(x-c[0])*sn+(y-c[1])*cs]):r.pts}),sp2=ph.spacing??.7,po={spacing:sp2,contrast:ph.contrast??1.4,invert:Boolean(ph.invert)};
      if(ph.thread2&&ph.thread3&&ph.thread4){
        // four tones: light, light-mid, mid-dark, then the main thread for the dark detail, each on its own offset rows
        const box=dy=>({x:o.x,y:o.y+dy,w:o.w,h:o.h-dy*2});
        appl=[[planPhoto(gray,ph.pw,ph.ph,box(0),{...po,tone:'light'}).map(turn),ph.thread2],[planPhoto(gray,ph.pw,ph.ph,box(sp2/4),{...po,tone:'light-mid'}).map(turn),ph.thread3],[planPhoto(gray,ph.pw,ph.ph,box(sp2/2),{...po,tone:'mid-dark'}).map(turn),ph.thread4],[planPhoto(gray,ph.pw,ph.ph,box(sp2*3/4),{...po,tone:'dark'}).map(turn),o.thread]];
      }else if(ph.thread2&&ph.thread3){
        // three tones: light (second thread) first, mid-tones (third thread), then the main thread for the dark detail, each on its own set of rows
        const box=dy=>({x:o.x,y:o.y+dy,w:o.w,h:o.h-dy*2});
        appl=[[planPhoto(gray,ph.pw,ph.ph,box(0),{...po,tone:'light'}).map(turn),ph.thread2],[planPhoto(gray,ph.pw,ph.ph,box(sp2/3),{...po,tone:'mid'}).map(turn),ph.thread3],[planPhoto(gray,ph.pw,ph.ph,box(sp2*2/3),{...po,tone:'dark'}).map(turn),o.thread]];
      }else if(ph.thread2){
        // two-tone: the second thread covers everything with a light touch first, the main thread then adds the dark detail between its rows
        blend=planPhoto(gray,ph.pw,ph.ph,{x:o.x,y:o.y,w:o.w,h:o.h},{...po,tone:'light'}).map(turn);top=planPhoto(gray,ph.pw,ph.ph,{x:o.x,y:o.y+sp2/2,w:o.w,h:o.h-sp2},{...po,tone:'dark'}).map(turn);
        [top,blend]=[blend,top];photoSecond=true;
      }else top=planPhoto(gray,ph.pw,ph.ph,{x:o.x,y:o.y,w:o.w,h:o.h},po).map(turn);
    }
    else if(o.applique){
      // Appliqué: placement line, [stop: lay the fabric], tack-down, [stop: trim the fabric], satin cover stitch around the edge. The area itself is not filled.
      const rings=(maskRings?clipLines(geometry(o,0),maskRings):geometry(o,0)).filter(l=>l.length>=4),cw=o.appliqueWidth??2.5;
      const placement=rings.map(r=>asRun(r)),tack=planContour(rings,{inset:.5,maxLen:1.8}),cover=[];
      for(const r of rings){const rl=railsFromLine(r,()=>cw/2,{join:o.join,closed:true}),cs=rl?satinRuns(rl.a,rl.b,rl.rungs,{...o,startAt:undefined,endAt:undefined,underlayType:'none'},doc,sp,comp,cursor()):null;if(cs&&!cs.bad)cover.push(...cs.under,...cs.top);else cover.push(asRun(r));}
      appl=[[placement,o.thread],[tack,o.thread,true],[cover,o.borderThread||o.thread,true]];
    }
    else{const closed=lines.filter(l=>l.length>=4);if(closed.length){const {under,top:t,top2,groups}=fillRuns(closed,o,doc,comp,cursor());top=[...under,...t];blend=top2||[];paletteRuns=groups||null;}}
    if(filled&&o.border&&!o.applique)for(const line of (maskRings?clipLines(geometry(o,0),maskRings):geometry(o,0))){if(line.length<2)continue;
      // a border with a width is a satin column around the outline; width 0 stays a plain running outline
      const bw=Number(o.borderWidth)||0,bl=bw>0?railsFromLine(line,()=>Math.max(.25,bw/2),{join:o.join,closed:distP(line[0],line.at(-1))<1e-6}):null,bs=bl?satinRuns(bl.a,bl.b,bl.rungs,{...o,startAt:undefined,endAt:undefined,underlayType:bw>=1.5?'center':'none'},doc,sp,comp,cursor()):null;
      if(bs&&!bs.bad)border.push(...bs.under,...bs.top);else border.push(asRun(line));}
    if(maskRings&&!clippedFill){top=clipRuns(top,maskRings,!!o.edgeClose);}
    if(maskRings)border=clipRuns(border,maskRings);
    if(maskRings&&blend.length&&!clippedFill)blend=clipRuns(blend,maskRings);
    if(paletteRuns&&maskRings&&!clippedFill)paletteRuns=paletteRuns.map(g=>clipRuns(g,maskRings));
    const passes=appl||(paletteRuns?[[top,o.thread],...paletteRuns.map((g,k)=>[g,o.blendPalette[k]]),[border,o.borderThread||o.thread]]:[[top,photoSecond?o.photo.thread2:o.thread],[blend,photoSecond?o.thread:(o.blendThread||o.thread)],[border,o.borderThread||o.thread]]);
    for(const [pass,passThread,stopBefore] of passes){let pendingStop=Boolean(stopBefore)&&pass.length>0;for(const run of pass){
      const pts=[];for(const p of run.pts){if(!pts.length||Math.hypot(p[0]-pts.at(-1)[0],p[1]-pts.at(-1)[1])>=.05)pts.push(p);}if(pts.length<2)continue;
      const a=pts[0],start=[round(a[0]),round(a[1])];
      if(previous===null){if(currentThread!==null&&currentThread!==passThread)push(position?.[0]??start[0],position?.[1]??start[1],'color',passThread);push(...start,'jump',passThread);push(...start,'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}
      else if(currentThread!==passThread){tieOff(currentThread);if(Math.hypot(a[0]-previous[0],a[1]-previous[1])>3){trimIf(previous,a,passThread);push(...start,'jump',passThread);}push(...start,'color',passThread);push(...start,'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}
      else if(pendingStop){pendingStop=false;tieOff(passThread);const travel=Math.hypot(a[0]-previous[0],a[1]-previous[1]);push(previous[0],previous[1],'stop',passThread);if(travel>3){trimIf(previous,a,passThread);push(...start,'jump',passThread);}push(...start,'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}
      else {const travel=Math.hypot(a[0]-previous[0],a[1]-previous[1]);if(run.jump||travel>3){tieOff(passThread);trimIf(previous,a,passThread);push(...start,'jump',passThread);push(...start,'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}else if(travel>.05)for(const [x,y] of sampleLine(previous,a,1.5))push(x,y,'stitch',passThread);}
      for(let i=1;i<pts.length;i++)push(pts[i][0],pts[i][1],'stitch',passThread);
      lastDir=unit(pts.at(-2),pts.at(-1));previous=pts.at(-1);currentThread=passThread;pendingStop=false;
    }}
  }
  if(previous!==null&&!hasImportedLayer)tieOff(currentThread);
  if(!stitches.some(s=>s.cmd==='stitch'))throw Error('The design has no sewable geometry. Add an object before exporting.');
  if(hasImportedLayer&&position)push(position[0],position[1],'end',currentThread||'#527461',true);
  let minNeedleX=Infinity,minNeedleY=Infinity,maxNeedleX=-Infinity,maxNeedleY=-Infinity,count=0;for(const p of stitches)if(p.cmd==='stitch'){minNeedleX=Math.min(minNeedleX,p.x);minNeedleY=Math.min(minNeedleY,p.y);maxNeedleX=Math.max(maxNeedleX,p.x);maxNeedleY=Math.max(maxNeedleY,p.y);count++;}const bounds=[minNeedleX,minNeedleY,maxNeedleX,maxNeedleY];
  const length=stitches.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-stitches[i-1].x,p.y-stitches[i-1].y):0,0);
  return {revision:doc.revision,stitches,bounds,count,threadLength:Math.round(length*1.12),colors:[...new Set(stitches.filter(s=>s.cmd==='stitch'||s.cmd==='color').map(s=>s.thread).filter(Boolean))],errors:[...new Set(errors)],issues};
}
const ascii=(s,n)=>Array.from({length:n},(_,i)=>s.charCodeAt(i)||0);
export function encodeJef(plan,color='#527461',hoop=110) {
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  // A true STOP is written like pyembroidery does: the 80 01 code with an extra thread slot whose palette entry is 0 (toggled back to the previous colour on the next STOP).
  const blocks=[];let block=null,stopToggled=false;for(const p of plan.stitches){if(!block){block={thread:p.thread||color,items:[]};blocks.push(block);}if(p.cmd==='color'){block={thread:p.thread||color,items:[]};blocks.push(block);}else if(p.cmd==='stop'){stopToggled=!stopToggled;block={thread:block.thread,palette:stopToggled?0:undefined,items:[]};blocks.push(block);}else block.items.push(p);}if(!blocks.length)blocks.push({thread:color,items:[]});
  const raw=[];let x=0,y=0,jumpCount=0,changeCount=0,needleCount=0,trimCount=0;
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
  raw.push(128,16);const threadCount=blocks.length,offset=116+threadCount*8,buf=new Array(offset).fill(0),put32=(at,v)=>{buf[at]=v&255;buf[at+1]=(v>>>8)&255;buf[at+2]=(v>>>16)&255;buf[at+3]=(v>>>24)&255;};
  put32(0,offset);put32(4,0x14);const date='20260101000000';date.split('').forEach((c,i)=>buf[8+i]=c.charCodeAt(0));put32(24,threadCount);put32(28,needleCount+jumpCount*2+changeCount*2+trimCount*2+1);const pyRound=v=>{const f=Math.floor(v),d=v-f;return d<.5?f:d>.5?f+1:(f%2===0?f:f+1);},ext=plan.stitches.filter(p=>p.cmd!=='end').reduce((m,p)=>[Math.min(m[0],Math.round(p.x*10)),Math.min(m[1],Math.round(p.y*10)),Math.max(m[2],Math.round(p.x*10)),Math.max(m[3],Math.round(p.y*10))],[Infinity,Infinity,-Infinity,-Infinity]),w=pyRound(ext[2]-ext[0]),h=pyRound(ext[3]-ext[1]),hw=pyRound(w/2),hh2=pyRound(h/2);
  // Header fields mirror pinned pystitch/pyembroidery JefWriter (the Ink/Stitch reference): hoop code from design size, then centre extents and distances to the 110x110, 50x50, 140x200 and custom (700x1000) hoop edges, or -1 when the design does not fit.
  put32(32,w<500&&h<500?1:w<1260&&h<1100?3:w<1400&&h<2000?2:w<2000&&h<2000?4:0);[hw,hh2,hw,hh2].forEach((v,i)=>put32(36+i*4,v));let at=52;for(const [ex,ey] of [[550,550],[250,250],[700,1000],[700,1000]]){const dx=ex-hw,dy=ey-hh2,vals=Math.min(dx,dy)>=0?[dx,dy,dx,dy]:[-1,-1,-1,-1];for(const v of vals){put32(at,v);at+=4;}}blocks.forEach((b,i)=>{put32(116+i*4,b.palette??nearestJefColor(b.thread));put32(116+threadCount*4+i*4,0x0d);});return new Uint8Array([...buf,...raw]);
}
const be16=n=>[(n>>8)&255,n&255],be32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255],i8=n=>[n&255];
export function encodeVp3(plan,color='#527461') {
  if(plan.errors.length)throw Error(plan.errors.join(' '));const out=[];const str16=s=>{const a=[];for(const c of s)a.push(0,c.charCodeAt(0));return [...be16(a.length),...a];},str8=s=>{const a=[...new TextEncoder().encode(s)];return [...be16(a.length),...a];},patch=pos=>{out.splice(pos,4,...be32(out.length-pos-4));};const put=(...a)=>out.push(...a);
  const blocks=[];let block=null,pendingOrigin=null;for(let i=0;i<plan.stitches.length;i++){const p=plan.stitches[i],previous=plan.stitches[i-1],next=plan.stitches[i+1];if(p.cmd==='jump'&&next?.cmd==='color'){pendingOrigin=[p.x,p.y];continue;}if(p.cmd==='color'){block={thread:p.thread||color,start:pendingOrigin||[p.x,p.y],items:[]};blocks.push(block);pendingOrigin=null;continue;}if(p.cmd==='jump'&&block&&!block.items.some(item=>item.cmd==='stitch')){block.start=[p.x,p.y];continue;}if(!block){block={thread:p.thread||color,start:[p.x,p.y],items:[]};blocks.push(block);}block.items.push(p);}if(!blocks.length)blocks.push({thread:color,start:[0,0],items:[]});
  put(...ascii('%vsm%',5),0,...str16('Produced by Welcome Embroidery'),0,2,0);const filePatch=out.length;put(0,0,0,0,...str16(''));
  const [minX,minY,maxX,maxY]=plan.bounds,cx=(minX+maxX)/2,cy=(minY+maxY)/2,w=maxX-minX,h=maxY-minY;
  put(...be32(Math.round(maxX*1000)),...be32(Math.round(-minY*1000)),...be32(Math.round(minX*1000)),...be32(Math.round(-maxY*1000)),...be32(plan.count),0,blocks.length,12,0,1);
  put(0,3,0);const designPatch=out.length;put(0,0,0,0,...be32(Math.round(cx*1000)),...be32(Math.round(-cy*1000)),0,0,0,...be32(Math.round(-w*500)),...be32(Math.round(w*500)),...be32(Math.round(-h*500)),...be32(Math.round(h*500)),...be32(Math.round(w*1000)),...be32(Math.round(h*1000)),...str16(''),100,100,...be32(4096),...be32(0),...be32(0),...be32(4096),120,120,80,80,1,0,...str16('Produced by Welcome Embroidery'),...be16(blocks.length));
  for(let bi=0;bi<blocks.length;bi++){const b=blocks[bi],firstX=Math.round(b.start[0]*10),firstY=Math.round(b.start[1]*10),nudgeX=firstX===0?1:0,nudgeY=firstY===0?1:0,fileStartX=firstX+nudgeX,fileStartY=firstY+nudgeY,last=b.items.filter(p=>p.cmd==='stitch').at(-1),lastX=last?Math.round(last.x*10):firstX,lastY=last?Math.round(last.y*10):firstY;
    put(0,5,0);const blockPatch=out.length;put(0,0,0,0,...be32(Math.round((fileStartX/10-cx)*1000)),...be32(Math.round(-(fileStartY/10-cy)*1000)));
    const rgb=b.thread.match(/[0-9a-f]{2}/gi)?.map(v=>parseInt(v,16))||[82,116,97];put(1,0,rgb[0],rgb[1],rgb[2],0,0,0,5,40,...str8(''),...str8(b.thread),...str8('Welcome'));
    put(...be32(Math.round((lastX-firstX)*100)),...be32(Math.round(-(lastY-firstY)*100)),0,1,0);const stitchPatch=out.length;put(0,0,0,0,10,246,0);let px=fileStartX,py=fileStartY,hasNeedle=false;
    for(const p of b.items){if(p.cmd==='jump'){if(hasNeedle)put(128,3);continue;}if(p.cmd!=='stitch')continue;const nx=Math.round(p.x*10),ny=Math.round(p.y*10),dx=nx-px,dy=ny-py;px=nx;py=ny;hasNeedle=true;if(dx<-32768||dx>32767||dy<-32768||dy>32767)throw Error('VP3 stitch delta exceeds the signed 16-bit range.');if(dx>=-127&&dx<=127&&dy>=-127&&dy<=127)put(...i8(dx),...i8(dy));else put(128,1,...be16(dx),...be16(dy),128,2);}
    put(128,3);patch(stitchPatch);put(0);patch(blockPatch);
  }
  patch(designPatch);patch(filePatch);return new Uint8Array(out);
}
function layerCanPassThrough(o,format){const p=o.source.defaultPlacement;return o.kind==='stitch_layer'&&o.source.format===format&&o.source.originalBytesBase64&&o.x===p.x&&o.y===p.y&&o.w===p.w&&o.h===p.h&&(o.rotation||0)===0&&o.thread===o.source.defaultThread&&Object.keys(o.threadOverrides).length===0;}
function sourceMatches(decoded,o){if(JSON.stringify(decoded.bounds)!==JSON.stringify(o.source.bounds)||JSON.stringify(decoded.threads)!==JSON.stringify(o.threads)||decoded.stitches.length!==o.stitches.length)return false;for(let i=0;i<decoded.stitches.length;i++){const a=decoded.stitches[i],b=o.stitches[i];if(a.x!==b.x||a.y!==b.y||a.cmd!==b.cmd||a.thread!==b.thread)return false;}return true;}
function vp3LayerHasUnsupportedTravel(stitches){for(let i=0;i<stitches.length;i++){const p=stitches[i],prev=stitches[i-1],next=stitches[i+1];if(p.cmd==='trim'||p.cmd==='stop')return true;if(p.cmd==='jump'){const blockOrigin=i===0||prev?.cmd==='color'||next?.cmd==='color',noOp=prev&&p.x===prev.x&&p.y===prev.y;if(!blockOrigin&&!noOp)return true;}}return false;}
// Tajima DST writer, following pyembroidery's DstWriter/encode_record: 512-byte ASCII header, balanced-ternary 3-byte records
// (max 12.1 mm per record), long jumps split, a trim is three small alternating jumps, colour change and stop are 0xC3, end is 0xF3.
// Brother PEC thread chart, 1-based: the machine stores these indices for each colour block.
const PEC_CHART=[[14,31,124],[10,85,163],[0,135,119],[75,107,175],[237,23,31],[209,92,0],[145,54,151],[228,154,203],[145,95,172],[158,214,125],[232,169,0],[254,186,53],[255,255,0],[112,188,31],[186,152,0],[168,168,168],[125,111,0],[255,255,179],[79,85,86],[0,0,0],[11,61,145],[119,1,118],[41,49,51],[42,19,1],[246,74,138],[178,118,36],[252,187,197],[254,55,15],[240,240,240],[106,28,138],[168,221,196],[37,132,187],[254,179,67],[255,243,107],[208,166,96],[209,84,0],[102,186,73],[19,74,70],[135,135,135],[216,204,198],[67,86,7],[253,217,222],[249,147,188],[0,56,34],[178,175,212],[104,106,176],[239,227,185],[247,56,102],[181,75,100],[19,43,26],[199,1,86],[254,158,50],[168,222,235],[0,103,62],[78,41,144],[47,126,32],[255,204,204],[255,217,17],[9,91,166],[240,249,112],[227,243,91],[255,153,0],[255,240,141],[255,200,200]];
const pecChartIndex=hex=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||"")||[0,"527461"];const n=parseInt(m[1],16),c=[n>>16&255,n>>8&255,n&255];let best=0,bd=Infinity;PEC_CHART.forEach((r,i)=>{const d=(r[0]-c[0])**2+(r[1]-c[1])**2+(r[2]-c[2])**2;if(d<bd){bd=d;best=i;}});return best+1;};
// PEC (Brother): 512-byte header with palette indices, a stitch block in 0.1 mm, then blank 48 x 38 icons (one overview, one per colour).
function pecColourSeq(plan){const seq=[];for(const p of plan.stitches){if(p.cmd==="end")continue;if(p.thread&&seq.at(-1)!==p.thread)seq.push(p.thread);}if(!seq.length)seq.push("#527461");return seq;}
function pecBody(plan,name){
 if(plan.errors.length)throw Error(plan.errors.join(" "));
 const seq=pecColourSeq(plan);
 const indices=seq.slice(0,255).map(pecChartIndex);
 const body=[];const value=(v,long,flag)=>{if(!long&&v>-64&&v<63){body.push(v&0x7F);return;}let x=v&0x0FFF;x|=0x8000;x|=flag<<8;body.push((x>>8)&0xFF,x&0xFF);};
 let xx=0,yy=0,jumping=true,init=true,colourTwo=true;
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
 const out=[];const put=(...bs)=>out.push(...bs);
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
export function encodePec(plan,name="Welcome"){return Uint8Array.from([...Array.from("#PEC0001",c=>c.charCodeAt(0)),...pecBody(plan,name)]);}
// PES version 1: '#PES0001', the PEC block offset, sew segments per colour block and a colour log, then the PEC block.
function pesSegments(plan,colourOf){
 const stitches=plan.stitches.filter(s=>s.cmd!=="end").map(s=>({cmd:s.cmd,x:Math.round(s.x*10),y:Math.round(s.y*10),thread:s.thread}));
 const xs=stitches.map(s=>s.x),ys=stitches.map(s=>s.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,left=minX-cx,top=minY-cy,right=maxX-cx,bottom=maxY-cy;
 const adjX=left+cx,adjY=bottom+cy;
 const groups=[];let last=null;
 for(const s of stitches){if(s.cmd==="trim")continue;if(last&&last.cmd===s.cmd){last.items.push(s);}else{last={cmd:s.cmd,items:[s]};groups.push(last);}}
 const segments=[];let colour=colourOf(stitches[0]?.thread||"#527461"),sx=0,sy=0;
 for(const g of groups){
  if(g.cmd==="color"||g.cmd==="stop"){colour=colourOf(g.items[0].thread||"#527461");continue;}
  if(g.cmd==="jump"){const a=[sx-adjX,sy-adjY],b=g.items.at(-1);segments.push({flag:1,colour,points:[a,[b.x-adjX,b.y-adjY]]});}
  else if(g.cmd==="stitch"){const pts=g.items.map(s=>[s.x-adjX,s.y-adjY]);sx=g.items.at(-1).x;sy=g.items.at(-1).y;segments.push({flag:0,colour,points:pts});}
  else throw Error(`Unsupported stitch command for PES: ${g.cmd}`);
 }
 return {stitches,segments,left,top,right,bottom};
}
// PES: '#PES0001' or '#PES0060', the PEC block offset, sew segments per colour block and a colour log, then the PEC block.
function pesWriter(plan,name,version){
 if(plan.errors.length)throw Error(plan.errors.join(" "));
 const threads=[];const colourOf=hex=>{const k=String(hex||"#527461").toLowerCase();let i=threads.indexOf(k);if(i<0){threads.push(k);i=threads.length-1;}return version===6?i:pecChartIndex(hex);};
 const {stitches,segments,left,top,right,bottom}=pesSegments(plan,colourOf);
 const out=[];const i16=v=>out.push(v&0xFF,(v>>8)&0xFF);const i32=v=>out.push(v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>>24)&0xFF);
 const f32=v=>{const b=new DataView(new ArrayBuffer(4));b.setFloat32(0,v,true);out.push(...new Uint8Array(b.buffer));};
 const str16=s=>{i16(s.length);for(const c of s)out.push(c.charCodeAt(0));};
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
  for(const [r,g,b] of rgb){str8(null);out.push(r,g,b,0);i32(0xA);str8(null);str8(null);str8(null);}
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
 const colourLog=[];let prevColour=-1;
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
export function encodePes(plan,name="Welcome"){return pesWriter(plan,name,1);}
export function encodePesV6(plan,name="Welcome"){return pesWriter(plan,name,6);}
// EXP (Melco): signed byte pairs in 0.1 mm, y negated; 80 04 = jump, 80 01 = colour change, 80 80 07 00 = trim, no header.
export function encodeExp(plan){if(plan.errors.length)throw Error(plan.errors.join(' '));const out=[];let x=0,y=0;const move=(nx,ny,jump)=>{let dx=nx-x,dy=ny-y;while(dx!==0||dy!==0){const sx=Math.max(-127,Math.min(127,dx)),sy=Math.max(-127,Math.min(127,dy));if(jump)out.push(0x80,0x04);out.push(sx&0xff,(-sy)&0xff);dx-=sx;dy-=sy;x+=sx;y+=sy;}};for(const p of plan.stitches){const nx=Math.round(p.x*10),ny=Math.round(p.y*10);if(p.cmd==='end')continue;if(p.cmd==='color'||p.cmd==='stop'){out.push(0x80,0x01,0,0);move(nx,ny,true);}else if(p.cmd==='jump')move(nx,ny,true);else if(p.cmd==='trim')out.push(0x80,0x80,0x07,0x00);else if(p.cmd==='stitch')move(nx,ny,false);else throw Error(`Unsupported stitch command for EXP: ${p.cmd}`);}return Uint8Array.from(out);}
export function encodeDst(plan,name='Welcome'){
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  const XBITS={p81:2,n81:3,p27:2,n27:3,p9:2,n9:3,p3:0,n3:1,p1:0,n1:1},YBITS={p81:5,n81:4,p27:5,n27:4,p9:5,n9:4,p3:7,n3:6,p1:7,n1:6};
  const ternary=(v,bits)=>{const out={b0:0,b1:0,b2:0};let r=v;for(const [t,step,reg,pb,nb] of [[40,81,'b2',bits.p81,bits.n81],[13,27,'b1',bits.p27,bits.n27],[4,9,'b0',bits.p9,bits.n9],[1,3,'b1',bits.p3,bits.n3],[0,1,'b0',bits.p1,bits.n1]]){if(r>t){out[reg]|=1<<pb;r-=step;}else if(r<-t){out[reg]|=1<<nb;r+=step;}}if(r!==0)throw Error('DST delta exceeds the record range.');return out;};
  const record=(dx,dy,kind)=>{if(kind==='color')return [0,0,0xC3];if(kind==='end')return [0,0,0xF3];const ex=ternary(dx,XBITS),ey=ternary(-dy,YBITS);return [ex.b0|ey.b0,ex.b1|ey.b1,(kind==='jump'?0x80:0)|3|ex.b2|ey.b2];};
  const recs=[];let x=0,y=0,colors=0,count=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
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
  const label=String(name).replace(/[^\x20-\x7e]/g,'?').slice(0,16).padEnd(16),pad=(v,n)=>String(v).padStart(n),signed=(v,n)=>(v>=0?'+':'-')+String(Math.abs(v)).padStart(n);
  const header=`LA:${label}\rST:${pad(count,7)}\rCO:${pad(colors,3)}\r+X:${pad(Math.abs(maxX),5)}\r-X:${pad(Math.abs(minX),5)}\r+Y:${pad(Math.abs(-minY),5)}\r-Y:${pad(Math.abs(-maxY),5)}\rAX:${signed(x,5)}\rAY:${signed(-y,5)}\rMX:+${pad(0,5)}\rMY:+${pad(0,5)}\rPD:******\r\x1a`;
  const out=new Uint8Array(512+recs.length*3).fill(0x20);for(let i=0;i<header.length;i++)out[i]=header.charCodeAt(i);recs.forEach((r,i)=>out.set(r,512+i*3));return out;
}
export function encode(plan,format,color,hoop=110,document=null){
  if(document)hoop=hoopSize(document);
  if(!(['jef','vp3','dst','exp','pec','pes','pes6'].includes(format)))throw Error(`Unsupported machine format: ${format}. Choose JEF, VP3, DST, EXP, PEC, PES or PES v6.`);
  if(plan.errors.length)throw Error(plan.errors.join(' '));
  const layers=(document?.objects||[]).filter(o=>o.visible!==false&&o.kind==='stitch_layer');
  if(layers.length===1&&document.objects.length===1&&layerCanPassThrough(layers[0],format)){
    const bytes=Uint8Array.from(atob(layers[0].source.originalBytesBase64),c=>c.charCodeAt(0));
    if(bytes.byteLength===layers[0].source.size){try{const checked=decodeEmbroidery(bytes,format);if(sourceMatches(checked,layers[0]))return bytes;}catch{}}
  }
  if(format==='vp3'&&layers.some(o=>vp3LayerHasUnsupportedTravel(o.stitches)))throw Error('This VP3 design contains intra-block travel, trim, or stop commands the current VP3 writer cannot preserve after edits. Leading color-block origin moves and no-op moves are preserved. Export JEF or restore the unchanged VP3 source.');
  if(format==='jef')return encodeJef(plan,color,hoop);if(format==='dst')return encodeDst(plan,document?.name||'Welcome');if(format==='exp')return encodeExp(plan);if(format==='pec')return encodePec(plan,document?.name||'Welcome');if(format==='pes')return encodePes(plan,document?.name||'Welcome');if(format==='pes6')return encodePesV6(plan,document?.name||'Welcome');return encodeVp3(plan,color);
}
export {geometry,objectBounds};

// Plain-language sewing advice for a design, so an agent (or a person) hears about likely problems before sewing. Thresholds follow common embroidery practice.
export function designWarnings(doc){
  const out=[],hoopW=doc.hoop,hoopH=doc.hoopH??doc.hoop,seen=new Map(),w=(o,message)=>out.push({id:o.id,name:o.name||o.kind,message});
  for(const o of doc.objects){
    if(o.visible===false||o.mask||o.kind==='stitch_layer')continue;let b;try{b=objectBounds(o);}catch{continue;}const bw=b[2]-b[0],bh=b[3]-b[1],label=o.name||o.id;
    if(b[0]<-hoopW/2||b[1]<-hoopH/2||b[2]>hoopW/2||b[3]>hoopH/2)w(o,`${label} reaches outside the ${hoopW}×${hoopH} mm hoop.`);
    const key=[o.kind,o.stitch,o.thread,Math.round(b[0]),Math.round(b[1]),Math.round(b[2]),Math.round(b[3])].join('|');if(seen.has(key))w(o,`${label} is a duplicate of ${seen.get(key)}: it would be sewn twice. Delete one.`);else seen.set(key,label);
    const filled=o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed);
    if(filled&&!o.photo){const lines=geometry(o,0).filter(l=>l.length>=4);if(lines.length){const area=shapeArea(lines),per=lines.reduce((n,r)=>n+r.reduce((m,p,i)=>i?m+distP(p,r[i-1]):m,0),0),mean=per?2*area/per:0;
      if(Math.min(bw,bh)<2||area<6)w(o,`${label} is ${bw.toFixed(1)}×${bh.toFixed(1)} mm, too small for a clean fill. Make it at least about 2 mm across, or use a satin column or running stitch.`);
      else if(Math.min(bw,bh)<4.5||area<25)w(o,`${label} is a small fill (${bw.toFixed(1)}×${bh.toFixed(1)} mm): it will sew, but the rows are very short and can look dense or rough. A satin stitch or a slightly larger shape usually sews cleaner.`);
      else if(mean<1.4)w(o,`${label} is mostly narrower than 1.4 mm, so a fill will skip or look thin. Use a satin column along its centre line.`);}}
    if(o.kind==='path'&&!filled){const len=pathOutline(o).reduce((n,p,i,a)=>i?n+distP(p,a[i-1]):0,0);if(len<2)w(o,`${label} is only ${len.toFixed(1)} mm long; stitches this short are skipped or bunch up.`);
      if(o.stitch==='satin'){const wd=Math.max(Number(o.satinWidth)||3,Number(o.satinWidthEnd)||0);if((Number(o.satinWidth)||3)<1)w(o,`${label} is a satin column under 1 mm wide, which is hard to sew cleanly. Use a running stitch, or widen it to at least 1.5 mm.`);if(wd>7)w(o,`${label} is a satin column wider than 7 mm; long satin stitches snag. Use a fill, or split it into narrower columns.`);}}
    if(o.kind==='text'&&Number(o.h)<5&&isRegistryFont(o.font)&&getFont(o.font)?.kind!=='line')w(o,`${label} is only ${Number(o.h).toFixed(1)} mm tall; lettering under about 5 mm rarely sews cleanly in a satin or fill font.`);
  }
  return out;
}
