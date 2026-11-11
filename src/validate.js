// @ts-check
// Document validation: checks a document read from a file or an agent before the engine uses it, and names the first problem.
// The engine re-exports validateDocument, so callers keep importing it from engine.js.
import {getFont,isRegistryFont} from './fonts.js';
import {FABRIC_PRESETS} from './fabrics.js';
import {MAX_TEXT_CHARS} from './textlayout.js';
import {t} from './i18n.js';
import {hasName,objectLabel} from './objectNames.js';

/**
 * The name and the height range, in millimetres, that lettering in this font may have.
 * @param {unknown} font
 * @returns {{name: string, lo: number, hi: number}}
 */
function textSizeRange(font){
  if(font==='neon-blinking/1')return {name:'Néon blinking',lo:20,hi:60};
  if(isRegistryFont(font)){const f=getFont(/** @type {string} */ (font));
    if(f)return {name:f.name||String(font),lo:f.size*f.minScale,hi:f.size*f.maxScale};
    return {name:String(font),lo:2,hi:200};}
  return {name:'Welcome Mono',lo:4,hi:16};
}

// A reference (background) picture for tracing by hand: shown under the shapes in the editor, never sewn.
/**
 * @param {any} r
 * @param {(message: string) => void} fail
 * @returns {void}
 */
function validateReference(r,fail){if(r===undefined)return;const num=(/** @type {any} */ v,/** @type {number} */ lo,/** @type {number} */ hi)=>
  Number.isFinite(v)&&v>=lo&&v<=hi;
  if(!r||typeof r!=='object'||typeof r.data!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.data)||r.data.length>
    1_500_000)fail('the reference image must be a PNG, JPEG, WebP or GIF data URL under 1.5 MB.');
  if(!num(r.x,-2000,2000)||!num(r.y,-2000,2000)||!num(r.w,1,4000)||!num(r.h,1,4000))fail('the reference image needs a position and a size in millimeters.');
  if(r.opacity!==undefined&&!num(r.opacity,.05,1))fail('the reference image opacity must be between 0.05 and 1.');
  for(const k of ['visible','locked'])if(r[k]!==undefined&&typeof r[k]!=='boolean')fail(`the reference image ${k} flag must be true or false.`);
  if(r.name!==undefined&&(typeof r.name!=='string'||r.name.length>200))fail('the reference image name is too long.');}

/**
 * Checks a document read from a file or an agent: it throws an Error naming the first problem. The input is untrusted, so it is typed
 * as any at this boundary and every field is checked before use.
 * @param {any} doc
 * @returns {void}
 */
