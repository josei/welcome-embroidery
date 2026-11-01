// Deterministic stitch compiler and JEF/VP3 serializers. Document units are mm.
import {polygonClipping,bufferSegments,closedRing,openRing} from './geom.js';
import {getFont,isRegistryFont,registerDocumentFonts} from './fonts.js';
import {planPhoto,planRippleFill,planCrossStitch,planContourFill,planSpiralFill,planGuidedFill,planMeanderFill,planFill,planContour,planFillUnderlay,sampleRun,makeInside,chainRuns} from './stitchplan.js';
import {layoutText,primitiveLines,mapPrimitives,resamplePrimitives,MAX_TEXT_CHARS} from './textlayout.js';
import {nearestJefColor} from './jefPalette.js';
import {decodeEmbroidery,SEW_CHART,PEC_CHART} from './readers.js';
import {FABRIC_PROFILES,FABRIC_PRESETS,DISTORTION_SCALE,distortionGrid} from './fabrics.js';
import {GLYPHS,parseSvgPath,textLines} from './lettering.js';
import {geometry,textPrimitives,cornerRadii} from './outlines.js';
import {pathDirs,motifLoops,motifPairLoops,motifFillRuns,sequinRuns,beadRuns,blingRuns,blingFillRuns} from './embellishments.js';
import {flipObjects,mapPathPoints,normAngle,objById,objectBounds,refreshPathBounds,rotateObjects,scaleObjects,toPathObject,translateObject} from './transforms.js';
import {HOOP_PRESETS,hoopSize,hoopLabel} from './hoops.js';
import {designWarnings,shapeArea,ringArea} from './designChecks.js';
export {designWarnings,shapeArea};
import {closeRing,insideRings,clipRuns,satinFromRails,underlayTypes,orientRuns,pinPoint,reverseRuns} from './stitchRuns.js';
import {makeStitchLayer,importStitchLayer,decodeBase64} from './stitchImport.js';
export {makeStitchLayer,importStitchLayer};
export {satinFromRails};
import {exportSvg,exportPrintTemplate,exportAppliqueTemplates} from './exports.js';
export {exportSvg,exportPrintTemplate,exportAppliqueTemplates};
import {validateDocument} from './validate.js';
export {validateDocument};
import {sewingWorksheet} from './worksheet.js';
export {sewingWorksheet};
import {initialDocument,batchPlan,batchDocuments} from './document.js';
export {initialDocument,batchPlan,batchDocuments};
import {booleanShapes,knifeShape,offsetShape,strokeToShape} from './shapeOps.js';
export {HOOP_PRESETS,hoopSize,hoopLabel};
export {textPrimitives,cornerRadii};
import {distP,railsFromLine,railsFromCenterline,widthAt} from './pathGeometry.js';
import {roundPathCorners,arrayCopies,simplifyPath,splitPath,joinPaths,reorderObject,redworkGroup,replaceThread,sortByColor,nodeFraction} from './editOps.js';
export {nodeFraction};
export {FABRIC_PROFILES,FABRIC_PRESETS,DISTORTION_SCALE,distortionGrid};
export {parseSvgPath};
export {railsFromLine,widthAt};
import {threadPlan,blockSeconds,blockTimeLabel,sewingSeconds,threadSpans,sewingSecondsUpTo,sewingLabel} from './sewingTime.js';
import {encodeJef,encodeVp3,encodePec,encodePes,encodePesV6,encodeSew,encodeTbf,encodeXxx,encodeU01,encodeExp,encodeDst,encodeCol,encodeEdr,encode,layerCanPassThrough,sourceMatches,vp3LayerHasUnsupportedTravel} from './encoders.js';
export {encodeJef,encodeVp3,encodePec,encodePes,encodePesV6,encodeSew,encodeTbf,encodeXxx,encodeU01,encodeExp,encodeDst,encodeCol,encodeEdr,encode};
export {threadPlan,blockSeconds,blockTimeLabel,sewingSeconds,threadSpans,sewingSecondsUpTo};
import neonFont from '../fonts/neon_blinking/glyphs.js';
const round = n => Math.round(n * 10) / 10;

