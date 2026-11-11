// @ts-check
// Document operations: the edits an agent or the editor applies to a document, one operation at a time, in the order given.
// The editor and the MCP server call applyOperations; the engine re-exports it.
import {getFont,isRegistryFont} from './fonts.js';
import {measureText} from './fontHelpers.js';
import {FABRIC_PRESETS} from './fabrics.js';
import {geometry} from './outlines.js';
import {flipObjects,mapPathPoints,normAngle,objById,objectBounds,refreshPathBounds,rotateObjects,scaleObjects,toPathObject,
  translateObject} from './transforms.js';
import {hoopSize} from './hoops.js';
import {refreshAlong,alongPoints,pathSig} from './pathFollow.js';
import {refreshClips} from './clipMasks.js';
import {copyName} from './objectNames.js';
import {booleanShapes,knifeShape,offsetShape,strokeToShape,isClosedShape,appliqueGroup} from './shapeOps.js';
import {removeSmallHoles,removeSmallIslands} from './cleanup.js';
import {roundPathCorners,arrayCopies,simplifyPath,splitPath,joinPaths,reorderObject,redworkGroup,replaceThread,sortByColor,nodeFraction} from './editOps.js';

// The document and the operation payloads are typed as any at this boundary: they come from the agent and MCP surfaces untyped, and each operation checks the
// fields it reads (as validate.js does for documents).
/** @typedef {{objects: any[], [key: string]: any}} Doc */
/** @typedef {any} Operation */

const TEXT_OPTION_KEYS=['tracking','wordSpacing','lineHeight','align','italic','bold','vertical'];

// Object lookup for the operations: the document is untyped at this boundary, so the object comes back as any.
/** @type {(doc: Doc, id: string) => any} */
const objectById=(doc,id)=>objById(doc,id);

/**
 * @param {Doc} doc
 * @param {Operation[]} operations
 * @returns {Doc}
 */
export function applyOperations(doc,operations) {
  if(!doc||doc.schema!=='welcome/1'||!Array.isArray(doc.objects)||!Array.isArray(operations))throw Error('Invalid Welcome document operation.');
  for(const op of operations){
    // A move flags the objects it shifted, so their exports keep the canvas position (see anchor.js). Undo restores snapshots, which carry their own flags.
    const before=MOVE_OPS.has(op.op)?new Map(doc.objects.map(o=>[o.id,[o.x,o.y]])):null;
    applyOperation(doc,op);
    if(before)for(const o of doc.objects){const b=before.get(o.id);if(b&&(o.x!==b[0]||o.y!==b[1]))o.moved=true;}
  }
  refreshAlong(doc);refreshClips(doc);
  return doc;
}

/** Operations that move existing objects; the objects they shift are flagged `moved`. */
const MOVE_OPS=new Set(['translate','transform','align','distribute']);

/**
 * Applies one operation to the document in place.
 * @param {Doc} doc
 * @param {Operation} op
 */
