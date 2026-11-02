// Deterministic stitch compiler and JEF/VP3 serializers. Document units are mm.
import {getFont,isRegistryFont,registerDocumentFonts} from './fonts.js';
import {bundledFontUsage,customFontUsage,measureText} from './fontHelpers.js';
export {bundledFontUsage,customFontUsage,measureText};
import {planPhoto,planContour,sampleRun,sampleLine} from './stitchplan.js';
import {FABRIC_PROFILES,FABRIC_PRESETS,DISTORTION_SCALE,distortionGrid} from './fabrics.js';
import {GLYPHS,parseSvgPath} from './lettering.js';
import {geometry,textPrimitives,cornerRadii} from './outlines.js';
import {pathDirs,motifLoops,motifPairLoops,sequinRuns,beadRuns,blingRuns} from './embellishments.js';
import {objectBounds} from './transforms.js';
import {HOOP_PRESETS,hoopSize,hoopLabel} from './hoops.js';
import {designWarnings,shapeArea,TIP_CATEGORIES,visibleTips} from './designChecks.js';
import {clipLines} from './clipMasks.js';
import {sameThread,parseThreadStock,nearestStockThread} from './threads.js';
export {parseThreadStock,nearestStockThread};
export {designWarnings,shapeArea,TIP_CATEGORIES,visibleTips};
import {svgPathFill} from './svgImport.js';
export {svgPathFill};
import {closeRing,clipRuns,satinFromRails,bartack} from './stitchRuns.js';
import {makeStitchLayer,importStitchLayer,decodeBase64} from './stitchImport.js';
import {fillRuns,satinRuns} from './fillStitch.js';
export {makeStitchLayer,importStitchLayer};
export {satinFromRails};
import {exportSvg,exportPrintTemplate,exportAppliqueTemplates,jefWarnings} from './exports.js';
export {exportSvg,exportPrintTemplate,exportAppliqueTemplates,jefWarnings};
import {measureBetween} from './measure.js';
export {measureBetween};
import {applyOperations} from './operations.js';
export {applyOperations};
import {validateDocument} from './validate.js';
export {validateDocument};
import {sewingWorksheet} from './worksheet.js';
export {sewingWorksheet};
import {initialDocument,batchPlan,batchDocuments} from './document.js';
export {initialDocument,batchPlan,batchDocuments};
import {isClosedShape} from './shapeOps.js';
import {countSmallHoles,isSmallIsland} from './cleanup.js';
export {isClosedShape,countSmallHoles,isSmallIsland};
export {HOOP_PRESETS,hoopSize,hoopLabel};
export {textPrimitives,cornerRadii};
import {distP,railsFromLine,railsFromCenterline,widthAt} from './pathGeometry.js';
import {nodeFraction} from './editOps.js';
export {nodeFraction};
export {FABRIC_PROFILES,FABRIC_PRESETS,DISTORTION_SCALE,distortionGrid};
export {parseSvgPath};
export {railsFromLine,widthAt};
import {threadPlan,blockSeconds,blockTimeLabel,sewingSeconds,threadSpans,sewingSecondsUpTo} from './sewingTime.js';
import {encodeJef,encodeVp3,encodePec,encodePes,encodePesV6,encodeSew,encodeTbf,encodeXxx,encodeU01,encodeExp,encodeDst,encodeCol,encodeEdr,encode} from './encoders.js';
export {encodeJef,encodeVp3,encodePec,encodePes,encodePesV6,encodeSew,encodeTbf,encodeXxx,encodeU01,encodeExp,encodeDst,encodeCol,encodeEdr,encode};
export {threadPlan,blockSeconds,blockTimeLabel,sewingSeconds,threadSpans,sewingSecondsUpTo};
const round = n => Math.round(n * 10) / 10;



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
  const ties=doc.settings.ties===true,trims=doc.settings.trims===true,trimMm=doc.settings.trimMm??5;let lastDir=[1,0];
  // With trims on, any jump of trimMm (5 mm by default) or more after sewing is preceded by a thread cut at the last needle position.
  const trimIf=(from,to,thread)=>{if(trims&&lastNeedle&&Math.hypot(to[0]-from[0],to[1]-from[1])>=trimMm)push(lastNeedle[0],lastNeedle[1],'trim',thread);};
  const unit=(a,b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
  // Lock stitches: four 0.4 mm back-and-forth needles. Tie-in runs along the first segment; tie-off runs back along the last one.
  const tieIn=(start,dir,thread)=>{if(!ties)return;const q=[start[0]+dir[0]*.4,start[1]+dir[1]*.4];push(...q,'stitch',thread);push(...start,'stitch',thread);push(...q,'stitch',thread);push(...start,'stitch',thread);};
  const tieOff=thread=>{if(!ties||!lastNeedle)return;const n=lastNeedle,q=[n[0]-lastDir[0]*.4,n[1]-lastDir[1]*.4];push(...q,'stitch',thread);push(...n,'stitch',thread);push(...q,'stitch',thread);push(...n,'stitch',thread);};
  // Where each object's stitches start in the list, so the stitch counts per object can be read back after the last one.
  const objectStarts=[];
  for(const {o,lines,satin,rails,maskRings,clippedFill} of records){
    objectStarts.push({id:o.id,start:stitches.length});
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
    const bean=pts=>{const out=[pts[0]];for(let i=1;i<pts.length;i++)out.push(pts[i],pts[i-1],pts[i]);return out;},
      // Stem: the stitches alternate to each side of the path, half a stem width away, and both ends sit on the path (a stem-stitch braid).
      stem=pts=>{const dirs=pathDirs(pts),out=[pts[0]];const half=(o.stemWidth??1.2)/2;for(let i=1;i<pts.length-1;i++){const [ux,uy]=dirs[i],side=i%2?1:-1,h=half*side;out.push([pts[i][0]-uy*h,pts[i][1]+ux*h]);}out.push(pts.at(-1));return out;},
      asRun=(line,jump=false)=>{const pts=sampleRun(line,runLen);const redwork=o.runStyle==='redwork'&&o.stitch==='run';return {pts:o.runStyle==='bean'&&o.stitch==='run'?bean(pts):redwork?[...pts,...pts.slice(0,-1).reverse()]:o.runStyle==='stem'&&o.stitch==='run'?stem(pts):pts,jump};};
    if(satin){const r=rails;if(r){const sat=satinRuns(r.a,r.b,r.rungs||[],o,doc,sp,comp,cursor());top=sat.bad?fillRuns([[...r.a,...[...r.b].reverse()]],o,doc,comp,cursor()).top:[...sat.under,...sat.top];if(o.buttonhole&&r.a.length>1)top=[...bartack(r.a[0],r.b[0],r.a[1],r.b[1],true),...top,...bartack(r.a.at(-1),r.b.at(-1),r.a.at(-2),r.b.at(-2),false)];}}
    else if(o.kind==='text'&&isRegistryFont(o.font)){
      for(const pr of textPrimitives(o)||[]){
        const from=top.at(-1)?.pts.at(-1)??cursor();
        if(pr.t==='r')top.push(asRun(pr.pts,true));
        else if(pr.t==='s'){const sat=satinRuns(pr.a,pr.b,pr.rungs,o,doc,sp,comp,from);let all;if(sat.bad){all=fillRuns([[...pr.a,...[...pr.b].reverse()]],o,doc,comp,from).top;}else all=[...sat.under,...sat.top];if(all.length)all[0].jump=true;top.push(...all);}
        else{const {under,top:t}=fillRuns(pr.rings,o,doc,comp,from);const all=[...under,...t];if(all.length)all[0].jump=true;top.push(...all);}
      }
    }
    else if(o.stitch==='bling'){lines.forEach(line=>{if(line.length>1)top.push(...blingRuns(line,o.motifSpacing??8,o.motifSize??4,o.blingShape??'round',o.stoneTurn!==false,o.blingRings??2));});}
    else if(o.stitch==='bead'){lines.forEach(line=>{if(line.length>1)top.push(...beadRuns(line,o.motifSpacing??6,o.motifSize??2,o.beadShape??'dash',o.beadTwin===true));});}
    else if(o.stitch==='sequin'){lines.forEach(line=>{if(line.length>1)top.push(...sequinRuns(line,o.motifSpacing??8,(o.motifSize??3)/2,o.sequinTwin===true));});}
    else if(o.stitch==='motif'){lines.forEach(line=>{if(line.length>1)top.push(...(o.motifPair&&o.satinWidth?motifPairLoops(line,t=>widthAt(o,t),o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifShape??'circle',o.motifWarp):motifLoops(line,o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifShape??'circle',o.motifWarp)));});}
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
      if(previous===null){if(currentThread!==null&&!sameThread(currentThread,passThread))push(position?.[0]??start[0],position?.[1]??start[1],'color',passThread);push(...start,'jump',passThread);push(...start,'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}
      else if(!sameThread(currentThread,passThread)){tieOff(currentThread);if(Math.hypot(a[0]-previous[0],a[1]-previous[1])>3){trimIf(previous,a,passThread);push(...start,'jump',passThread);}push(...start,'color',passThread);push(...start,'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}
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
  // Stitches per object: an object's stitches run from its start to the next object's start (the last one runs to the end).
  const objectCounts={};
  objectStarts.forEach(({id,start},r)=>{
    const end=r+1<objectStarts.length?objectStarts[r+1].start:stitches.length;
    let n=0;for(let i=start;i<end;i++)if(stitches[i].cmd==='stitch')n++;
    objectCounts[id]=(objectCounts[id]||0)+n;
  });
  return {revision:doc.revision,stitches,bounds,count,objectCounts,threadLength:Math.round(length*1.12),colors:[...new Set(stitches.filter(s=>s.cmd==='stitch'||s.cmd==='color').map(s=>s.thread).filter(Boolean))],errors:[...new Set(errors)],issues};
}
export {geometry,objectBounds};



// Thread plan: the colours in sewing order. A block starts at the first stitch after a colour change or stop, so the same colour sewn twice gives two blocks, as the editor shows it.
// Two thread strings name the same colour when they differ only in case (#D9897E and #d9897e).