// Organize fonts: each custom font in the document, with the lettering objects that use it.
// Bundled fonts (Ink/Stitch and open TrueType, registry ids) that lettering in the document uses, with the lettering that uses each. Read-only: bundled fonts ship with the app and are not removed here.
export function bundledFontUsage(doc){const m=new Map();for(const o of doc.objects){if(o.kind!=='text'||!isRegistryFont(o.font)||o.font.startsWith('custom/'))continue;if(!m.has(o.font))m.set(o.font,[]);m.get(o.font).push(o.name||'Lettering');}return [...m].map(([id,uses])=>({id,uses}));}
export function customFontUsage(doc){return Object.entries(doc.customFonts||{}).map(([id,f])=>({id,name:f.name||id,uses:doc.objects.filter(o=>o.kind==='text'&&o.font===`custom/${id}`).map(o=>o.name||'Lettering')}));}
export function jefWarnings(plan,format='jef'){if(format!=='jef'||!plan.bounds)return [];const w=plan.bounds[2]-plan.bounds[0],h=plan.bounds[3]-plan.bounds[1];return w>=200||h>=200?[`Warning: ${w.toFixed(0)} × ${h.toFixed(0)} mm is beyond the largest JEF hoop code (200 × 200 mm); the file gets hoop code 0 and no hoop-edge distances, and machines may reject it.`]:[];}
export function measureText(text,font='welcome-mono/1',size=8,options={}){if(isRegistryFont(font)){const f=getFont(font);if(f)return layoutText({...options,text,font,h:size,w:0,x:0,y:0},f,{buffer:null}).width;return String(text).length*size*.6;}if(font==='neon-blinking/1')return [...String(text).toUpperCase()].reduce((n,ch)=>n+(neonFont.glyphs[ch]?.advance||neonFont.glyphs[' '].advance)*size/neonFont.unitsPerEm,0);return String(text).length*size*.72;}
export function applyOperations(doc,operations) {
  if(!doc||doc.schema!=='welcome/1'||!Array.isArray(doc.objects)||!Array.isArray(operations))throw Error('Invalid Welcome document operation.');
  for(const op of operations){
    if(op.op==='add_shape')doc.objects.push({id:op.id||crypto.randomUUID(),name:op.name|| (op.kind==='ellipse'?'Ellipse':'Rectangle'),kind:op.kind,x:op.x,y:op.y,w:op.width,h:op.height,thread:op.thread||'#527461',stitch:op.stitch||'fill',...(op.radius>0&&op.kind==='rect'?{radius:op.radius}:{})});
    else if(op.op==='add_path')doc.objects.push({id:op.id||crypto.randomUUID(),name:op.name||'Path',kind:'path',x:op.x,y:op.y,w:op.width||0,h:op.height||0,points:structuredClone(op.points),thread:op.thread||'#527461',stitch:op.stitch==='satin'?'satin':(op.closed||['motif','sequin','bead','bling'].includes(op.stitch))?(op.stitch||'run'):'run',...(op.satinWidth!==undefined?{satinWidth:op.satinWidth}:{}),...(op.closed?{closed:true}:{}),...(op.smooth?{smooth:true}:{}),...(op.border?{border:true}:{}),...(op.handles?{handles:structuredClone(op.handles)}:{})}),refreshPathBounds(doc.objects.at(-1));
    else if(op.op==='add_text'){const rf=isRegistryFont(op.font)?getFont(op.font):null,h=op.height??(rf?rf.size:8),opts=Object.fromEntries([...TEXT_OPTION_KEYS,'stitchLength','stagger','underlayType','underlayInset','underlaySpacing','angle','spacing'].filter(k=>op[k]!==undefined).map(k=>[k,op[k]]));doc.objects.push({id:op.id||crypto.randomUUID(),name:`Lettering: ${String(op.text).split('\n')[0]}`,kind:'text',text:op.text,x:op.x,y:op.y,w:op.width||measureText(op.text,op.font||'welcome-mono/1',h,opts),h,thread:op.thread||'#527461',stitch:op.stitch||(rf?.kind==='outline'?'fill':'run'),font:op.font||'welcome-mono/1',...opts});}
    else if(op.op==='clear'){doc.objects=[];}
    else if(op.op==='restore'){if(!Array.isArray(op.objects))throw Error('restore needs the objects to bring back.');doc.objects=structuredClone(op.objects);if(op.settings)doc.settings=structuredClone(op.settings);if(op.name)doc.name=op.name;if(op.hoop)doc.hoop=op.hoop;if(op.hoopH===undefined)delete doc.hoopH;else doc.hoopH=op.hoopH;if(op.guides)doc.guides=structuredClone(op.guides);else delete doc.guides;}
    else if(op.op==='set_reference'){const r=doc.reference?{...doc.reference}:{};for(const k of ['data','x','y','w','h','opacity','visible','locked','name'])if(op[k]!==undefined)r[k]=op[k];if(!r.data)throw Error('A reference image needs its picture data.');doc.reference=r;}
    else if(op.op==='clear_reference'){delete doc.reference;}
    else if(op.op==='set_settings'){if(op.fabric!==undefined){if(!FABRIC_PRESETS[op.fabric])throw Error('Unknown fabric: '+op.fabric);Object.assign(doc.settings,FABRIC_PRESETS[op.fabric],{fabric:op.fabric});}for(const k of ['spacing','angle','underlay','compensation','ties','trims','trimMm','stitchLength','stagger','underlayType'])if(op[k]!==undefined)doc.settings[k]=op[k];}
    else if(op.op==='rename_document')doc.name=op.name;
    else if(op.op==='set_object'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);for(const k of ['stitch','thread','name','text','font','border','borderThread','satinWidth','angle','spacing','visible','locked','stitchLength','stagger','underlayType','underlayInset','underlaySpacing','startAt','endAt','fillMethod','guide','radius','radii','satinWidthEnd','raised','buttonhole','motifPair','motifSpacing','motifSize','motifShape','motifWarp','blingShape','sequinTwin','stoneTurn','nameDrop','blingRings','beadShape','beadTwin','endInset','endInsetStart','endInsetEnd','accordionStart','accordionEnd','accordionEase','raisedSpacing','raisedAngle','laydownSpacing','stemWidth','edgeClose','borderWidth','join','cap','widthStops','blendThread','blendPalette','blendStart','blendEnd','blendAngle','rippleCenter','photo','compensation','pullLeft','pullRight','underpath','runStyle','lengthVariance','crossSize','applique','appliqueWidth',...TEXT_OPTION_KEYS])if(op[k]!==undefined){if(op[k]===null)delete o[k];else o[k]=op[k];if(op.radius!==undefined&&op.radii===undefined)delete o.radii;}
      if(o.kind==='text'&&(['text','font',...TEXT_OPTION_KEYS].some(k=>op[k]!==undefined))){const f=isRegistryFont(o.font)?getFont(o.font):null;if(f&&op.font!==undefined&&op.h===undefined&&!(o.h>=f.size*f.minScale&&o.h<=f.size*f.maxScale))o.h=f.size;o.w=measureText(o.text,o.font||'welcome-mono/1',o.h,o);if(op.text!==undefined&&typeof op.text==='string')o.name=`Lettering: ${op.text.split('\n')[0]}`;}if(o.kind==='stitch_layer'&&op.thread!==undefined)o.threadOverrides=Object.fromEntries(o.threads.map((_,i)=>[i,op.thread]));}
    else if(op.op==='set_path_point'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);{const old=o.points[op.index],dx=op.x-old[0],dy=op.y-old[1],h=o.handles?.[op.index];o.points[op.index]=[op.x,op.y];if(h){h.i=[h.i[0]+dx,h.i[1]+dy];h.o=[h.o[0]+dx,h.o[1]+dy];}}refreshPathBounds(o);}
    else if(op.op==='transform'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);const oldX=o.x,oldY=o.y,oldW=o.w||0,oldH=o.h||0,nx=op.x??oldX,ny=op.y??oldY,nw=op.width??oldW,nh=op.height??oldH;if(o.along)o.along.points=o.along.points.map(([x,y])=>[x+nx-oldX,y+ny-oldY]);if(o.kind==='path')mapPathPoints(o,([x,y])=>[nx+(oldW?(x-oldX)*nw/oldW:x-oldX),ny+(oldH?(y-oldY)*nh/oldH:y-oldY)]);o.x=nx;o.y=ny;o.w=nw;o.h=nh;if(op.rotation!==undefined){if(op.pivot)rotateObjects(doc,[op.id],normAngle(op.rotation-(Number(o.rotation)||0)),op.pivot.x,op.pivot.y);else o.rotation=op.rotation;}}
    else if(op.op==='continue_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Array.isArray(op.points)||op.points.length<2)throw Error(`Cannot continue path ${op.id}.`);if(op.points.length>1000)throw Error('A path is limited to 1,000 points.');o.points=structuredClone(op.points);if(op.handles)o.handles=structuredClone(op.handles);else delete o.handles;o.closed=Boolean(op.closed)&&o.points.length>=3;if(op.stitch)o.stitch=op.stitch;refreshPathBounds(o);}
    else if(op.op==='insert_path_point'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||op.index<1||op.index>o.points.length)throw Error(`Cannot insert path point at ${op.id}[${op.index}].`);if(o.points.length>=1000)throw Error('A path is limited to 1,000 points.');o.points.splice(op.index,0,[op.x,op.y]);if(o.handles)o.handles.splice(op.index,0,null);refreshPathBounds(o);}
    else if(op.op==='delete_path_point'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);if(o.points.length<=2)throw Error('A path needs at least two points.');o.points.splice(op.index,1);if(o.handles){o.handles.splice(op.index,1);if(!o.handles.some(Boolean))delete o.handles;}if(o.closed&&o.points.length<3)o.closed=false;refreshPathBounds(o);}
    else if(op.op==='set_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);if(op.closed!==undefined){if(op.closed&&o.points.length<3)throw Error('Closing a path needs at least three points.');o.closed=op.closed;if(!op.closed&&o.stitch==='fill')o.stitch='run';}if(op.smooth!==undefined)o.smooth=op.smooth;}
    else if(op.op==='add_hole'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!o.closed)throw Error(`Holes need a closed path: ${op.id}`);if(!Array.isArray(op.points)||op.points.length<3||op.points.length>200)throw Error('A hole needs 3–200 points.');(o.holes||=[]).push(structuredClone(op.points));}
    else if(op.op==='remove_small_holes')removeSmallHoles(doc,op.ids,op.maxArea??1);
    else if(op.op==='remove_small_islands')removeSmallIslands(doc,op.ids,op.maxArea??1);
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
    else if(op.op==='remove_unused_fonts'){const used=new Set(doc.objects.filter(o=>o.kind==='text'&&String(o.font||'').startsWith('custom/')).map(o=>o.font.slice(7)));for(const id of Object.keys(doc.customFonts||{}))if(!used.has(id))delete doc.customFonts[id];}
    else if(op.op==='redwork_outline'){const o=objById(doc,op.id);if(!(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed)))throw Error('Redwork outline needs a closed shape (a rectangle, an ellipse or a closed path).');const ring=geometry(o,0)[0]||[];const pts=ring.length>1&&Math.hypot(ring[0][0]-ring.at(-1)[0],ring[0][1]-ring.at(-1)[1])<1e-6?ring.slice(0,-1):ring;if(pts.length<3)throw Error('Redwork outline needs an outline to follow.');const obj={id:op.newId||crypto.randomUUID(),name:`${o.name||o.kind} redwork`,kind:'path',x:0,y:0,w:0,h:0,points:[...pts,pts[0]].map(p=>[p[0],p[1]]),thread:o.thread,stitch:'run',runStyle:'redwork',closed:false};refreshPathBounds(obj);doc.objects.push(obj);}
    else if(op.op==='offset')offsetShape(doc,op.id,op.distance);
    else if(op.op==='stroke_to_shape')strokeToShape(doc,op.id,op.width);
    else if(op.op==='array')arrayCopies(doc,op);
    else if(op.op==='reverse_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);o.points.reverse();if(o.handles){o.handles.reverse();o.handles=o.handles.map(h=>h&&{i:h.o,o:h.i});}}
    else if(op.op==='simplify_path')simplifyPath(doc.objects.find(v=>v.id===op.id),op.tolerance??.2);
    else if(op.op==='split_path')splitPath(doc,op.id,op.index);
    else if(op.op==='join_paths')joinPaths(doc,op.ids,op.close===true);
    else if(op.op==='reorder')reorderObject(doc,op.id,op.to,op.index);
    else if(op.op==='sort_by_color')sortByColor(doc);
    else if(op.op==='replace_thread')replaceThread(doc,op.from,op.to);
    else if(op.op==='redwork_group')redworkGroup(doc,op.ids);
    else if(op.op==='boolean')booleanShapes(doc,op.mode,op.ids);
    else if(op.op==='knife')knifeShape(doc,op.id,op.points??[op.a,op.b]);
    else if(op.op==='applique_group')appliqueGroup(doc,op.ids);
    else if(op.op==='subtract')booleanShapes(doc,'subtract',[op.targetId,op.cutterId]);
    else if(op.op==='set_path_node_type'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);const n=o.points.length;if(!o.handles)o.handles=Array(n).fill(null);
      if(op.type==='corner')o.handles[op.index]=null;else if(op.type==='smooth'){const prev=o.points[(op.index-1+n)%n],next=o.points[(op.index+1)%n],p=o.points[op.index],hasPrev=o.closed||op.index>0,hasNext=o.closed||op.index<n-1,a=hasPrev?prev:p,b=hasNext?next:p;let tx=b[0]-a[0],ty=b[1]-a[1];const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;const dp=hasPrev?Math.hypot(p[0]-prev[0],p[1]-prev[1]):0,dn=hasNext?Math.hypot(next[0]-p[0],next[1]-p[1]):0;o.handles[op.index]={i:[p[0]-tx*dp/3,p[1]-ty*dp/3],o:[p[0]+tx*dn/3,p[1]+ty*dn/3]};}else throw Error(`Unknown node type: ${op.type}`);
      if(!o.handles.some(Boolean))delete o.handles;}
    else if(op.op==='set_path_handle'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path'||!o.handles?.[op.index])throw Error(`Path point ${op.id}[${op.index}] has no handles; make it a smooth node first.`);const h=o.handles[op.index],p=o.points[op.index],key=op.which==='in'?'i':op.which==='out'?'o':null;if(!key)throw Error(`Unknown handle: ${op.which}`);h[key]=[op.x,op.y];if(op.mirror!==false){const other=key==='i'?'o':'i';h[other]=[2*p[0]-op.x,2*p[1]-op.y];}}
    else if(op.op==='group'){if(!Array.isArray(op.ids)||op.ids.length<2)throw Error('Group needs at least two objects.');const gid=op.groupId||crypto.randomUUID();for(const id of op.ids){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);o.groupId=gid;}}
    else if(op.op==='ungroup'){const gids=new Set(op.ids.map(id=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o.groupId;}).filter(Boolean));for(const o of doc.objects)if(gids.has(o.groupId))delete o.groupId;}
    else if(op.op==='rotate_hoop'){const {w,h}=hoopSize(doc);doc.hoop=h;doc.hoopH=w;}
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
function clipLines(lines,maskLines){const poly=ls=>ls.filter(l=>l.length>=3).map(closeRing),a=poly(lines),b=poly(maskLines);if(!a.length||!b.length)return [];
  try{return polygonClipping.intersection(a,b).flatMap(pg=>pg.map(r=>r.map(([x,y])=>[x,y])));}catch{return [];}}
