// Minimal TrueType (glyf) reader and converter: TTF bytes -> Welcome font data (outline fill primitives in font units, y down,
// baseline at 0). Used at build time for the bundled open fonts and in the browser for fonts loaded from a local file.
// Supports simple and composite glyphs, cmap formats 0/4/12, hmtx, the legacy 'kern' table and the name table.
// CFF/PostScript-flavoured OpenType (OTTO), collections and WOFF are rejected with a clear message.
import polygonClipping from './vendor/polygon-clipping.js';

export function parseTrueType(buf){
  const dv=new DataView(buf.buffer?buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength):buf),tag=n=>String.fromCharCode(dv.getUint8(n),dv.getUint8(n+1),dv.getUint8(n+2),dv.getUint8(n+3));
  if(dv.byteLength<12)throw Error('This does not look like a font file.');
  const magic=tag(0);if(magic==='OTTO')throw Error('CFF-flavoured OpenType fonts (.otf with PostScript outlines) are not supported; use a TrueType (.ttf) font.');if(magic==='ttcf')throw Error('Font collections (.ttc) are not supported; extract a single .ttf.');if(magic==='wOFF'||magic==='wOF2')throw Error('WOFF fonts are not supported; use the .ttf file.');
  if(dv.getUint32(0)!==0x00010000&&magic!=='true')throw Error('Unsupported font format (expected TrueType).');
  const tables={};for(let i=0,n=dv.getUint16(4);i<n;i++){const o=12+i*16;tables[tag(o)]={off:dv.getUint32(o+8),len:dv.getUint32(o+12)};}
  for(const need of ['head','maxp','hhea','hmtx','loca','glyf','cmap'])if(!tables[need])throw Error(`Font is missing the '${need}' table.`);
  const T=n=>tables[n].off,unitsPerEm=dv.getUint16(T('head')+18),locFormat=dv.getInt16(T('head')+50),numGlyphs=dv.getUint16(T('maxp')+4),numHM=dv.getUint16(T('hhea')+34);
  if(!unitsPerEm||numGlyphs>65535)throw Error('Invalid font header.');
  const loc=g=>locFormat?dv.getUint32(T('loca')+g*4):dv.getUint16(T('loca')+g*2)*2;
  const advance=g=>dv.getUint16(T('hmtx')+Math.min(g,numHM-1)*4);
  // --- cmap
  const cmapMaps=[];const cm=T('cmap');for(let i=0,n=dv.getUint16(cm+2);i<n;i++){const pid=dv.getUint16(cm+4+i*8),eid=dv.getUint16(cm+6+i*8),off=cm+dv.getUint32(cm+8+i*8),fmt=dv.getUint16(off);if((pid===3&&(eid===1||eid===10))||pid===0||(pid===1&&eid===0&&fmt===0))cmapMaps.push({pid,eid,off,fmt});}
  const cmapLookup=(cp)=>{for(const {off,fmt} of cmapMaps){let g=0;if(fmt===4){const segX2=dv.getUint16(off+6),end=off+14,start=end+segX2+2,delta=start+segX2,range=delta+segX2;for(let s=0;s<segX2;s+=2){if(cp<=dv.getUint16(end+s)){if(cp>=dv.getUint16(start+s)){const ro=dv.getUint16(range+s);if(!ro)g=(cp+dv.getInt16(delta+s))&0xFFFF;else{const gi=range+s+ro+(cp-dv.getUint16(start+s))*2;g=gi<dv.byteLength?dv.getUint16(gi):0;if(g)g=(g+dv.getInt16(delta+s))&0xFFFF;}}break;}}}
      else if(fmt===12){for(let i=0,n=dv.getUint32(off+12);i<n;i++){const o=off+16+i*12,a=dv.getUint32(o),b=dv.getUint32(o+4);if(cp>=a&&cp<=b){g=dv.getUint32(o+8)+cp-a;break;}}}
      else if(fmt===0&&cp<256)g=dv.getUint8(off+6+cp);
      if(g)return g;}return 0;};
  // --- glyph outlines (contours of {x,y,on})
  const outlineCache=new Map();
  function outline(g,depth=0){if(outlineCache.has(g))return outlineCache.get(g);let result=[];const a=loc(g),b=loc(g+1);
    if(b>a&&depth<6){const base=T('glyf')+a,nc=dv.getInt16(base);
      if(nc>=0){const ends=[];let p=base+10;for(let i=0;i<nc;i++){ends.push(dv.getUint16(p));p+=2;}const il=dv.getUint16(p);p+=2+il;const np=nc?ends.at(-1)+1:0;
        const flags=[];while(flags.length<np){const f=dv.getUint8(p++);flags.push(f);if(f&8){let r=dv.getUint8(p++);while(r--&&flags.length<np)flags.push(f);}}
        const xs=[],ys=[];let v=0;for(let i=0;i<np;i++){const f=flags[i];if(f&2){const d=dv.getUint8(p++);v+=f&16?d:-d;}else if(!(f&16)){v+=dv.getInt16(p);p+=2;}xs.push(v);}v=0;
        for(let i=0;i<np;i++){const f=flags[i];if(f&4){const d=dv.getUint8(p++);v+=f&32?d:-d;}else if(!(f&32)){v+=dv.getInt16(p);p+=2;}ys.push(v);}
        let s=0;for(const e of ends){const c=[];for(let i=s;i<=e;i++)c.push({x:xs[i],y:ys[i],on:Boolean(flags[i]&1)});if(c.length>=2)result.push(c);s=e+1;}}
      else{let p=base+10,more=true;while(more){const fl=dv.getUint16(p),gi=dv.getUint16(p+2);p+=4;let dx=0,dy=0;if(fl&1){dx=dv.getInt16(p);dy=dv.getInt16(p+2);p+=4;}else{dx=dv.getInt8(p);dy=dv.getInt8(p+1);p+=2;}if(!(fl&2)){dx=0;dy=0;}
        let m=[1,0,0,1];if(fl&8){const s=dv.getInt16(p)/16384;m=[s,0,0,s];p+=2;}else if(fl&0x40){m=[dv.getInt16(p)/16384,0,0,dv.getInt16(p+2)/16384];p+=4;}else if(fl&0x80){m=[dv.getInt16(p)/16384,dv.getInt16(p+2)/16384,dv.getInt16(p+4)/16384,dv.getInt16(p+6)/16384];p+=8;}
        for(const c of outline(gi,depth+1))result.push(c.map(pt=>({x:m[0]*pt.x+m[2]*pt.y+dx,y:m[1]*pt.x+m[3]*pt.y+dy,on:pt.on})));more=Boolean(fl&0x20);}}}
    outlineCache.set(g,result);return result;}
  // --- optional legacy kerning
  const kern=new Map();if(tables.kern){const k=T('kern');for(let t=0,n=dv.getUint16(k+2),o=k+4;t<n;t++){const len=dv.getUint16(o+2),cov=dv.getUint16(o+4);if((cov>>8)===0&&(cov&1)){for(let i=0,np=dv.getUint16(o+6),q=o+14;i<np;i++,q+=6)kern.set(dv.getUint16(q)*65536+dv.getUint16(q+2),dv.getInt16(q+4));}o+=len;}}
  // --- names
  const names={};if(tables.name){const n=T('name'),count=dv.getUint16(n+2),so=n+dv.getUint16(n+4);for(let i=0;i<count;i++){const o=n+6+i*12,pid=dv.getUint16(o),id=dv.getUint16(o+6),len=dv.getUint16(o+8),off=so+dv.getUint16(o+10);if(names[id]&&!(pid===3))continue;let str='';if(pid===3||pid===0){for(let j=0;j<len;j+=2)str+=String.fromCharCode(dv.getUint16(off+j));}else for(let j=0;j<len;j++)str+=String.fromCharCode(dv.getUint8(off+j));names[id]=str;}}
  return {unitsPerEm,numGlyphs,glyphIndex:cmapLookup,advance,outline,kernPair:(l,r)=>kern.get(l*65536+r)||0,names,hasKern:kern.size>0};
}