export function validateDocument(doc){
  const fail=(/** @type {string} */ m)=>{throw Error(`Invalid Welcome project: ${m}`);};
  if(!doc||typeof doc!=='object'||Array.isArray(doc)||doc.schema!=='welcome/1')fail('expected schema welcome/1.');
  if(typeof doc.name!=='string'||!doc.name.trim()||doc.name.length>120)fail('name must contain 1–120 characters.');
  validateReference(doc.reference,fail);
  if(!Number.isSafeInteger(doc.revision)||doc.revision<0)fail('revision must be a nonnegative integer.');
  if(!Number.isFinite(doc.hoop)||doc.hoop<10||doc.hoop>400||(doc.hoopH!==undefined&&(!Number.isFinite(doc.hoopH)||doc.hoopH<10||doc.hoopH>400)))fail(
    'hoop width and height must be between 10 and 400 mm.');
  if(!doc.settings||typeof doc.settings!=='object'||!Number.isFinite(doc.settings.spacing)||doc.settings.spacing<.25||doc.settings.spacing>1.2||
    !Number.isFinite(doc.settings.angle)||doc.settings.angle<0||doc.settings.angle>180||typeof doc.settings.underlay!=='boolean'||
    !Number.isFinite(doc.settings.compensation)||doc.settings.compensation<0||doc.settings.compensation>2)fail(
    'stitch settings are outside the supported ranges.');
  if(doc.settings.fabric!==undefined&&!Object.keys(FABRIC_PRESETS).includes(doc.settings.fabric))fail('document has an unknown fabric.');
  {const st=doc.settings;
    if(st.stitchLength!==undefined&&!(Number.isFinite(st.stitchLength)&&st.stitchLength>=.5&&st.stitchLength<=7)||st.stagger!==undefined&&
    !(Number.isInteger(st.stagger)&&st.stagger>=1&&st.stagger<=8)||st.underlayType!==undefined&&
    !['none','auto','contour','fill','laydown','contour+fill','center','zigzag','center+zigzag','contour+zigzag','center+contour',
    'center+contour+zigzag'].includes(st.underlayType))fail('stitch length must be 0.5–7 mm, stagger 1–8 and underlay type a known value.');}
  if(doc.settings.ties!==undefined&&typeof doc.settings.ties!=='boolean'||doc.settings.trims!==undefined&&typeof doc.settings.trims!=='boolean')fail(
    'ties and trims must be true or false.');
    if(doc.settings.trimMm!==undefined&&!(Number.isFinite(doc.settings.trimMm)&&doc.settings.trimMm>=2&&doc.settings.trimMm<=30))fail(
    'trim length must be 2 to 30 mm.');
  if(!Array.isArray(doc.objects)||doc.objects.length>100)fail('objects must be an array containing at most 100 items.');
  if(doc.guides!==
    undefined&&(!Array.isArray(doc.guides)||doc.guides.length>40||
    doc.guides.some((/** @type {any} */ g)=>!g||!['x','y'].includes(g.axis)||!Number.isFinite(g.pos)||Math.abs(g.pos)>1000)))fail(
    'guides must be an array of at most 40 {axis:"x"|"y",pos} entries within ±1000 mm.');
  if(doc.customFonts!==undefined){const cf=doc.customFonts;
    if(!cf||typeof cf!=='object'||Array.isArray(cf)||Object.keys(cf).length>16)fail('customFonts must be an object with at most 16 fonts.');
    for(const [id,f] of Object.entries(cf)){
    if(!/^[A-Za-z0-9_.-]{1,40}$/.test(id)||!f||!f.glyphs||typeof f.glyphs!=='object'||Array.isArray(f.glyphs)||Object.keys(f.glyphs).length>400||
    !(f.unitsPerEm>0)||!Number.isFinite(f.baseline)||!(f.size>0))fail(`custom font ${id} is invalid (at most 400 glyphs).`);}}
  const ids=new Set();let pointCount=0,stitchCommandCount=0,sourceByteCount=0;const color=/^#[0-9a-fA-F]{6}$/;
  for(const o of doc.objects){
    if(!o||typeof o!=='object'||Array.isArray(o))fail('each object must be an object.');
    if(typeof o.id!=='string'||!o.id||o.id.length>100||ids.has(o.id))fail('object IDs must be unique nonempty strings.');ids.add(o.id);
    if(!['rect','ellipse','path','text','stitch_layer'].includes(o.kind))fail(`object ${o.id} has unsupported kind “${String(o.kind)}”.`);
    if(o.name!==undefined&&(typeof o.name!=='string'||o.name.length>120))fail(`object ${o.id} has an invalid name.`);
    if(o.radius!==undefined&&
      !(o.kind==='rect'&&Number.isFinite(o.radius)&&o.radius>=0&&o.radius<=500))fail(`object ${o.id} radius must be 0–500 mm and only applies to rectangles.`);
      if(o.radii!==
        undefined&&(o.kind!=='rect'||!Array.isArray(o.radii)||o.radii.length!==4||
        o.radii.some((/** @type {any} */ v)=>!Number.isFinite(v)||v<0||v>
        500)))fail(`object ${o.id} radii must be four values from 0 to 500 mm, and only apply to rectangles.`);
    if(o.satinWidthEnd!==undefined&&
      !(o.kind==='path'&&['satin','motif'].includes(o.stitch)&&Number.isFinite(o.satinWidthEnd)&&o.satinWidthEnd>=.5&&o.satinWidthEnd<=
      12))fail(`object ${o.id} end width must be 0.5–12 mm and only applies to satin or motif paths.`);
    if(o.clipId!==undefined&&typeof o.clipId!=='string'||o.mask!==undefined&&typeof o.mask!==
      'boolean')fail(`object ${o.id} has an invalid clipping mask link.`);
    if(o.blendThread!==undefined&&
      !(color.test(o.blendThread)&&o.stitch==='fill'&&o.kind!=='text'&&o.kind!==
      'stitch_layer'))fail(`object ${o.id} can only blend a second thread color into fills.`);
    if(o.blendPalette!==undefined&&o.blendPalette!==null){
      if(
      !(Array.isArray(o.blendPalette)&&o.blendPalette.length>=2&&o.blendPalette.length<=5&&o.blendPalette.every((/** @type {any} */ c)=>color.test(c))&&
      o.stitch==='fill'&&o.kind!=='text'&&o.kind!=='stitch_layer'))fail(`object ${o.id} blendPalette must be 2–5 thread colors for a fill.`);
      if(o.blendThread)fail(`object ${o.id} uses either blendThread or blendPalette, not both.`);}
    if(o.blendAngle!==undefined&&
      !(Number.isFinite(o.blendAngle)&&o.blendAngle>=-360&&o.blendAngle<=360))fail(`object ${o.id} blendAngle must be −360 to 360 degrees.`);
    for(const k of ['blendStart','blendEnd'])if(o[k]!==undefined&&!(Number.isFinite(o[k])&&o[k]>=0&&o[k]<=1))fail(`object ${o.id} ${k} must be 0–1.`);
    if(o.join!==undefined&&!['round','miter','bevel'].includes(o.join)||o.cap!==undefined&&
      !['butt','round','square'].includes(o.cap))fail(`object ${o.id} has an invalid cap or join.`);
    if(o.widthStops!==undefined&&
      !(o.kind==='path'&&['satin','motif'].includes(o.stitch)&&Array.isArray(o.widthStops)&&o.widthStops.length>=1&&o.widthStops.length<=50&&
      o.widthStops.every((/** @type {any} */ st,/** @type {any} */ i)=>Array.isArray(st)&&st.length===2&&Number.isFinite(st[0])&&st[0]>=0&&st[0]<=1&&
      Number.isFinite(st[1])&&st[1]>=.5&&st[1]<=
      12&&(!i||st[0]>=
      o.widthStops[i-1][0]))))fail(`object ${o.id} width stops must be 1–50 sorted [position 0–1, width 0.5–12 mm] pairs on a satin or motif path.`);
    if(o.borderWidth!==undefined&&!(Number.isFinite(o.borderWidth)&&o.borderWidth>=0&&o.borderWidth<=12))fail(`object ${o.id} border width must be 0–12 mm.`);
    if(!color.test(o.thread)||
      !['fill','run','satin','motif','sequin','bead','bling'].includes(o.stitch))fail(`object ${o.id} has an invalid thread color or stitch type.`);
      if(o.stitch===
      'satin'&&(o.kind!==
      'path'||(o.satinWidth!==undefined&&
      !(Number.isFinite(o.satinWidth)&&o.satinWidth>=.5&&o.satinWidth<=12))))fail(`satin stitching needs a path and a column width of 0.5–12 mm (${o.id}).`);
      if(o.satinWidth!==undefined&&o.kind!=='path')fail(`object ${o.id} cannot have a satin width.`);
    if(!Number.isFinite(o.rotation??0)||(o.rotation??0)<-360||(o.rotation??0)>360)fail(`object ${o.id} has invalid rotation.`);
    if(![o.x,o.y].every(Number.isFinite)||Math.abs(o.x)>1000||Math.abs(o.y)>1000)fail(`object ${o.id} has invalid coordinates.`);
    if(o.groupId!==undefined&&(typeof o.groupId!=='string'||!o.groupId||o.groupId.length>100))fail(`object ${o.id} has an invalid group.`);
    if(o.along!==
      undefined&&(o.kind!=='text'||!o.along||typeof o.along!=='object'||typeof o.along.closed!=='boolean'||!Number.isFinite(o.along.offset)||
      !Array.isArray(o.along.points)||o.along.points.length<2||o.along.points.length>1500||
      o.along.points.some((/** @type {any} */ p)=>!Array.isArray(p)||p.length!==2||
      !p.every((/** @type {any} */ v)=>Number.isFinite(v)&&Math.abs(v)<=1000))))fail(`text ${o.id} has an invalid text-on-path attachment.`);
    {const inRange=(/** @type {any} */ v,/** @type {number} */ lo,/** @type {number} */ hi)=>v===undefined||(Number.isFinite(v)&&v>=lo&&v<=hi),
      types=['none','auto','contour','fill','laydown','contour+fill','center','zigzag','center+zigzag','contour+zigzag','center+contour',
      'center+contour+zigzag'];
      if(o.fillMethod!==undefined&&
        !['rows','contour','spiral','meander','guided','cross','ripple','motif','sequin','bling'].includes(
        o.fillMethod))fail(`object ${o.id} fillMethod must be rows, contour, spiral, meander, guided, cross or ripple.`);
      if(o.rippleCenter!==undefined&&
        !(Array.isArray(o.rippleCenter)&&o.rippleCenter.length===2&&
        o.rippleCenter.every((/** @type {any} */ v)=>Number.isFinite(v)&&v>=-1&&v<=
        2)))fail(`object ${o.id} rippleCenter must be [x, y] fractions of the object's bounding box.`);
      if(o.guide!==undefined&&
        !(Array.isArray(o.guide)&&o.guide.length>=2&&o.guide.length<=50&&
        o.guide.every((/** @type {any} */ p)=>Array.isArray(p)&&p.length===2&&
        p.every((/** @type {any} */ v)=>Number.isFinite(v)&&v>=-1&&v<=
        2))))fail(`object ${o.id} guide needs 2–50 [x, y] points as fractions of the object's bounding box.`);
      for(const k of ['startAt','endAt'])if(o[k]!==undefined&&
        !(Array.isArray(o[k])&&o[k].length===2&&
        o[k].every((/** @type {any} */ v)=>Number.isFinite(v)&&v>=0&&v<=
        1)))fail(`object ${o.id} ${k} must be [x, y] fractions (0–1) of the object's bounding box.`);
      if(o.accordionEase!==undefined&&
        !['linear','ease','easeIn','easeOut'].includes(o.accordionEase))fail(`object ${o.id} accordionEase must be linear, ease, easeIn or easeOut.`);
        if((o.accordionStart!==undefined)!==(o.accordionEnd!==undefined)||(o.accordionStart!==undefined&&
        !(inRange(o.accordionStart,.25,1.2)&&inRange(o.accordionEnd,.25,1.2))))fail(`object ${o.id} needs both accordion spacings, each 0.25–1.2 mm.`);
        if(o.stemWidth!==undefined&&!inRange(o.stemWidth,.4,4))fail(`object ${o.id} needs a stem width of 0.4 to 4 mm.`);
        if(o.laydownSpacing!==undefined&&!inRange(o.laydownSpacing,2,8))fail(`object ${o.id} needs a laydown row spacing of 2 to 8 mm.`);
        if(o.raisedAngle!==undefined&&!inRange(o.raisedAngle,-180,180))fail(`object ${o.id} needs a raised underlay turn of -180 to 180 degrees.`);
        if(o.raisedSpacing!==undefined&&!inRange(o.raisedSpacing,1,4))fail(`object ${o.id} needs a raised spacing of 1–4 mm.`);
        if(o.raised!==undefined&&typeof o.raised!=='boolean')fail(`object ${o.id} raised must be true or false.`);
        if(o.endInset!==undefined&&!inRange(o.endInset,0,2))fail(`object ${o.id} needs a satin end inset of 0–2 mm.`);
        if(o.endInsetStart!==undefined&&!inRange(o.endInsetStart,0,2))fail(`object ${o.id} needs a satin start inset of 0–2 mm.`);
        if(o.endInsetEnd!==undefined&&!inRange(o.endInsetEnd,0,2))fail(`object ${o.id} needs a satin end inset of 0–2 mm.`);
        if(o.compensation!==undefined&&!inRange(o.compensation,0,2))fail(`object ${o.id} needs a pull compensation of 0–2 mm.`);
        if((o.pullLeft!==undefined&&!inRange(o.pullLeft,0,2))||(o.pullRight!==undefined&&
        !inRange(o.pullRight,0,2)))fail(`object ${o.id} needs a left and right satin pull of 0–2 mm.`);
      if(o.photo!==undefined){const ph=o.photo;
        if(!(o.kind==='rect'&&o.stitch==='fill')||!ph||typeof ph!=='object'||!Number.isInteger(ph.pw)||!Number.isInteger(ph.ph)||ph.pw<2||ph.ph<2||ph.pw>320||
        ph.ph>320||typeof ph.data!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(ph.data)||Math.floor(ph.data.length*3/4)<ph.pw*ph.ph-2||ph.data.length>
        140000)fail(`object ${o.id} has an invalid photo (a rectangle with a gray picture of up to 320 × 320 samples).`);
        if(ph.thread2!==undefined&&!color.test(ph.thread2)||ph.thread3!==
          undefined&&(!color.test(ph.thread3)||ph.thread2===
          undefined))fail(`object ${o.id} has an invalid photo second or third thread (a third thread needs a second).`);
        if(ph.thread4!==
          undefined&&(!color.test(ph.thread4)||ph.thread3===
          undefined))fail(`object ${o.id} has an invalid photo fourth thread (a fourth thread needs a third).`);
        if(ph.spacing!==undefined&&!inRange(ph.spacing,.3,2)||ph.contrast!==undefined&&!inRange(ph.contrast,.4,3)||ph.invert!==undefined&&
          typeof ph.invert!=='boolean')fail(`object ${o.id} has invalid photo settings.`);}
      if(o.underpath!==undefined&&typeof o.underpath!=='boolean')fail(`object ${o.id} underpath must be true or false.`);
      if(o.runStyle!==undefined&&
        !['single','bean','redwork','stem'].includes(o.runStyle))fail(`object ${o.id} runStyle must be single, bean, redwork or stem.`);
      if(o.lengthVariance!==undefined&&!inRange(o.lengthVariance,0,.5))fail(`object ${o.id} needs a stitch length variance of 0–0.5.`);
      if(o.crossSize!==undefined&&!inRange(o.crossSize,1,8))fail(`object ${o.id} needs a cross stitch size of 1–8 mm.`);
      if(o.applique!==undefined&&
        !(typeof o.applique===
        'boolean'&&(
        !o.applique||(o.stitch==='fill'&&o.kind!=='text'&&o.kind!==
        'stitch_layer'&&(o.kind!=='path'||o.closed)))))fail(`object ${o.id} can only be an appliqué if it is a closed filled shape.`);
      if(o.appliqueWidth!==undefined&&!inRange(o.appliqueWidth,1,8))fail(`object ${o.id} needs an appliqué cover width of 1–8 mm.`);
      if(!inRange(o.stitchLength,.5,7))fail(`object ${o.id} needs a fill stitch length of 0.5–7 mm.`);
        if(o.stagger!==undefined&&!(Number.isInteger(o.stagger)&&o.stagger>=1&&o.stagger<=8))fail(`object ${o.id} needs a stagger of 1–8 (whole number).`);
      if(o.beadTwin!==undefined&&typeof o.beadTwin!=='boolean')fail(`object ${o.id} beadTwin must be true or false.`);
        if(o.beadShape!==undefined&&!['dash','dot'].includes(o.beadShape))fail(`object ${o.id} has an unknown bead shape.`);
        if(o.blingRings!==undefined&&![1,2].includes(o.blingRings))fail(`object ${o.id} blingRings must be 1 or 2.`);
        if(o.stoneTurn!==undefined&&typeof o.stoneTurn!=='boolean')fail(`object ${o.id} stoneTurn must be true or false.`);
        if(o.sequinTwin!==undefined&&typeof o.sequinTwin!=='boolean')fail(`object ${o.id} sequinTwin must be true or false.`);
        if(o.edgeClose!==undefined&&typeof o.edgeClose!=='boolean')fail(`object ${o.id} edgeClose must be true or false.`);
        if(o.motifShape!==undefined&&!['circle','leaf'].includes(o.motifShape))fail(`object ${o.id} has an unknown motif shape.`);
        if(o.motifWarp!==undefined&&!['none','x','y','along'].includes(o.motifWarp))fail(`object ${o.id} has an unknown motif warp.`);
        if(o.blingShape!==undefined&&
        !['round','square','oval','hexagon','star','heart','teardrop','baguette','marquise','pear','cushion'].includes(
        o.blingShape))fail(`object ${o.id} has an unknown bling shape.`);
        if(o.motifSpacing!==undefined&&!inRange(o.motifSpacing,1,20)||o.motifSize!==undefined&&
        !inRange(o.motifSize,.4,6))fail(`object ${o.id} has a motif spacing or size out of range.`);
        if(o.underlayType!==undefined&&!types.includes(o.underlayType))fail(`object ${o.id} has an unknown underlay type.`);
        if(o.underlayType==='laydown'&&o.stitch!=='fill')fail(`object ${o.id} can only use the laydown underlay on a fill.`);
        if(!inRange(o.underlayInset,0,3)||
        !inRange(o.underlaySpacing,.5,8))fail(`object ${o.id} needs an underlay inset of 0–3 mm and underlay spacing of 0.5–8 mm.`);}
    if(o.angle!==undefined&&!(Number.isFinite(o.angle)&&o.angle>=0&&o.angle<=180)||o.spacing!==undefined&&
      !(Number.isFinite(o.spacing)&&o.spacing>=.25&&o.spacing<=1.2))fail(`object ${o.id} has a fill angle outside 0–180° or row spacing outside 0.25–1.2 mm.`);
    if(o.border!==undefined&&typeof o.border!=='boolean'||o.borderThread!==undefined&&!color.test(o.borderThread))fail(`object ${o.id} has an invalid border.`);
    if(o.visible!==undefined&&typeof o.visible!=='boolean'||o.locked!==undefined&&typeof o.locked!==
      'boolean')fail(`object ${o.id} has invalid visibility or lock state.`);
    if(o.kind==='path'){if(![o.w,o.h].every(Number.isFinite)||o.w<0||o.h<0||o.w>2000||o.h>2000)fail(`path ${o.id} has invalid geometry bounds.`);
      if(o.closed!==undefined&&typeof o.closed!=='boolean'||o.smooth!==undefined&&typeof o.smooth!==
      'boolean'||(o.closed&&o.points?.length<3))fail(`path ${o.id} has invalid closed/smooth flags.`);
      if(o.handles!==
      undefined&&(!Array.isArray(o.handles)||o.handles.length!==o.points?.length||
      o.handles.some((/** @type {any} */ h)=>h!==
      null&&(!h||
      ![h.i,h.o].every((/** @type {any} */ q)=>Array.isArray(q)&&q.length===2&&
      q.every((/** @type {any} */ v)=>Number.isFinite(v)&&Math.abs(v)<=1000))))))fail(`path ${o.id} has invalid node handles.`);
      if(o.holes!==
      undefined&&(!o.closed||!Array.isArray(o.holes)||o.holes.length>20||
      o.holes.some((/** @type {any} */ h)=>!Array.isArray(h)||h.length<3||h.length>200||
      h.some((/** @type {any} */ p)=>!Array.isArray(p)||p.length!==2||
      !p.every((/** @type {any} */ v)=>Number.isFinite(v)&&Math.abs(v)<=
      1000)))))fail(`path ${o.id} has invalid holes (closed paths only, up to 20 holes of 3–200 points).`);
      if(o.stitch==='fill'&&!o.closed)fail(`path ${o.id} needs to be closed to be filled.`);
      if(!Array.isArray(o.points)||o.points.length<2||o.points.length>1000)fail(`path ${o.id} needs 2–1,000 points.`);pointCount+=o.points.length;
      if(
      o.points.some((/** @type {any} */ p)=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||
      p.some((/** @type {any} */ v)=>Math.abs(v)>1000)))fail(`path ${o.id} contains invalid points.`);}
    else if(!Number.isFinite(o.w)||!Number.isFinite(o.h)||o.w<=0||o.h<=0||o.w>(o.kind==='stitch_layer'?2000:o.kind==='text'?1000:260)||
      o.h>(o.kind==='stitch_layer'?2000:260))fail(`object ${o.id} needs positive finite dimensions within its supported range.`);
    if(o.kind==='stitch_layer'){
      if(
        !['jef','vp3','dst','sew','pec','pes','exp','hus','xxx','dsb','dsz','tap','tbf','pcs','shv','stx','bro','emd','ksm','10o','u01'].includes(o.source?.format)||
        !Array.isArray(o.threads)||o.threads.length<1||o.threads.length>256||!Array.isArray(o.stitches)||o.stitches.length<1||o.stitches.length>
        250000)fail(`stitch layer ${o.id} exceeds import bounds or has invalid source metadata.`);
      if(!Array.isArray(o.source.bounds)||o.source.bounds.length!==4||
        o.source.bounds.some((/** @type {any} */ v)=>!Number.isFinite(v)||Math.abs(v)>1000)||!o.source.defaultPlacement||
        !['x','y','w','h'].every((/** @type {any} */ k)=>Number.isFinite(o.source.defaultPlacement[k]))||o.source.coordinateMapping!==
        'source_mm_centered_on_editor_origin'||typeof o.source.fileName!=='string'||o.source.fileName.length>240||!Number.isSafeInteger(o.source.size)||
        o.source.size<0||o.source.size>1048576||!(o.source.sha256===null||/^[a-f0-9]{64}$/i.test(o.source.sha256))||!color.test(o.source.defaultThread)||
        o.thread!==o.source.defaultThread&&Object.keys(o.threadOverrides||{}).length===0)fail(`stitch layer ${o.id} has invalid source metadata.`);
      const [bx0,by0,bx1,by1]=o.source.bounds,dw=Math.max(.1,bx1-bx0),dh=Math.max(.1,by1-by0),dp=o.source.defaultPlacement;
      if(dp.x!==-dw/2||dp.y!==-dh/2||dp.w!==dw||dp.h!==dh)fail(`stitch layer ${o.id} has invalid default placement metadata.`);
      if(o.source.originalBytesBase64!==null&&o.source.originalBytesBase64!==
        undefined&&(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(o.source.originalBytesBase64)||o.source.originalBytesBase64.length>
        1398104))fail(`stitch layer ${o.id} has invalid preserved source bytes.`);
      if(o.source.originalBytesBase64&&
        Math.floor(o.source.originalBytesBase64.length*3/4)-(o.source.originalBytesBase64.endsWith('==')?2:o.source.originalBytesBase64.endsWith('=')?1:0)!==
        o.source.size)fail(`stitch layer ${o.id} source byte count does not match its preserved bytes.`);
      sourceByteCount+=o.source.size;if(sourceByteCount>2097152)fail('combined preserved machine source bytes exceed 2 MiB.');
      if(o.source.metadata!==
        undefined&&(!o.source.metadata||typeof o.source.metadata!=='object'||
        Object.entries(o.source.metadata).some(([k,v])=>!['name','category','author','keywords','comments'].includes(k)||typeof v!=='string'||v.length>
        240)))fail(`stitch layer ${o.id} has invalid file metadata.`);
      if(!Array.isArray(o.source.warnings)||o.source.warnings.length>100||
        o.source.warnings.some((/** @type {any} */ v)=>typeof v!=='string'||v.length>500))fail(`stitch layer ${o.id} has invalid reader warnings.`);
      if(
        o.threads.some((/** @type {any} */ t,/** @type {any} */ i)=>!t||Array.isArray(t)||typeof t!=='object'||t.index!==i||
        !(t.color===null||color.test(t.color))||Object.entries(t).length>24||
        Object.entries(t).some(([k,v])=>k.length>64||
        !(v===null||typeof v==='string'&&v.length<=240||typeof v==='boolean'||typeof v==='number'&&
        Number.isFinite(v)))))fail(`stitch layer ${o.id} has invalid ordered thread metadata.`);
      stitchCommandCount+=o.stitches.length;if(stitchCommandCount>250000)fail('total imported stitch command count exceeds 250,000.');let sewable=false,
        ended=false,endCount=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const s of o.stitches){
        if(!s||Array.isArray(s)||Object.keys(s).sort().join(',')!=='cmd,thread,x,y'||!['stitch','jump','trim','color','stop','end'].includes(s.cmd)||
        !Number.isFinite(s.x)||!Number.isFinite(s.y)||Math.abs(s.x)>1000||Math.abs(s.y)>1000||!Number.isInteger(s.thread)||s.thread<0||s.thread>=
        o.threads.length)fail(`stitch layer ${o.id} contains an invalid command.`);if(ended)fail(`stitch layer ${o.id} has commands after end.`);minX=
        Math.min(minX,s.x);minY=Math.min(minY,s.y);maxX=Math.max(maxX,s.x);maxY=Math.max(maxY,s.y);if(s.cmd==='stitch')sewable=true;
        if(s.cmd==='end'){ended=true;endCount++;}}
      if(minX!==bx0||minY!==by0||maxX!==bx1||maxY!==by1)fail(`stitch layer ${o.id} source bounds do not match its command coordinates.`);
      if(!sewable)fail(`stitch layer ${o.id} has no needle stitches.`);
        if(!ended||endCount!==1)fail(`stitch layer ${o.id} must have exactly one terminal end command.`);
      if(o.threadOverrides===undefined)o.threadOverrides={};
      if(!o.threadOverrides||typeof o.threadOverrides!=='object'||Array.isArray(o.threadOverrides)||
        Object.entries(o.threadOverrides).some(([i,v])=>!/^\d+$/.test(i)||Number(i)>=o.threads.length||
        !color.test(v)))fail(`stitch layer ${o.id} has invalid thread replacements.`);
    }
    if(o.kind==='text'){
      const usable=['welcome-mono/1','neon-blinking/1',undefined].includes(o.font)||
        (isRegistryFont(o.font)&&(!o.font.startsWith('custom/')||!!doc.customFonts?.[o.font.slice(7)]));
      if(!usable)fail(hasName(o)?t('{l} uses the font “{font}”, which is not bundled or stored in this project.',{l:objectLabel(o),font:String(o.font)}):
        t('This text uses the font “{font}”, which is not bundled or stored in this project. Choose another font.',{font:String(o.font)}));
      const range=textSizeRange(o.font);
      if(typeof o.text!=='string'||!o.text.trim()||[...o.text].length>(isRegistryFont(o.font)?MAX_TEXT_CHARS:24))
        fail(hasName(o)?t('{l} needs text of 1 to {n} characters.',{l:objectLabel(o),n:String(isRegistryFont(o.font)?MAX_TEXT_CHARS:24)}):
          t('This text needs text of 1 to {n} characters. Type some text into it, or delete it.',{n:String(isRegistryFont(o.font)?MAX_TEXT_CHARS:24)}));
      if(!Number.isFinite(o.h)||o.h<range.lo-1e-6||o.h>range.hi+1e-6)
        fail(hasName(o)?t('{l} is {h} mm tall; the size range of {font} is {lo}–{hi} mm.',{l:objectLabel(o),h:String(o.h),font:range.name,lo:String(range.lo),hi:String(range.hi)}):
          t('This text is {h} mm tall; the size range of {font} is {lo}–{hi} mm. Change its height, or choose another font.',{h:String(o.h),font:range.name,lo:String(range.lo),hi:String(range.hi)}));
    }
    if(o.kind==='text'){const num=(/** @type {any} */ v,/** @type {number} */ lo,/** @type {number} */ hi)=>v===
      undefined||(Number.isFinite(v)&&v>=lo&&v<=hi);
      if(!num(o.tracking,-10,30)||!num(o.wordSpacing,-10,50)||!num(o.lineHeight,.5,3)||!num(o.italic,0,35)||
      !num(o.bold,0,3)||(o.align!==undefined&&
      !['left','center','right'].includes(
      o.align)))fail(`text ${o.id} has an invalid letter spacing, word spacing, line height, italic, bold or alignment value.`);
      if([...String(o.text)].filter((/** @type {any} */ c)=>c==='\n').length>=6)fail(`text ${o.id} has too many lines (6 maximum).`);
      if(o.vertical!==undefined&&typeof o.vertical!=='boolean')fail(`text ${o.id} vertical must be true or false.`);
      if(o.nameDrop!==undefined&&(o.kind!=='text'||typeof o.nameDrop!=='boolean'))fail(`object ${o.id} nameDrop must be true or false, on text objects only.`);
      if(o.vertical){if(String(o.text).includes('\n'))fail(`text ${o.id} is vertical, so it can have one line only.`);
      if(o.along)fail(`text ${o.id} is vertical, so it cannot follow a path.`);
      if(!isRegistryFont(o.font))fail(`text ${o.id} is vertical, which needs a bundled or loaded font.`);}}
  }
  if(pointCount>5000)fail('total path point count exceeds 5,000.');
  return doc;
}
