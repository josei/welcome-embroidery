// @ts-check
// Compile: a document's objects become one stitch plan (stitch positions, colour blocks and bounds), in the order they sew.
// The worker, the encoders' callers and the tests call compile; the engine re-exports it.
import {getFont,isRegistryFont,registerDocumentFonts} from './fonts.js';
import {planPhoto,planContour,sampleRun,sampleLine} from './stitchplan.js';
import {GLYPHS} from './lettering.js';
import {geometry,textPrimitives} from './outlines.js';
import {pathDirs,motifLoops,motifPairLoops,sequinRuns,beadRuns,blingRuns} from './embellishments.js';
import {hoopSize} from './hoops.js';
import {clipLines} from './clipMasks.js';
import {sameThread} from './threads.js';
import {closeRing,clipRuns,bartack} from './stitchRuns.js';
import {decodeBase64,importMidpoint} from './stitchImport.js';
import {fillRuns,satinRuns} from './fillStitch.js';
import {validateDocument} from './validate.js';
import {hasName,objectLabel} from './objectNames.js';
import {distP,railsFromLine,railsFromCenterline,widthAt} from './pathGeometry.js';
import {PLAN_STITCH_RULE, splitLongStitchesIndexed} from './encoders/shared.js';

// Rounds to one decimal place (a stitch position in mm).
/** @type {(n: number) => number} */
const round = n => Math.round(n * 10) / 10 + 0; // + 0 turns -0 into 0 so the plan never carries a negative zero

/**
 * Whether sewable bounds [x0,y0,x1,y1] reach past the hoop, which is centred on the origin.
 * @param {number[]} b
 * @param {{w: number, h: number}} hoop
 */
function outsideHoop(b,hoop){return b[0]<-hoop.w/2||b[1]<-hoop.h/2||b[2]>hoop.w/2||b[3]>hoop.h/2;}

/**
 * The refusal for an object that reaches past the hoop: its name and how far it overruns, rounded up to 0.1 mm. The export
 * dialog shows it as the reason an export cannot start.
 * @param {any} o
 * @param {number[]} b
 * @param {{w: number, h: number}} hoop
 */
function hoopMessage(o,b,hoop){
  const over=Math.max(-hoop.w/2-b[0],-hoop.h/2-b[1],b[2]-hoop.w/2,b[3]-hoop.h/2);
  const mm=Math.max(.1,Math.ceil(over*10-1e-6)/10);
  return `${objectLabel(o)} extends ${mm} mm past the hoop. Move it or choose a larger hoop.`;
}


/** Bounds [x0,y0,x1,y1] of a plan's needle positions (stitch commands only); Infinity values if there are none. */
function needleBounds(list){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const p of list)if(p.cmd==='stitch'){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);}
  return [x0,y0,x1,y1];
}

/**
 * @param {any} doc
 * @param {boolean} [legacyPlacement=false] place imports at the source's exact midpoint (the pre-0.1 mm placement). Only the writers
 *   of non-DST formats use this pass, so their bytes stay as they were before the placement fix.
 * @returns {any}
 */