function applyOperation(doc,op){
  {
    if(op.op==='add_shape')doc.objects.push(
      {id:op.id||crypto.randomUUID(),name:op.name|| (op.kind==='ellipse'?'Ellipse':'Rectangle'),kind:op.kind,x:op.x,y:op.y,w:op.width,h:op.height,thread:
      op.thread||'#527461',stitch:op.stitch||'fill',...(op.radius>0&&op.kind==='rect'?{radius:op.radius}:{})});
    else if(op.op==='add_path')doc.objects.push(
      {id:op.id||crypto.randomUUID(),name:op.name||'Path',kind:'path',x:op.x,y:op.y,w:op.width||0,h:op.height||0,points:structuredClone(op.points),thread:
      op.thread||'#527461',stitch:op.stitch==='satin'?'satin':(op.closed||['motif','sequin','bead','bling'].includes(op.stitch))?(op.stitch||'run'):'run',
      ...(op.satinWidth!==undefined?{satinWidth:op.satinWidth}:{}),...(op.closed?{closed:true}:{}),...(op.smooth?{smooth:true}:{}),
      ...(op.border?{border:true}:{}),...(op.handles?{handles:structuredClone(op.handles)}:{})}),refreshPathBounds(doc.objects.at(-1));
    else if(op.op==='add_text'){const rf=isRegistryFont(op.font)?getFont(op.font):null,h=op.height??(rf?rf.size:8),opts=
      Object.fromEntries([...TEXT_OPTION_KEYS,'stitchLength','stagger','underlayType','underlayInset','underlaySpacing','angle','spacing'].filter(k=>op[k]!==
      undefined).map(k=>[k,op[k]]));
      doc.objects.push(
      {id:op.id||crypto.randomUUID(),name:`Text: ${String(op.text).split('\n')[0]}`,kind:'text',text:op.text,x:op.x,y:op.y,w:op.width||
      measureText(op.text,op.font||'welcome-mono/1',h,opts),h,thread:op.thread||'#527461',stitch:op.stitch||(rf?.kind==='outline'?'fill':'run'),font:op.font||
      'welcome-mono/1',...opts});}
    else if(op.op==='clear'){doc.objects=[];}
    else if(op.op==='restore'){if(!Array.isArray(op.objects))throw Error('restore needs the objects to bring back.');doc.objects=
      structuredClone(op.objects);if(op.settings)doc.settings=structuredClone(op.settings);if(op.name)doc.name=op.name;if(op.hoop)doc.hoop=op.hoop;
      if(op.hoopH===undefined)delete doc.hoopH;else doc.hoopH=op.hoopH;if(op.guides)doc.guides=structuredClone(op.guides);else delete doc.guides;}
    else if(op.op==='set_reference'){const r=doc.reference?{...doc.reference}:{};
      for(const k of ['data','x','y','w','h','opacity','visible','locked','name'])if(op[k]!==undefined)r[k]=op[k];
      if(!r.data)throw Error('A reference image needs its picture data.');doc.reference=r;}
    else if(op.op==='clear_reference'){delete doc.reference;}
    else if(op.op==='set_settings'){
      if(op.fabric!==undefined){if(!FABRIC_PRESETS[op.fabric])throw Error('Unknown fabric: '+op.fabric);
      Object.assign(doc.settings,FABRIC_PRESETS[op.fabric],{fabric:op.fabric});}for(
      const k of ['spacing','angle','underlay','compensation','ties','trims','trimMm','stitchLength','stagger','underlayType'])if(op[k]!==
      undefined)doc.settings[k]=op[k];}
    else if(op.op==='rename_document')doc.name=op.name;
    else if(op.op==='set_object'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);
      for(
      const k of ['stitch','thread','name','text','font','border','borderThread','satinWidth','angle','spacing','visible','locked','stitchLength','stagger',
      'underlayType','underlayInset','underlaySpacing','startAt','endAt','fillMethod','guide','radius','radii','satinWidthEnd','raised','buttonhole',
      'motifPair','motifSpacing','motifSize','motifShape','motifWarp','blingShape','sequinTwin','stoneTurn','nameDrop','blingRings','beadShape','beadTwin',
      'endInset','endInsetStart','endInsetEnd','accordionStart','accordionEnd','accordionEase','raisedSpacing','raisedAngle','laydownSpacing','stemWidth',
      'edgeClose','borderWidth','join','cap','widthStops','blendThread','blendPalette','blendStart','blendEnd','blendAngle','rippleCenter','photo',
      'compensation','pullLeft','pullRight','underpath','runStyle','lengthVariance','crossSize','applique','appliqueWidth',...TEXT_OPTION_KEYS])if(op[k]!==
      undefined){if(op[k]===null)delete o[k];else o[k]=op[k];if(op.radius!==undefined&&op.radii===undefined)delete o.radii;}
      if(o.kind==='text'&&(['text','font',...TEXT_OPTION_KEYS].some(k=>op[k]!==undefined))){const f=isRegistryFont(o.font)?getFont(o.font):null;
        if(f&&op.font!==undefined&&op.h===undefined&&!(o.h>=f.size*f.minScale&&o.h<=f.size*f.maxScale))o.h=f.size;o.w=
        measureText(o.text,o.font||'welcome-mono/1',o.h,o);if(op.text!==undefined&&typeof op.text==='string')o.name=`Text: ${op.text.split('\n')[0]}`;}if(
        o.kind==='stitch_layer'&&op.thread!==undefined)o.threadOverrides=
        Object.fromEntries(o.threads.map((/** @type {any} */ _,/** @type {any} */ i)=>[i,op.thread]));}
    else if(op.op==='set_path_point'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);
      {const old=o.points[op.index],dx=op.x-old[0],dy=op.y-old[1],h=o.handles?.[op.index];o.points[op.index]=[op.x,op.y];
      if(h){h.i=[h.i[0]+dx,h.i[1]+dy];h.o=[h.o[0]+dx,h.o[1]+dy];}}refreshPathBounds(o);}
    else if(op.op==='transform'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);const oldX=o.x,oldY=o.y,oldW=o.w||
      0,oldH=o.h||0,nx=op.x??oldX,ny=op.y??oldY,nw=op.width??oldW,nh=op.height??oldH;if(o.along)o.along.points=
      o.along.points.map(/** @type {(p: number[]) => number[]} */(p)=>{const [x,y]=p;return [x+nx-oldX,y+ny-oldY];});
      if(o.kind==='path')mapPathPoints(o,([x,y])=>[nx+(oldW?(x-oldX)*nw/oldW:x-oldX),ny+(oldH?(y-oldY)*nh/oldH:y-oldY)]);o.x=nx;o.y=ny;o.w=nw;o.h=nh;
      if(op.rotation!==undefined){if(op.pivot)rotateObjects(doc,[op.id],normAngle(op.rotation-(Number(o.rotation)||0)),op.pivot.x,op.pivot.y);else o.rotation=
      op.rotation;}}
    else if(op.op==='continue_path'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||!Array.isArray(op.points)||op.points.length<2)throw Error(`Cannot continue path ${op.id}.`);
      if(op.points.length>1000)throw Error('A path is limited to 1,000 points.');o.points=structuredClone(op.points);if(op.handles)o.handles=
      structuredClone(op.handles);else delete o.handles;o.closed=Boolean(op.closed)&&o.points.length>=3;if(op.stitch)o.stitch=op.stitch;refreshPathBounds(o);}
    else if(op.op==='insert_path_point'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||!Number.isInteger(op.index)||op.index<1||op.index>
      o.points.length)throw Error(`Cannot insert path point at ${op.id}[${op.index}].`);
      if(o.points.length>=1000)throw Error('A path is limited to 1,000 points.');o.points.splice(op.index,0,[op.x,op.y]);
      if(o.handles)o.handles.splice(op.index,0,null);refreshPathBounds(o);}
    else if(op.op==='delete_path_point'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);
      if(o.points.length<=2)throw Error('A path needs at least two points.');o.points.splice(op.index,1);
      if(o.handles){o.handles.splice(op.index,1);if(!o.handles.some(Boolean))delete o.handles;}if(o.closed&&o.points.length<3)o.closed=false;
      refreshPathBounds(o);}
    else if(op.op==='set_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);
      if(op.closed!==undefined){if(op.closed&&o.points.length<3)throw Error('Closing a path needs at least three points.');o.closed=op.closed;
      if(!op.closed&&o.stitch==='fill')o.stitch='run';}if(op.smooth!==undefined)o.smooth=op.smooth;}
    else if(op.op==='add_hole'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||!o.closed)throw Error(`Holes need a closed path: ${op.id}`);
      if(!Array.isArray(op.points)||op.points.length<3||op.points.length>200)throw Error('A hole needs 3–200 points.');(o.holes||=[]).push(
      structuredClone(op.points));}
    else if(op.op==='remove_small_holes')removeSmallHoles(doc,op.ids,op.maxArea??1);
    else if(op.op==='remove_small_islands')removeSmallIslands(doc,op.ids,op.maxArea??1);
    else if(op.op==='clear_holes'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);delete o.holes;}
    else if(op.op==='text_on_path'){const t=doc.objects.find(v=>v.id===op.textId),p=doc.objects.find(v=>v.id===op.pathId);
      if(!t||t.kind!=='text')throw Error(`Unknown text object: ${op.textId}`);
      if(!p||p.kind!=='path')throw Error(`Lettering follows a path object: ${op.pathId}`);
      const pts=alongPoints(p);delete t.rotation;t.along={points:pts,closed:Boolean(p.closed),offset:Number(op.offset)||0,pathId:p.id,sig:pathSig(p)};}
    else if(op.op==='set_along_offset'){const t=doc.objects.find(v=>v.id===op.textId);
      if(!t?.along)throw Error(`Lettering ${op.textId} is not attached to a path.`);t.along.offset=Number(op.offset);}
    else if(op.op==='set_width_at_node'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||o.stitch!=='satin')throw Error(`Node widths need a satin path: ${op.id}`);
      if(!Number.isInteger(op.index)||op.index<0||op.index>=o.points.length)throw Error(`Unknown node ${op.index} on ${op.id}.`);
      const t=nodeFraction(o,op.index);let stops=o.widthStops?
        structuredClone(o.widthStops):[[0,Math.max(.5,Number(o.satinWidth)||3)],[1,Math.max(.5,Number(o.satinWidthEnd)||Number(o.satinWidth)||3)]];
      stops=stops.filter((/** @type {any} */ st)=>Math.abs(st[0]-t)>.015);
        if(op.width!==null&&op.width!==undefined){if(!(op.width>=.5&&op.width<=12))throw Error('Width must be 0.5–12 mm.');stops.push([+t.toFixed(4),op.width]);
        }
      stops.sort((/** @type {any} */ x,/** @type {any} */ y)=>x[0]-y[0]);if(stops.length)o.widthStops=stops;else delete o.widthStops;
        if(stops.length>50)throw Error('A width profile is limited to 50 stops.');}
    else if(op.op==='clip'){const m=doc.objects.find(v=>v.id===op.maskId);
      if(!m||!isClosedShape(m))throw Error(`A clipping mask must be a rectangle, ellipse or closed path: ${op.maskId}`);
      if(!Array.isArray(op.ids)||!op.ids.length||op.ids.includes(op.maskId))throw Error('Choose the objects to clip, not including the mask itself.');
      if(m.clipId&&op.ids.includes(m.clipId))throw Error('A mask cannot be clipped by the objects it clips.');
        for(const id of op.ids){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);
        if(o.mask)throw Error('A mask cannot itself be clipped to another mask in the same step; release it first.');o.clipId=op.maskId;}m.mask=true;}
    else if(op.op==='release_clip'){for(const id of op.ids||[]){const o=doc.objects.find(v=>v.id===id);if(o)delete o.clipId;}}
    else if(op.op==='round_corners'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Round corners needs a path: ${op.id}`);
      if(!(Number.isFinite(op.radius)&&op.radius>0&&op.radius<=200))throw Error('Corner radius must be between 0 and 200 mm.');
      if(o.smooth)throw Error('Turn off Smooth curve before rounding corners.');roundPathCorners(o,op.radius,op.indexes);}
    else if(op.op==='text_off_path'){const t=doc.objects.find(v=>v.id===op.textId);
      if(!t||t.kind!=='text')throw Error(`Unknown text object: ${op.textId}`);delete t.along;}
    else if(op.op==='move_path_points'){const o=objectById(doc,op.id);
      if(o.kind!=='path'||!Array.isArray(op.indexes)||!op.indexes.length)throw Error('move_path_points needs a path and a list of node indexes.');const dx=
      Number(op.dx),dy=Number(op.dy);if(![dx,dy].every(Number.isFinite))throw Error('Move needs numeric dx and dy.');
      for(const i of new Set(op.indexes)){if(!Number.isInteger(i)||!o.points[i])throw Error(`Unknown path point: ${op.id}[${i}].`);
      o.points[i]=[o.points[i][0]+dx,o.points[i][1]+dy];const h=o.handles?.[i];if(h){h.i=[h.i[0]+dx,h.i[1]+dy];h.o=[h.o[0]+dx,h.o[1]+dy];}}refreshPathBounds(o);
      }
    else if(op.op==='delete_path_points'){const o=objectById(doc,op.id);
      if(o.kind!=='path'||!Array.isArray(op.indexes)||!op.indexes.length)throw Error('delete_path_points needs a path and a list of node indexes.');
      const idx=[...new Set(op.indexes)].sort((a,b)=>b-a);
      if(idx.some(i=>!Number.isInteger(i)||!o.points[i]))throw Error('Unknown path point in delete_path_points.');
      if(o.points.length-idx.length<(o.closed?3:2))throw Error(o.closed?'A closed path needs at least three nodes.':'A path needs at least two nodes.');
      for(const i of idx){o.points.splice(i,1);if(o.handles)o.handles.splice(i,1);}if(o.handles&&!o.handles.some(Boolean))delete o.handles;refreshPathBounds(o);
      }
    else if(op.op==='add_guide'){
      if(!['x','y'].includes(op.axis)||!Number.isFinite(op.pos)||Math.abs(op.pos)>1000)throw Error(
      'A guide needs an axis (x or y) and a position within ±1000 mm.');(doc.guides||=[]);if(doc.guides.length>=40)throw Error('At most 40 guides.');
      doc.guides.push({axis:op.axis,pos:+op.pos.toFixed(3)});}
    else if(op.op==='move_guide'){const g=doc.guides?.[op.index];
      if(!g||!Number.isFinite(op.pos)||Math.abs(op.pos)>1000)throw Error('Unknown guide or invalid position.');g.pos=+op.pos.toFixed(3);}
    else if(op.op==='remove_guide'){if(!doc.guides?.[op.index])throw Error('Unknown guide.');doc.guides.splice(op.index,1);
      if(!doc.guides.length)delete doc.guides;}
    else if(op.op==='clear_guides'){delete doc.guides;}
    else if(op.op==='scale')scaleObjects(doc,op.ids,Number(op.sx),Number(op.sy),Number(op.ox),Number(op.oy));
    else if(op.op==='rotate')rotateObjects(doc,op.ids,Number(op.angle),Number(op.cx),Number(op.cy));
    else if(op.op==='flip')flipObjects(doc,op.ids,op.axis,op.pivot);
    else if(op.op==='translate'){const dx=Number(op.dx),dy=Number(op.dy);
      if(![dx,dy].every(Number.isFinite))throw Error('Translate needs numeric dx and dy.');for(const id of op.ids)translateObject(objectById(doc,id),dx,dy);}
    else if(op.op==='to_path'){for(const id of op.ids)toPathObject(doc,id);}
    else if(op.op==='remove_unused_fonts'){const used=
      new Set(doc.objects.filter(o=>o.kind==='text'&&String(o.font||'').startsWith('custom/')).map(o=>o.font.slice(7)));
      for(const id of Object.keys(doc.customFonts||{}))if(!used.has(id))delete doc.customFonts[id];}
    else if(op.op==='redwork_outline'){const o=objectById(doc,op.id);
      if(!(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed)))throw Error(
      'Redwork outline needs a closed shape (a rectangle, an ellipse or a closed path).');const ring=geometry(o,0)[0]||[];const pts=ring.length>1&&
      Math.hypot(ring[0][0]-ring[ring.length-1][0],ring[0][1]-ring[ring.length-1][1])<1e-6?ring.slice(0,-1):ring;
      if(pts.length<3)throw Error('Redwork outline needs an outline to follow.');const obj=
      {id:op.newId||crypto.randomUUID(),name:`${o.name||o.kind} redwork`,kind:'path',x:0,y:0,w:0,h:0,points:[...pts,pts[0]].map(p=>[p[0],p[1]]),thread:o.thread,
      stitch:'run',runStyle:'redwork',closed:false};refreshPathBounds(/** @type {any} */(obj));doc.objects.push(obj);}
    else if(op.op==='offset')offsetShape(doc,op.id,op.distance);
    else if(op.op==='stroke_to_shape')strokeToShape(doc,op.id,op.width);
    else if(op.op==='array')arrayCopies(doc,op);
    else if(op.op==='reverse_path'){const o=doc.objects.find(v=>v.id===op.id);if(!o||o.kind!=='path')throw Error(`Unknown path: ${op.id}`);
      o.points.reverse();if(o.handles){o.handles.reverse();o.handles=o.handles.map((/** @type {any} */ h)=>h&&{i:h.o,o:h.i});}}
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
    else if(op.op==='set_path_node_type'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||!Number.isInteger(op.index)||!o.points[op.index])throw Error(`Unknown path point: ${op.id}[${op.index}].`);const n=
      o.points.length;if(!o.handles)o.handles=Array(n).fill(null);
      if(op.type==='corner')o.handles[op.index]=null;
        else if(op.type==='smooth'){const prev=o.points[(op.index-1+n)%n],next=o.points[(op.index+1)%n],p=o.points[op.index],hasPrev=o.closed||op.index>0,
        hasNext=o.closed||op.index<n-1,a=hasPrev?prev:p,b=hasNext?next:p;let tx=b[0]-a[0],ty=b[1]-a[1];const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;const dp=
        hasPrev?Math.hypot(p[0]-prev[0],p[1]-prev[1]):0,dn=hasNext?Math.hypot(next[0]-p[0],next[1]-p[1]):0;o.handles[op.index]=
        {i:[p[0]-tx*dp/3,p[1]-ty*dp/3],o:[p[0]+tx*dn/3,p[1]+ty*dn/3]};}else throw Error(`Unknown node type: ${op.type}`);
      if(!o.handles.some(Boolean))delete o.handles;}
    else if(op.op==='set_path_handle'){const o=doc.objects.find(v=>v.id===op.id);
      if(!o||o.kind!=='path'||!o.handles?.[op.index])throw Error(`Path point ${op.id}[${op.index}] has no handles; make it a smooth node first.`);const h=
      o.handles[op.index],p=o.points[op.index],key=op.which==='in'?'i':op.which==='out'?'o':null;if(!key)throw Error(`Unknown handle: ${op.which}`);
      h[key]=[op.x,op.y];if(op.mirror!==false){const other=key==='i'?'o':'i';h[other]=[2*p[0]-op.x,2*p[1]-op.y];}}
    else if(op.op==='group'){if(!Array.isArray(op.ids)||op.ids.length<2)throw Error('Group needs at least two objects.');const gid=op.groupId||
      crypto.randomUUID();for(const id of op.ids){const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);o.groupId=gid;}}
    else if(op.op==='ungroup'){const gids=
      new Set(
      op.ids.map((/** @type {any} */ id)=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o.groupId;}).filter(
      Boolean));for(const o of doc.objects)if(gids.has(o.groupId))delete o.groupId;}
    else if(op.op==='rotate_hoop'){const {w,h}=hoopSize(/** @type {any} */(doc));doc.hoop=h;doc.hoopH=w;}
    else if(op.op==='set_hoop'){const w=Number(op.width),h=Number(op.height??op.width);
      if(![w,h].every(v=>Number.isFinite(v)&&v>=10&&v<=400))throw Error('Hoop width and height must be between 10 and 400 mm.');doc.hoop=Math.round(w*10)/10;
      if(Math.round(h*10)/10===doc.hoop)delete doc.hoopH;else doc.hoopH=Math.round(h*10)/10;}
    else if(op.op==='align'){const objs=
      op.ids.map((/** @type {any} */ id)=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o;}),boxes=
      objs.map(objectBounds);
      if(op.to==='hoop'&&objs.length<1||op.to!=='hoop'&&objs.length<2)throw Error('Align needs at least two objects, or one object aligned to the hoop.');
      const hs=hoopSize(/** @type {any} */(doc)),hx=hs.w/2,hy=hs.h/2,ref=op.to===
      'hoop'?[-hx,-hy,hx,hy]:[Math.min(...boxes.map((/** @type {any} */ b)=>b[0])),Math.min(...boxes.map((/** @type {any} */ b)=>b[1])),
      Math.max(...boxes.map((/** @type {any} */ b)=>b[2])),Math.max(...boxes.map((/** @type {any} */ b)=>b[3]))];
      objs.forEach((/** @type {any} */ o,/** @type {any} */ i)=>
        {const b=boxes[i];let dx=0,dy=0;if(op.edge==='left')dx=ref[0]-b[0];else if(op.edge==='right')dx=ref[2]-b[2];
        else if(op.edge==='hcenter')dx=(ref[0]+ref[2])/2-(b[0]+b[2])/2;else if(op.edge==='top')dy=ref[1]-b[1];else if(op.edge==='bottom')dy=ref[3]-b[3];
        else if(op.edge==='vcenter')dy=(ref[1]+ref[3])/2-(b[1]+b[3])/2;else throw Error(`Unknown align edge: ${op.edge}`);translateObject(o,dx,dy);});}
    else if(op.op==='distribute'){const objs=
      op.ids.map((/** @type {any} */ id)=>{const o=doc.objects.find(v=>v.id===id);if(!o)throw Error(`Unknown object: ${id}`);return o;});
      if(objs.length<3)throw Error('Distribute needs at least three objects.');const ax=op.axis==='vertical'?1:0;
      if(op.axis!=='horizontal'&&op.axis!=='vertical')throw Error(`Unknown distribute axis: ${op.axis}`);const items=
      objs.map((/** @type {any} */ o)=>({o,b:objectBounds(o)})).sort((/** @type {any} */ a,/** @type {any} */ b)=>(a.b[ax]+a.b[ax+2])-(b.b[ax]+b.b[ax+2])),
      first=items[0].b,last=items.at(-1).b,total=items.reduce((/** @type {any} */ n,/** @type {any} */ i)=>n+i.b[ax+2]-i.b[ax],0),
      gap=((last[ax+2]-first[ax])-total)/(items.length-1);let cursor=first[ax+2]+gap;
      for(const item of items.slice(1,-1)){const d=cursor-item.b[ax];translateObject(item.o,ax?0:d,ax?d:0);cursor+=item.b[ax+2]-item.b[ax]+gap;}}
    else if(op.op==='delete'){const i=doc.objects.findIndex(v=>v.id===op.id);if(i<0)throw Error(`Unknown object: ${op.id}`);doc.objects.splice(i,1);}
    else if(op.op==='duplicate'){const o=doc.objects.find(v=>v.id===op.id);if(!o)throw Error(`Unknown object: ${op.id}`);const copy=structuredClone(o);
      delete copy.groupId;delete copy.moved;copy.id=op.newId||crypto.randomUUID();if(copy.along)copy.along.points=
      copy.along.points.map(/** @type {(p: number[]) => number[]} */(p)=>{const [x,y]=p;return [x+(op.dx??3),y+(op.dy??3)];});copy.name=
      op.name||copyName(o.name,o.kind,doc.objects.map(v=>v.name));copy.x+=op.dx??3;copy.y+=op.dy??3;if(copy.kind==='path')mapPathPoints(copy,([x,y])=>[x+(op.dx??3),y+(op.dy??3)]);
      doc.objects.push(copy);}
    else throw Error(`Unsupported operation: ${op.op}`);
  }
}