// Clipping masks: a clipped object is sewn only inside its mask (a closed shape that is itself not sewn). Dangling links are cleaned up after every edit.
// A closed shape: a rectangle, an ellipse or a closed path. Clip masks and appliqué from a group use only these.
export const isClosedShape=o=>Boolean(o)&&(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed));
function refreshClips(doc){const ids=new Set(doc.objects.map(o=>o.id));for(const o of doc.objects)if(o.clipId&&(!ids.has(o.clipId)||o.clipId===o.id||!isClosedShape(doc.objects.find(v=>v.id===o.clipId))))delete o.clipId;const used=new Set(doc.objects.map(o=>o.clipId).filter(Boolean));for(const o of doc.objects){if(o.mask&&!used.has(o.id))delete o.mask;else if(!o.mask&&used.has(o.id))o.mask=true;}}
// Lettering attached to a path keeps following it: the path's outline is re-read whenever the path changes (moving the lettering itself does not reattach it).
const pathSig=p=>JSON.stringify([p.points,p.handles,p.closed,p.smooth,p.rotation]);
function alongPoints(p){const raw=geometry(p,0)[0],pts=[];for(const q of raw)if(!pts.length||Math.hypot(q[0]-pts.at(-1)[0],q[1]-pts.at(-1)[1])>1e-6)pts.push([+q[0].toFixed(3),+q[1].toFixed(3)]);if(p.closed&&pts.length>1&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();if(pts.length<2||pts.length>1500)throw Error('The path needs 2–1,500 points after smoothing.');return pts;}
function refreshAlong(doc){for(const t of doc.objects){if(t.kind!=='text'||!t.along?.pathId)continue;const p=doc.objects.find(v=>v.id===t.along.pathId);if(!p||p.kind!=='path'){delete t.along.pathId;delete t.along.sig;continue;}const sig=pathSig(p);if(t.along.sig!==sig){try{t.along.points=alongPoints(p);t.along.closed=Boolean(p.closed);t.along.sig=sig;}catch{}}}}
// Edge travel for fills: when two points lie on the same outline (outer edge or hole edge), walk the shorter way round it
// with running stitches instead of jumping, but only for short detours (≤ 10 mm); long ones stay jumps because edge stitches would clutter the fill. The route follows the border, where later rows or the border pass cover it.
function locateOnRing(ring,p,eps=.05){let arc=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy,len=Math.sqrt(len2);if(len2>0){const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2));if(Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)<=eps)return arc+len*t;}arc+=len;}return null;}
function ringRoute(rings,p,q,maxLength=10){for(const ring of rings){const s1=locateOnRing(ring,p),s2=locateOnRing(ring,q);if(s1===null||s2===null)continue;
  const cum=[0];for(let i=1;i<ring.length;i++)cum.push(cum[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));const L=cum.at(-1);if(L<=0)continue;
  const fwd=(s2-s1+L)%L,back=L-fwd,forward=fwd<=back,dist=Math.min(fwd,back);if(dist>maxLength)return null;
  const out=[];if(forward){for(let i=0;i<ring.length-1;i++){const pos=(cum[i]-s1+L)%L;if(pos>1e-6&&pos<fwd-1e-6)out.push({pos,pt:ring[i]});}}else{for(let i=ring.length-2;i>=0;i--){const pos=(s1-cum[i]+L)%L;if(pos>1e-6&&pos<back-1e-6)out.push({pos,pt:ring[i]});}}
  out.sort((a,b)=>a.pos-b.pos);return [...out.map(o=>o.pt),q];}return null;}