export function compile(doc,legacyPlacement=false) {
  validateDocument(doc);
  // The import midpoint: rounded to the 0.1 mm grid for the DST export and the preview, exact for the legacy writer pass.
  const placementMid=/** @type {(b: number[]) => [number, number]} */(b=>legacyPlacement?[(b[0]+b[2])/2,(b[1]+b[3])/2]:importMidpoint(b));
  const spacing=doc.settings.spacing,angle=doc.settings.angle,comp=doc.settings.compensation,hoop=hoopSize(doc);
  registerDocumentFonts(doc);const unloaded=doc.objects.find((/** @type {any} */ o)=>o.kind==='text'&&isRegistryFont(o.font)&&!getFont(o.font));
    if(unloaded)throw Error(`Font ${unloaded.font} is not loaded yet. Open it in the editor or wait for it to load, then try again.`);
  const unsupportedChars=(/** @type {any} */ o)=>[...String(o.text||'').toUpperCase()].filter((/** @type {any} */ ch)=>ch!==' '&&!GLYPHS[ch]);
  const offenders=doc.objects.map((/** @type {any} */ o)=>[o,o.kind==='text'&&o.font!=='neon-blinking/1'&&!isRegistryFont(o.font)?unsupportedChars(o):[]])
    .filter((/** @type {any} */ [,bad])=>bad.length);
  const missing=[...new Set(offenders.flatMap((/** @type {any} */ [,bad])=>bad))];
  if(missing.length)throw Object.assign(Error(`The bundled single-line alphabet does not support: ${missing.join(' ')}. Use A–Z, 0–9 and spaces.`),
    {details:{unsupported:missing,objectIds:offenders.map((/** @type {any} */ [o])=>o.id)}});
  const records=/** @type {any[]} */([]),errors=[],issues=[];let complexity=0,overall=[Infinity,Infinity,-Infinity,-Infinity];
  for(const o of doc.objects){
    if(o.visible===false||o.mask)continue;
    const comp=o.compensation??doc.settings.compensation;
    if(o.kind==='stitch_layer'){
      const [sx0,sy0,sx1,sy1]=o.source.bounds,[mx,my]=placementMid(o.source.bounds),sx=o.w/Math.max(.1,sx1-sx0),sy=o.h/Math.max(.1,sy1-sy0),a=(Number(o.rotation)||0)*Math.PI/180,c=Math.cos(a),
        sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2;
      const corners=[[sx0,sy0],[sx1,sy0],[sx1,sy1],[sx0,sy1]].map(([x,y])=>
        {const lx=(x-mx)*sx,ly=(y-my)*sy;return [cx+lx*c-ly*sn,cy+lx*sn+ly*c];});
        const b=[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];
        overall=[Math.min(overall[0],b[0]),Math.min(overall[1],b[1]),Math.max(overall[2],b[2]),Math.max(overall[3],b[3])];
        if(outsideHoop(b,hoop)){const m=hoopMessage(o,b,hoop);
        errors.push(m);issues.push({id:o.id,message:m});};records.push({o,stitchLayer:true});complexity+=o.stitches.length;continue;
    }
    const satin=o.stitch==='satin'&&o.kind==='path',rails=satin?railsFromCenterline(o):null,lines=
      satin?(rails?[[...rails.a,...rails.b].map(([x,y])=>[x,y])]:[]):geometry(o,o.stitch==='fill'&&o.kind!=='text'?comp:0),points=lines.flat();
      if(!points.length)continue;
    const maskObj=o.clipId?doc.objects.find((/** @type {any} */ v)=>v.id===o.clipId):null,maskRings=maskObj?geometry(maskObj,0).map(closeRing):null;
    const b=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
    overall=[Math.min(overall[0],b[0]),Math.min(overall[1],b[1]),Math.max(overall[2],b[2]),Math.max(overall[3],b[3])];
    if(outsideHoop(b,hoop)){const m=hoopMessage(o,b,hoop);
      errors.push(m);issues.push({id:o.id,message:m});};
    if(o.stitch==='fill'&&o.kind!=='text')complexity+=Math.ceil((b[3]-b[1])/spacing)*points.length;
    const clippedFill=maskRings&&o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed),useLines=clippedFill?
      clipLines(/** @type {any} */(lines),maskRings):lines;
    if(clippedFill&&!useLines.length){issues.push({id:o.id,message:hasName(o)?`Object ${objectLabel(o)} lies outside its clipping mask, so nothing is sewn.`:
      'This object lies outside its clipping mask, so nothing is sewn. Move it inside the mask, or release the mask.'});continue;}
    records.push({o,lines:useLines,satin,rails,maskRings,clippedFill});
  }
  if(complexity>2_000_000)throw Error('Design exceeds the safe digitizing complexity limit. Simplify geometry or increase row spacing.');
  let stitches=/** @type {any[]} */([]);let leadIn=0;let previous=/** @type {any} */(null),currentThread=/** @type {any} */(null),lastNeedle=/** @type {any} */(null),
    position=/** @type {any} */(null),hasImportedLayer=false;
  const push=(/** @type {any} */ x,/** @type {any} */ y,/** @type {any} */ cmd,/** @type {any} */ thread,preserve=false)=>
    {const rx=round(x),ry=round(y);if(!preserve&&cmd==='stitch'&&lastNeedle&&rx===lastNeedle[0]&&ry===lastNeedle[1])return;
    if(stitches.length-leadIn>=250_000)throw Error('Design exceeds the 250,000 stitch safety limit. Simplify geometry or increase row spacing.');
    stitches.push({x:rx,y:ry,cmd,thread});position=[rx,ry];if(cmd==='stitch')lastNeedle=[rx,ry];};
  const ties=doc.settings.ties===true,trims=doc.settings.trims===true,trimMm=doc.settings.trimMm??5;let lastDir=[1,0];
  // With trims on, any jump of trimMm (5 mm by default) or more after sewing is preceded by a thread cut at the last needle position.
  const trimIf=(/** @type {any} */ from,/** @type {any} */ to,/** @type {any} */ thread)=>
    {if(trims&&lastNeedle&&Math.hypot(to[0]-from[0],to[1]-from[1])>=trimMm)push(lastNeedle[0],lastNeedle[1],'trim',thread);};
  const unit=(/** @type {any} */ a,/** @type {any} */ b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
  // Lock stitches: four 0.4 mm back-and-forth needles. Tie-in runs along the first segment; tie-off runs back along the last one.
  const tieIn=(/** @type {any} */ start,/** @type {any} */ dir,/** @type {any} */ thread)=>
    {if(!ties)return;const q=[start[0]+dir[0]*.4,start[1]+dir[1]*.4];push(q[0],q[1],'stitch',thread);push(start[0],start[1],'stitch',thread);
    push(q[0],q[1],'stitch',thread);push(start[0],start[1],'stitch',thread);};
  const tieOff=(/** @type {any} */ thread)=>
    {if(!ties||!lastNeedle)return;const n=lastNeedle,q=[n[0]-lastDir[0]*.4,n[1]-lastDir[1]*.4];push(q[0],q[1],'stitch',thread);push(n[0],n[1],'stitch',thread);
    push(q[0],q[1],'stitch',thread);push(n[0],n[1],'stitch',thread);};
  // Where each object's stitches start in the list, so the stitch counts per object can be read back after the last one.
  const objectStarts=/** @type {any[]} */([]);
  for(const {o,lines,satin,rails,maskRings,clippedFill} of records){
    objectStarts.push({id:o.id,start:stitches.length});
    const comp=o.compensation??doc.settings.compensation;
    if(o.kind==='stitch_layer'){
      hasImportedLayer=true;
      const [sx0,sy0,sx1,sy1]=o.source.bounds,[mx,my]=placementMid(o.source.bounds),sx=o.w/Math.max(.1,sx1-sx0),sy=o.h/Math.max(.1,sy1-sy0),a=(Number(o.rotation)||0)*Math.PI/180,c=Math.cos(a),
        sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2;
      const firstNeedle=o.stitches.find((/** @type {any} */ s)=>s.cmd==='stitch'),firstThread=
        firstNeedle?(o.threadOverrides[firstNeedle.thread]||o.threads[firstNeedle.thread].color||o.thread):o.thread,firstSewEvent=
        o.stitches.find((/** @type {any} */ s)=>s.cmd==='stitch'||s.cmd==='color'),hasSourceColorBeforeNeedle=firstSewEvent?.cmd==='color';
      if(position&&firstNeedle&&currentThread!==firstThread&&!hasSourceColorBeforeNeedle)push(position[0],position[1],'color',firstThread,true);
      // Writers start from the machine origin (0, 0). When nothing has been emitted yet and the import opens with a sewn stitch away from it, a jump to
      // the first stitch comes first, so no writer sews a lead-in from the origin. Welcome's own objects already open with a jump (see the run and fill paths).
      let leading=stitches.length===0;
      for(const s of o.stitches){const lx=(s.x-mx)*sx,ly=(s.y-my)*sy,x=cx+lx*c-ly*sn,y=cy+lx*sn+ly*c,thread=
        o.threadOverrides[s.thread]||o.threads[s.thread].color||o.thread;if(s.cmd==='end'){position=[round(x),round(y)];continue;}
        // The one added record is not counted against the 250,000 limit, which guards the imported stitches; an import at that limit still compiles.
        if(leading){leading=false;if(s.cmd==='stitch'){stitches.push({x:round(x),y:round(y),cmd:'jump',thread});position=[round(x),round(y)];leadIn=1;}}
        push(x,y,s.cmd,thread,true);
        currentThread=thread;previous=s.cmd==='trim'?null:[round(x),round(y)];}
      continue;
    }
    // Every object becomes ordered runs of needle positions: underlay, top stitching, optional border.
    const filled=!satin&&o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed),runLen=o.stitch==='run'&&o.stitchLength?o.stitchLength:2.5,sp=
      o.spacing??spacing;
    let top=/** @type {any[]} */([]),border=/** @type {any[]} */([]),blend=/** @type {any[]} */([]),paletteRuns=/** @type {any} */(null),
      appl=/** @type {any} */(null),photoSecond=false,tail=/** @type {any} */(previous);
    /** @type {() => any} */
    const cursor=()=>previous||tail;
    const bean=(/** @type {any} */ pts)=>{const out=[pts[0]];for(let i=1;i<pts.length;i++)out.push(pts[i],pts[i-1],pts[i]);return out;},
      // Stem: the stitches alternate to each side of the path, half a stem width away, and both ends sit on the path (a stem-stitch braid).
      stem=(/** @type {any} */ pts)=>
        {const dirs=pathDirs(pts),out=[pts[0]];const half=(o.stemWidth??1.2)/2;
        for(let i=1;i<pts.length-1;i++){const [ux,uy]=dirs[i],side=i%2?1:-1,h=half*side;out.push([pts[i][0]-uy*h,pts[i][1]+ux*h]);}out.push(pts.at(-1));
        return out;},
      asRun=(/** @type {any} */ line,jump=false)=>
        {const pts=sampleRun(line,runLen);const redwork=o.runStyle==='redwork'&&o.stitch==='run';
        return {pts:o.runStyle==='bean'&&o.stitch==='run'?bean(pts):redwork?[...pts,...pts.slice(0,-1).reverse()]:o.runStyle==='stem'&&o.stitch==='run'?
        stem(pts):pts,jump};};
    if(satin){const r=rails;
      if(r){const sat=satinRuns(r.a,r.b,r.rungs||[],o,doc,sp,comp,cursor());top=sat.bad?
      fillRuns([[...r.a,...[...r.b].reverse()]],o,doc,comp,cursor()).top:[...sat.under,...sat.top];
      if(o.buttonhole&&r.a.length>1)top=[...bartack(r.a[0],r.b[0],r.a[1],r.b[1],true),...top,...bartack(r.a.at(-1),r.b.at(-1),r.a.at(-2),r.b.at(-2),false)];}}
    else if(o.kind==='text'&&isRegistryFont(o.font)){
      for(const pr of textPrimitives(o)||[]){
        const from=top.at(-1)?.pts.at(-1)??cursor();
        if(pr.t==='r')top.push(asRun(pr.pts,true));
        else if(pr.t==='s'){const sat=satinRuns(pr.a,pr.b,/** @type {any} */(pr.rungs),o,doc,sp,comp,from);let all;
          if(sat.bad){all=fillRuns([[...pr.a,...[...pr.b].reverse()]],o,doc,comp,from).top;}else all=[...sat.under,...sat.top];if(all.length)all[0].jump=true;
          top.push(...all);}
        else{const {under,top:t}=fillRuns(pr.rings,o,doc,comp,from);const all=[...under,...t];if(all.length)all[0].jump=true;top.push(...all);}
      }
    }
    else if(o.stitch==='bling'){
      lines.forEach((/** @type {any} */ line)=>
      {if(line.length>1)top.push(...blingRuns(line,o.motifSpacing??8,o.motifSize??4,o.blingShape??'round',o.stoneTurn!==false,o.blingRings??2));});}
    else if(o.stitch==='bead'){
      lines.forEach((/** @type {any} */ line)=>
      {if(line.length>1)top.push(...beadRuns(line,o.motifSpacing??6,o.motifSize??2,o.beadShape??'dash',o.beadTwin===true));});}
    else if(o.stitch==='sequin'){
      lines.forEach((/** @type {any} */ line)=>{if(line.length>1)top.push(...sequinRuns(line,o.motifSpacing??8,(o.motifSize??3)/2,o.sequinTwin===true));});}
    else if(o.stitch==='motif'){
      lines.forEach((/** @type {any} */ line)=>
      {
      if(line.length>1)top.push(
      ...(o.motifPair&&o.satinWidth?motifPairLoops(line,t=>widthAt(o,t),o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifShape??'circle',o.motifWarp):
      motifLoops(line,o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifShape??'circle',o.motifWarp)));});}
    else if(!filled){lines.forEach((/** @type {any} */ line,/** @type {any} */ i)=>{if(line.length>1)top.push(asRun(line,o.kind==='text'&&i>=0));});}
    else if(o.photo){
      const ph=o.photo,gray=decodeBase64(ph.data),c=[o.x+o.w/2,o.y+o.h/2],rot=(Number(o.rotation)||0)*Math.PI/180,cs=Math.cos(rot),sn=Math.sin(rot);
      const turn=(/** @type {any} */ r)=>(
        {...r,pts:rot?r.pts.map((/** @type {any} */ p)=>{const [x,y]=p;return [c[0]+(x-c[0])*cs-(y-c[1])*sn,c[1]+(x-c[0])*sn+(y-c[1])*cs];}):r.pts}),sp2=
        ph.spacing??.7,po={spacing:sp2,contrast:ph.contrast??1.4,invert:Boolean(ph.invert)};
      if(ph.thread2&&ph.thread3&&ph.thread4){
        // four tones: light, light-mid, mid-dark, then the main thread for the dark detail, each on its own offset rows
        const box=(/** @type {any} */ dy)=>({x:o.x,y:o.y+dy,w:o.w,h:o.h-dy*2});
        appl=[[planPhoto(gray,ph.pw,ph.ph,box(0),{...po,tone:'light'}).map(turn),ph.thread2],[
          planPhoto(gray,ph.pw,ph.ph,box(sp2/4),{...po,tone:'light-mid'}).map(turn),ph.thread3],[
          planPhoto(gray,ph.pw,ph.ph,box(sp2/2),{...po,tone:'mid-dark'}).map(turn),ph.thread4],[
          planPhoto(gray,ph.pw,ph.ph,box(sp2*3/4),{...po,tone:'dark'}).map(turn),o.thread]];
      }else if(ph.thread2&&ph.thread3){
        // three tones: light (second thread) first, mid-tones (third thread), then the main thread for the dark detail, each on its own set of rows
        const box=(/** @type {any} */ dy)=>({x:o.x,y:o.y+dy,w:o.w,h:o.h-dy*2});
        appl=[[planPhoto(gray,ph.pw,ph.ph,box(0),{...po,tone:'light'}).map(turn),ph.thread2],[
          planPhoto(gray,ph.pw,ph.ph,box(sp2/3),{...po,tone:'mid'}).map(turn),ph.thread3],[
          planPhoto(gray,ph.pw,ph.ph,box(sp2*2/3),{...po,tone:'dark'}).map(turn),o.thread]];
      }else if(ph.thread2){
        // two-tone: the second thread covers everything with a light touch first, the main thread then adds the dark detail between its rows
        blend=planPhoto(gray,ph.pw,ph.ph,{x:o.x,y:o.y,w:o.w,h:o.h},{...po,tone:'light'}).map(turn);top=
          planPhoto(gray,ph.pw,ph.ph,{x:o.x,y:o.y+sp2/2,w:o.w,h:o.h-sp2},{...po,tone:'dark'}).map(turn);
        [top,blend]=[blend,top];photoSecond=true;
      }else top=planPhoto(gray,ph.pw,ph.ph,{x:o.x,y:o.y,w:o.w,h:o.h},po).map(turn);
    }
    else if(o.applique){
      // Appliqué: placement line, [stop: lay the fabric], tack-down, [stop: trim the fabric], satin cover stitch around the edge. The area itself is not
      // filled.
      const rings=(maskRings?clipLines(geometry(o,0),maskRings):geometry(o,0)).filter(l=>l.length>=4),cw=o.appliqueWidth??2.5;
      const placement=rings.map(r=>asRun(r)),tack=planContour(rings,{inset:.5,maxLen:1.8}),cover=[];
      for(const r of rings){const rl=railsFromLine(r,()=>cw/2,{join:o.join,closed:true}),cs=rl?
        satinRuns(rl.a,rl.b,rl.rungs,{...o,startAt:undefined,endAt:undefined,underlayType:'none'},doc,sp,comp,cursor()):null;
        if(cs&&!cs.bad)cover.push(...cs.under,...cs.top);else cover.push(asRun(r));}
      appl=[[placement,o.thread],[tack,o.thread,true],[cover,o.borderThread||o.thread,true]];
    }
    else{const closed=lines.filter((/** @type {any} */ l)=>l.length>=4);
      if(closed.length){const {under,top:t,top2,groups}=fillRuns(closed,o,doc,comp,cursor());top=[...under,...t];blend=top2||[];paletteRuns=groups||null;}}
    if(filled&&o.border&&!o.applique)for(const line of (maskRings?clipLines(geometry(o,0),maskRings):geometry(o,0))){if(line.length<2)continue;
      // a border with a width is a satin column around the outline; width 0 stays a plain running outline
      const bw=Number(o.borderWidth)||0,bl=bw>0?railsFromLine(line,()=>Math.max(.25,bw/2),{join:o.join,closed:distP(line[0],line[line.length-1])<1e-6}):
        null,bs=bl?satinRuns(bl.a,bl.b,bl.rungs,{...o,startAt:undefined,endAt:undefined,underlayType:bw>=1.5?'center':'none'},doc,sp,comp,cursor()):null;
      if(bs&&!bs.bad)border.push(...bs.under,...bs.top);else border.push(asRun(line));}
    if(maskRings&&!clippedFill){top=clipRuns(top,maskRings,!!o.edgeClose);}
    if(maskRings)border=clipRuns(border,maskRings);
    if(maskRings&&blend.length&&!clippedFill)blend=clipRuns(blend,maskRings);
    if(paletteRuns&&maskRings&&!clippedFill)paletteRuns=paletteRuns.map((/** @type {any} */ g)=>clipRuns(g,maskRings));
    const passes=
      appl||(
      paletteRuns?[[top,o.thread],
      ...paletteRuns.map((/** @type {any} */ g,/** @type {any} */ k)=>[g,o.blendPalette[k]]),[border,o.borderThread||o.thread]]:[[top,photoSecond?
      o.photo.thread2:o.thread],[blend,photoSecond?o.thread:(o.blendThread||o.thread)],[border,o.borderThread||o.thread]]);
    for(const [pass,passThread,stopBefore] of passes){let pendingStop=Boolean(stopBefore)&&pass.length>0;for(const run of pass){
      const pts=[];for(const p of run.pts){if(!pts.length||Math.hypot(p[0]-pts.at(-1)[0],p[1]-pts.at(-1)[1])>=.05)pts.push(p);}if(pts.length<2)continue;
      const a=pts[0],start=[round(a[0]),round(a[1])];
      if(previous===null){
        if(currentThread!==null&&!sameThread(currentThread,passThread))push(position?.[0]??start[0],position?.[1]??start[1],'color',passThread);
        push(start[0],start[1],'jump',passThread);push(start[0],start[1],'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}
      else if(!sameThread(currentThread,passThread)){tieOff(currentThread);
        if(Math.hypot(a[0]-previous[0],a[1]-previous[1])>3){trimIf(previous,a,passThread);push(start[0],start[1],'jump',passThread);}push(start[0],start[1],
        'color',passThread);push(start[0],start[1],'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}
      else if(pendingStop){pendingStop=false;tieOff(passThread);const travel=Math.hypot(a[0]-previous[0],a[1]-previous[1]);
        push(previous[0],previous[1],'stop',passThread);
        if(travel>3){trimIf(previous,a,passThread);push(start[0],start[1],'jump',passThread);}push(start[0],start[1],'stitch',passThread);
        tieIn(start,unit(a,pts[1]),passThread);}
      else {const travel=Math.hypot(a[0]-previous[0],a[1]-previous[1]);
        if(run.jump||travel>3){tieOff(passThread);trimIf(previous,a,passThread);push(start[0],start[1],'jump',passThread);
        push(start[0],start[1],'stitch',passThread);tieIn(start,unit(a,pts[1]),passThread);}else if(travel>.05)for(
        const [x,y] of sampleLine(previous,a,1.5))push(x,y,'stitch',passThread);}
      for(let i=1;i<pts.length;i++)push(pts[i][0],pts[i][1],'stitch',passThread);
      lastDir=unit(pts.at(-2),pts.at(-1));previous=pts.at(-1);currentThread=passThread;pendingStop=false;
    }}
  }
  if(previous!==null&&!hasImportedLayer)tieOff(currentThread);
  if(!stitches.some(s=>s.cmd==='stitch'))throw Error('The design has no sewable geometry. Add an object before exporting.');
  if(hasImportedLayer&&position)push(position[0],position[1],'end',currentThread||'#527461',true);
  // The writers get the plan as it was before long moves are split (each writer applies its own rule). The preview and the counts the UI reports
  // use the 12.1 mm split, which is what the DST export sews (DST keeps this list, see encode()). Object starts move with the split.
  const writerStitches=stitches;
  const writerCount=writerStitches.reduce((n,p)=>n+(p.cmd==='stitch'?1:0),0);
  const writerBounds=needleBounds(writerStitches);
  const split=splitLongStitchesIndexed(stitches,PLAN_STITCH_RULE);stitches=split.stitches;
  for(const o of objectStarts)o.start=split.starts[o.start];
  const bounds=needleBounds(stitches);
  const count=stitches.reduce((n,p)=>n+(p.cmd==='stitch'?1:0),0);
  const length=stitches.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-stitches[i-1].x,p.y-stitches[i-1].y):0,0);
  // Stitches per object: an object's stitches run from its start to the next object's start (the last one runs to the end).
  /** @type {Record<string, number>} */
  const objectCounts={};
  objectStarts.forEach(({id,start},r)=>{
    const end=r+1<objectStarts.length?objectStarts[r+1].start:stitches.length;
    let n=0;for(let i=start;i<end;i++)if(stitches[i].cmd==='stitch')n++;
    objectCounts[id]=(objectCounts[id]||0)+n;
  });
  // Non-DST writers take the placement of the legacy pass, so their bytes match the export before the 0.1 mm placement fix.
  const writer=hasImportedLayer&&!legacyPlacement?compile(doc,true).writer:{stitches:writerStitches,count:writerCount,bounds:writerBounds};
  return {revision:doc.revision,stitches,bounds,count,objectCounts,writer,threadLength:Math.round(length*1.12),
    colors:[...new Set(stitches.filter(s=>s.cmd==='stitch'||s.cmd==='color').map(s=>s.thread).filter(Boolean))],errors:[...new Set(errors)],issues};
}