// Flatten quadratic TrueType contours into closed polylines.
function flattenContour(c,step){const pts=[];const n=c.length;let start;let i0=c.findIndex(p=>p.on);const seq=[];
  if(i0<0){const a=c[0],b=c[n-1];seq.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,on:true});for(const p of c)seq.push(p);i0=0;}else{for(let k=0;k<n;k++)seq.push(c[(i0+k)%n]);}
  start=seq[0];pts.push([start.x,start.y]);let prev=start,ctrl=null;
  const quad=(a,q,b)=>{const len=Math.hypot(q.x-a.x,q.y-a.y)+Math.hypot(b.x-q.x,b.y-q.y),m=Math.max(2,Math.min(24,Math.ceil(len/step)));for(let k=1;k<=m;k++){const t=k/m,u=1-t;pts.push([u*u*a.x+2*u*t*q.x+t*t*b.x,u*u*a.y+2*u*t*q.y+t*t*b.y]);}};
  for(let k=1;k<=seq.length;k++){const p=k===seq.length?start:seq[k];if(p.on){if(ctrl){quad(prev,ctrl,p);ctrl=null;}else pts.push([p.x,p.y]);prev=p;}else{if(ctrl){const mid={x:(ctrl.x+p.x)/2,y:(ctrl.y+p.y)/2,on:true};quad(prev,ctrl,mid);prev=mid;}ctrl=p;}}
  if(ctrl)quad(prev,ctrl,start);if(pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();return pts;}