// Appliqué from a group: the selected closed shapes become fills, and the bottom-most one (first in the object order) stays the fabric the others are laid on. Each other shape becomes an appliqué: its placement line, tack-down and satin cover, as a single object's appliqué already sews. Shapes are kept in their object order.
function appliqueGroup(doc,ids){if(!Array.isArray(ids)||ids.length<2)throw Error('Appliqué from a group needs two or more closed shapes.');if(new Set(ids).size!==ids.length)throw Error('Each shape can be chosen once.');
  // Open paths, text and other objects in the selection are left as they are; only the closed shapes take part, and at least two must remain.
  const objs=ids.map(id=>objById(doc,id)).filter(isClosedShape);if(objs.length<2)throw Error('Appliqué from a group needs two or more closed shapes.');
  const ordered=doc.objects.filter(o=>objs.includes(o));const [base,...top]=ordered;
  for(const o of ordered)o.stitch='fill';
  delete base.applique;for(const o of top)o.applique=true;}


// Registry-font lettering: layout -> optional text-on-path -> rotation, returning stitchable primitives in mm (see textlayout.js).
const TEXT_OPTION_KEYS=['tracking','wordSpacing','lineHeight','align','italic','bold','vertical'];

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

// Remove small holes: every hole under 1 mm² is dropped from the selected closed paths (other holes stay). Holes are rings in the same millimetre coordinates as the outline.
const holeArea=h=>{let a=0;for(let i=0;i<h.length;i++){const p=h[i],q=h[(i+1)%h.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a/2);};
// How many of a path's holes are under 1 mm² (the ones remove_small_holes drops).
export function countSmallHoles(o,maxArea=1){return (o?.holes||[]).filter(h=>holeArea(h)<maxArea).length;}
function removeSmallHoles(doc,ids,maxArea=1){if(!Array.isArray(ids)||!ids.length)throw Error('Remove small holes needs the closed paths to clean.');if(!(Number.isFinite(maxArea)&&maxArea>=.1&&maxArea<=20))throw Error('The hole limit must be 0.1 to 20 mm².');for(const id of ids){const o=objById(doc,id);if(!(o.kind==='path'&&o.closed===true))throw Error('Remove small holes works on closed paths.');if(!o.holes)continue;const kept=o.holes.filter(h=>holeArea(h)>=maxArea);if(kept.length)o.holes=kept;else delete o.holes;}}
// Remove small islands: a closed shape whose area (its outline less its holes) is under the island limit is deleted as a whole object. Boolean and knife results already come out as separate objects, so this clears the tiny pieces they leave.
export function isSmallIsland(o,maxArea=1){return isClosedShape(o)&&shapeArea(geometry(o,0))<maxArea;}
function removeSmallIslands(doc,ids,maxArea=1){if(!Array.isArray(ids)||!ids.length)throw Error('Remove small islands needs the closed shapes to check.');if(!(Number.isFinite(maxArea)&&maxArea>=.1&&maxArea<=20))throw Error('The island limit must be 0.1 to 20 mm².');for(const id of ids)if(!isClosedShape(objById(doc,id)))throw Error('Remove small islands works on closed shapes.');const drop=new Set(ids.filter(id=>isSmallIsland(objById(doc,id),maxArea)));for(let i=doc.objects.length-1;i>=0;i--)if(drop.has(doc.objects[i].id))doc.objects.splice(i,1);}
function fillRuns(rings,o,doc,comp,from=null){
  const sPt=pinPoint(o,o.startAt),ePt=pinPoint(o,o.endAt);if(sPt)from=sPt;
  const closed=rings.map(closedRing).filter(r=>r.length>=4);if(!closed.length)return {under:[],top:[]};
  const sp=o.spacing??doc.settings.spacing,an=o.angle??doc.settings.angle,L=o.stitchLength??doc.settings.stitchLength??3,st=o.stagger??doc.settings.stagger??4,area=shapeArea(closed),perimeter=closed.reduce((n,r)=>n+r.reduce((m,p,i)=>i?m+distP(p,r[i-1]):0,0),0),meanWidth=perimeter?2*area/perimeter:0,types=meanWidth<1.4?new Set():underlayTypes(o,doc,'fill',area),under=[];
  if(types.has('contour'))under.push(...planContour(closed,{inset:(o.underlayInset??.4)+comp}));
  if(types.has('fill'))under.push(...planFillUnderlay(closed,{angle:an+90,spacing:o.underlaySpacing??2.2,length:3.5,inset:(o.underlayInset??.6)+comp}));
  // Laydown: a light fill at wide 4 mm rows, across the grain of the top fill, to flatten the pile of towelling and fleece.
  if(types.has('laydown'))under.push(...planFillUnderlay(closed,{angle:an+90,spacing:o.laydownSpacing??4,length:3.5,inset:(o.underlayInset??.6)+comp}));
  // Raised fill: a second tatami underlay at 2 mm rows, at the same 90° as the top fill's underlay, so the fill stands up.
  if(o.raised)under.push(...planFillUnderlay(closed,{angle:an+(o.raisedAngle??90),spacing:o.raisedSpacing??2,length:3.5,inset:(o.underlayInset??.6)+comp}));
  const oriented=orientRuns(under,from),last=oriented.at(-1)?.pts.at(-1)??from,inside=makeInside(closed),fillOpts={spacing:sp,angle:an,length:L,stagger:st,variance:o.lengthVariance??0,underpath:o.underpath??true,accordion:o.accordionStart!==undefined?[o.accordionStart,o.accordionEnd,o.accordionEase??'linear']:null};
  const guide=o.fillMethod==='guided'&&o.guide?o.guide.map(f=>pinPoint(o,f)).filter(Boolean):null,
    planTop=(at,rs=closed)=>{switch(o.fillMethod){case 'contour':return planContourFill(rs,{spacing:sp,length:L,from:at});case 'spiral':return planSpiralFill(rs,{spacing:sp,length:L,from:at});case 'meander':return planMeanderFill(rs,{spacing:sp,length:L,from:at});case 'ripple':{const rc=pinPoint(o,o.rippleCenter||[.5,.5]);return clipRuns(planRippleFill(rs,{spacing:sp,length:L,center:rc,from:at}),rs.map(closeRing));}case 'cross':return planCrossStitch(rs,{size:o.crossSize??2.5,from:at});case 'motif':return motifFillRuns(rs,o.motifSpacing??4,(o.motifSize??1.6)/2,o.motifWarp);case 'sequin':return motifFillRuns(rs,o.motifSpacing??8,(o.motifSize??3)/2,'none',true);case 'bling':return blingFillRuns(rs,o.motifSpacing??8,o.motifSize??4,o.blingShape??'round',o.blingRings??2);case 'guided':return guide&&guide.length>=2?planGuidedFill(rs,guide,{...fillOpts,from:at}):planFill(rs,{...fillOpts,from:at});default:return planFill(rs,{...fillOpts,from:at});}};
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
// Bar tack across the end of a buttonhole: a short zigzag between the two rails, stepping outwards from the column.
function bartack(a,b,na,nb,jump){const dx=a[0]-na[0],dy=a[1]-na[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l,pts=[];for(let k=0;k<6;k++){const p=k%2?b:a,s=Math.floor(k/2)*.35;pts.push([p[0]+ux*s,p[1]+uy*s]);}return [{pts,jump}];}
function satinRuns(a,b,rungs,o,doc,spacing,comp,from=null){
  const sPt=pinPoint(o,o.startAt),ePt=pinPoint(o,o.endAt);if(sPt)from=sPt;
  const {zig,pairs}=satinFromRails(a,b,spacing,o.pullRight??comp,rungs,o.pullLeft??comp);if(zig.length<2)return {under:[],top:[]};
  // Rails that cannot be paired sensibly (stitches longer than a machine accepts) are reported so the caller can sew the column as a fill instead.
  if(zig.some((p,i)=>i&&distP(p,zig[i-1])>12.2))return {bad:true,under:[],top:[]};
  // Satin end inset: the first and last needle move inward along the column by endInset, so the end stitches are shorter. zig and pairs have one entry per needle pair.
  const insetStart=o.endInsetStart??o.endInset??0,insetEnd=o.endInsetEnd??o.endInset??0;
  if((insetStart>0||insetEnd>0)&&zig.length>2){const mid=k=>[(pairs[k][0][0]+pairs[k][1][0])/2,(pairs[k][0][1]+pairs[k][1][1])/2],unit=(from,to)=>{const l=distP(from,to)||1;return [(to[0]-from[0])/l,(to[1]-from[1])/l];},n=zig.length-1,inward=k=>{for(let j=k?k-1:k+1;j>=0&&j<=n;j+=k?-1:1)if(distP(mid(j),mid(k))>1e-3)return unit(mid(k),mid(j));return [0,0];},d0=inward(0),dn=inward(n);zig[0]=[zig[0][0]+d0[0]*insetStart,zig[0][1]+d0[1]*insetStart];zig[n]=[zig[n][0]+dn[0]*insetEnd,zig[n][1]+dn[1]*insetEnd];}
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


// The sewing tip categories, in the order the Tips settings list shows them. Each warning from designWarnings carries one of these ids.
export const TIP_CATEGORIES=[{id:'hoop',label:'Outside the hoop'},{id:'duplicate',label:'Duplicate objects'},{id:'fill',label:'Small or thin fills'},{id:'short',label:'Very short paths'},{id:'satin',label:'Satin columns too narrow or too wide'},{id:'lettering',label:'Small lettering'},{id:'fabric',label:'Fabric stabilizer'}];
// Drops the tips whose category is hidden. A hidden id that is not a category matches nothing, so it is ignored.
export function visibleTips(warnings,hidden=[]){const off=new Set(hidden);return warnings.filter(w=>!off.has(w.category));}

// Thread plan: the colours in sewing order. A block starts at the first stitch after a colour change or stop, so the same colour sewn twice gives two blocks, as the editor shows it.
// Two thread strings name the same colour when they differ only in case (#D9897E and #d9897e).
const sameThread=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();

// SVG <path> fill rule. A path with a fill (not none) and no stroke imports as fill objects when its subpaths are closed rings and nest at most two levels: one outer ring (depth 0), holes inside it (depth 1, up to 20 of up to 200 points), and islands inside a hole (depth 2, each its own fill object, up to 1,000 points). Deeper nesting, or several outer rings, keeps the running-outline import and the note says why. Returns {fill, note, holes, islands, depths}: depths gives each subpath's depth, and holes and islands count the depth 1 and depth 2 rings.
export function svgPathFill(fill,stroke,subpaths){const filled=fill!==null&&fill!==undefined&&fill!=='none',stroked=stroke!==null&&stroke!==undefined&&stroke!=='none';const none={fill:false,note:null,holes:0,islands:0,depths:[]};if(!filled||stroked)return none;
const closedRing=pts=>pts.length>=3&&Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<1e-9;
const outlineNote=(text)=>({...none,note:text});
if(!subpaths.every(closedRing))return outlineNote(subpaths.length===1?'A filled path that is not closed imports as an outline.':'A filled path with several subpaths, some not closed, imports as an outline.');
const rings=subpaths.map(r=>r.slice(0,-1));
const depths=rings.map((r,i)=>rings.reduce((n,q,j)=>n+(j!==i&&insideRings([q],r[0])?1:0),0));
if(depths.filter(d=>d===0).length!==1)return outlineNote('A filled path with several outer shapes imports as an outline: its counters would otherwise fill in.');
const holes=depths.filter(d=>d===1).length,islands=depths.filter(d=>d===2).length;
const deep=depths.some(d=>d>2);const tooBig=rings.some((r,i)=>(depths[i]===1&&r.length>200)||(depths[i]===2&&r.length>1000))||holes>20||islands>20;
if(deep||tooBig)return outlineNote('A filled path with counters nested deeper than an island in a hole, or too many points, imports as an outline.');
return {fill:true,note:null,holes,islands,depths};}
// The user's own thread stock: a list of six-digit hex colours, one per line (commas and spaces are also accepted). Returns the valid colours, each once, and how many entries were not valid colours.
export function parseThreadStock(text){const entries=String(text??'').split(/[\s,]+/).filter(Boolean);const colours=[];let invalid=0;for(const e of entries){const m=e.match(/^#?([0-9a-f]{6})$/i);if(!m){invalid++;continue;}const hex='#'+m[1].toLowerCase();if(!colours.includes(hex))colours.push(hex);}return {colours,invalid};}
// The nearest thread in the stock to a colour, by squared RGB distance: {hex, index (1-based in the stock), distance}, or null when the stock is empty.
export function nearestStockThread(hex,stock){if(!Array.isArray(stock)||!stock.length)return null;const rgb=h=>[0,2,4].map(i=>parseInt(h.slice(1+i,3+i),16));const a=rgb(hex);let best=null;stock.forEach((s,i)=>{const b=rgb(s),d=(b[0]-a[0])**2+(b[1]-a[1])**2+(b[2]-a[2])**2;if(!best||d<best.distance)best={hex:s,index:i+1,distance:d};});return best;}
// Measure tool: the straight-line distance between two points in mm, with its x and y parts (b minus a, so the signs say which way the second point lies).
export function measureBetween(a,b){const dx=b[0]-a[0],dy=b[1]-a[1];return {distance:Math.hypot(dx,dy),dx,dy};}