const signedArea=r=>{let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
function rdp(points,tol){if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);let idx=-1,dm=0;for(let i=1;i<points.length-1;i++){const p=points[i],d=len?Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/len:Math.hypot(p[0]-a[0],p[1]-a[1]);if(d>dm){dm=d;idx=i;}}if(dm<=tol)return [a,b];return [...rdp(points.slice(0,idx+1),tol).slice(0,-1),...rdp(points.slice(idx),tol)];}
const simplifyRing=(r,tol)=>{if(r.length<5)return r;const out=rdp([...r,r[0]],tol).slice(0,-1);return out.length>=3?out:r;};

// Glyph contours -> fill polygons (outer ring first, then holes) in y-down font units, merged with nonzero-like semantics.
function glyphPolygons(contours,upm){const step=upm/45,tol=upm/1300,rings=contours.map(c=>simplifyRing(flattenContour(c,step),tol)).filter(r=>r.length>=3&&Math.abs(signedArea(r))>upm*upm*1e-7);if(!rings.length)return [];
  const big=rings.reduce((m,r)=>Math.abs(signedArea(r))>Math.abs(signedArea(m))?r:m),sign=Math.sign(signedArea(big)),outers=rings.filter(r=>Math.sign(signedArea(r))===sign).map(r=>[r]),holes=rings.filter(r=>Math.sign(signedArea(r))!==sign).map(r=>[r]);
  try{let shape=outers.length>1?polygonClipping.union(outers[0],...outers.slice(1)):[outers[0]];if(holes.length)shape=polygonClipping.difference(shape,...holes);
    return shape.map(poly=>poly.map(r=>openRing(r).map(([x,y])=>[x,-y])));}
  catch{return [rings.map(r=>r.map(([x,y])=>[x,-y]))];}}
const openRing=r=>r.length>1&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]?r.slice(0,-1):r;
const flat=r=>r.flatMap(([x,y])=>[+x.toFixed(1),+y.toFixed(1)]);

export const DEFAULT_CHARS=(()=>{let s='';for(let c=0x20;c<=0x7E;c++)s+=String.fromCharCode(c);for(let c=0xA0;c<=0xFF;c++)s+=String.fromCharCode(c);return s+'€‘’“”–—…•';})();

// meta: {id,name,license,licenseText,source,keywords,size,minScale,maxScale}
export function ttfToFont(bytes,meta={},chars=DEFAULT_CHARS){
  const f=parseTrueType(bytes),upm=f.unitsPerEm,glyphs={},kern={},gids={};
  for(const ch of [...chars]){const gid=f.glyphIndex(ch.codePointAt(0));if(!gid&&ch!==' ')continue;gids[ch]=gid;const polys=gid?glyphPolygons(f.outline(gid),upm):[];glyphs[ch]={a:Math.round(f.advance(gid)),p:polys.map(poly=>['f',poly.map(flat)])};}
  if(f.hasKern)for(const l of Object.keys(gids))for(const r of Object.keys(gids)){if(!gids[l]||!gids[r])continue;const k=f.kernPair(gids[l],gids[r]);if(k)kern[l+r]=k;}
  if(!glyphs[' '])glyphs[' ']={a:Math.round(upm*.28),p:[]};
  const name=meta.name||f.names[4]||f.names[1]||'Custom font';
  return {id:meta.id,name,kind:'outline',description:meta.description||'',keywords:meta.keywords||[],license:meta.license||'',licenseText:meta.licenseText||'',copyright:(f.names[0]||'').slice(0,300),source:meta.source||'',original:name,originalUrl:meta.originalUrl||'',
    unitsPerEm:upm,baseline:0,leading:Math.round(upm*1.25),size:meta.size||20,minScale:meta.minScale||.25,maxScale:meta.maxScale||3,letterCase:'',defaultAdvance:Math.round(upm*.55),spaceAdvance:glyphs[' '].a,kern,glyphs};
}
