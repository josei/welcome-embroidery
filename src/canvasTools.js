// @ts-check
// Canvas draw tools: the tool modes and their hints, adding shapes and lettering, the path and pen drafts with their
// preview, the line/polygon/star drag, the measure and knife clicks, and the canvas and window pointer listeners that
// drive them. canvas.js creates it and registers the listeners; app.js calls what it needs through canvasView.
import {geometry} from './engine.js';
import {getFont} from './fonts.js';
import {documentNow} from './documentState.js';
import {selState,setSelection} from './selectionState.js';
import {pathDraftNow,setPathDraft,replaceAt} from './pathDraftState.js';
import {toolMode,toolActions} from './toolMode.js';
import {stitchChoicesState} from './stitchChoicesState.js';
import {measureState} from './measureState.js';
import {knifeState} from './knifeState.js';
import {t} from './i18n.js';
import {enterEdit} from './canvasText.js';

const NS='http://www.w3.org/2000/svg';
const $=(/** @type {string} */ s)=>/** @type {any} */(document.querySelector(s));
const node=(/** @type {string} */ tag)=>/** @type {any} */(document.createElementNS(NS,tag));
/** @type {Record<string, string>} */
const TOOL_HINTS={
  measure:'Click two points to measure the distance. Esc leaves the tool.',
  knife:'Click points along the cut across the selected closed shape, then Enter to cut. Esc leaves the tool.',
  path:'Click to add points. Click the first point to close a polygon, Enter or double-click to finish.',
  pen:'Click to add corner nodes, drag to pull curve handles. Click the first node to close, Enter to finish.',
  line:'Drag on the canvas to draw a line.',
  polygon:'Drag from the center to size and rotate. Sides come from the sidebar.',
  star:'Drag from the center to size and rotate. Points come from the sidebar.',
};

/**
 * @param {any} api
 *  canvas: refresh(), snapPt(p), showSnap(hit), px(n);
 *  edits: commit(ops, after), render(), toast(text), setEditing(on), selectedObject();
 *  lettering: textFont(), ensureFontLoaded(id), fitHeight(fontId, text).
 */
export function createCanvasTools(api){
  /**
   * The pointer position in mm, from the canvas's own coordinate system.
   * @param {any} e
   * @returns {[number, number]}
   */
  function coord(e){
    const p=$('#art').createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    const q=p.matrixTransform($('#art').getScreenCTM().inverse());
    return [q.x,q.y];
  }

  /** The ids of the object and the rest of its group, or just the object when it is not grouped. */
  const withGroup=(/** @type {string} */ id)=>{
    const g=documentNow().doc.objects.find((/** @type {any} */ o)=>o.id===id)?.groupId;
    return g?new Set(documentNow().doc.objects.filter((/** @type {any} */ o)=>o.groupId===g).map((/** @type {any} */ o)=>o.id)):new Set([id]);
  };

  // A new shape or lettering object goes in at the hoop's centre with the thread and stitch in the sidebar.
  async function add(/** @type {string} */ kind){
    const id=crypto.randomUUID();
    if(kind==='text'){
      try{await api.ensureFontLoaded(api.textFont());}catch(/** @type {any} */ error){api.toast(error.message, 'error');return;}
      const f=getFont(api.textFont());
      api.commit([{op:'add_text',id,text:'BLOOM',x:-18,y:18,height:api.fitHeight(api.textFont(),'BLOOM'),
        thread:$('#thread').value,font:api.textFont(),...(f?.kind==='outline'?{stitch:'fill'}:{})}],()=>{
        setSelection({selected: id});setSelection({multi: new Set([id])});
        // The new object opens in the on-canvas text box with its placeholder selected, so typing replaces it. The box
        // takes the keystrokes, so letters never reach the tool shortcuts.
        enterEdit(documentNow().doc.objects.find((/** @type {any} */ o)=>o.id===id));
      });
      return;
    }
    api.commit([{op:'add_shape',id,kind,name:kind==='ellipse'?'Ellipse':'Rectangle',x:-12,y:-8,width:24,height:16,
      thread:$('#thread').value,stitch:(stitchChoicesState.get().type==='satin'?'fill':stitchChoicesState.get().type)}],()=>{
      setSelection({selected: id});
    });
  }

  // The path and pen tools draw their draft over the design: the polyline (or the pen's curve outline), the handles
  // of each node, and a marker per node with the first one larger once the path can be closed.
  /**
   * @param {any} [cursor]
   */
  function drawPathPreview(cursor){
    const root=$('#stitches');root.replaceChildren();
    if(!pathDraftNow().pathPoints.length)return;
    const pts=cursor&&toolMode.get()==='path'?[...pathDraftNow().pathPoints,cursor]:pathDraftNow().pathPoints;
    const outline=toolMode.get()==='pen'&&pathDraftNow().pathPoints.length>=2
      ?geometry(/** @type {any} */ ({kind:'path',points:pathDraftNow().pathPoints,handles:pathDraftNow().pathHandles,closed:false}))[0]
      :pts;
    const line=node('polyline');
    line.setAttribute('points',outline.map((/** @type {any} */ p)=>p.join(',')).join(' '));
    line.setAttribute('fill','none');line.setAttribute('stroke','#1c7a67');
    line.setAttribute('stroke-width','.45');line.setAttribute('stroke-dasharray','1.2 .8');
    root.append(line);
    pathDraftNow().pathPoints.forEach((/** @type {any} */ p,/** @type {number} */ i)=>{
      const h=pathDraftNow().pathHandles[i];
      if(h)for(const q of [h.i,h.o]){
        const l=node('line');
        l.setAttribute('x1',p[0]);l.setAttribute('y1',p[1]);l.setAttribute('x2',q[0]);l.setAttribute('y2',q[1]);
        l.setAttribute('stroke','#1c7a67');l.setAttribute('stroke-width','.25');root.append(l);
      }
      const marker=node('circle');
      marker.setAttribute('cx',p[0]);marker.setAttribute('cy',p[1]);
      marker.setAttribute('r',api.canvas.px(i===0&&pathDraftNow().pathPoints.length>2?6:4));
      marker.setAttribute('fill',i===0?'#1c7a67':'#fff');
      marker.setAttribute('stroke','#1c7a67');marker.setAttribute('stroke-width','.3');root.append(marker);
    });
  }

  // Picking the tool already in use goes back to select; switching away finishes a path that has enough points.
  function setTool(/** @type {any} */ next){
    if(next===toolMode.get()&&next!=='select')next='select';
    if(pathDraftNow().pathMode&&pathDraftNow().pathPoints.length>=2&&next!==toolMode.get())endPath(false,false,true);
    api.canvas.showSnap(null);
    if(next!=='measure')measureState.set(null);
    if(next!=='knife')knifeState.set([]);
    toolMode.set(next);
    setPathDraft({pathMode: toolMode.get()==='path'||toolMode.get()==='pen'});
    setPathDraft({pathPoints: []});
    setPathDraft({pathHandles: []});
    setPathDraft({penDown: null});
    setPathDraft({shapeDrag: null});
    $('#art').classList.toggle('drawing',toolMode.get()!=='select');
    $('.sides-row').hidden=!(toolMode.get()==='polygon'||toolMode.get()==='star');
    $('#stitches').replaceChildren();
    if(toolMode.get()!=='select')api.toast(t(TOOL_HINTS[toolMode.get()]));
    if(toolMode.get()!=='select'&&toolMode.get()!=='knife'&&selState().selected){
      setSelection({selected: null});setSelection({multi: new Set()});setSelection({selNode: null});api.render();
    }
  }

  // Continue an existing path with the pen: its points become the draft, so Enter or the first point finishes it.
  function continueDigitizing(/** @type {any} */ o){
    const points=o.points.map((/** @type {any} */ p)=>[p[0],p[1]]);
    setTool('pen');
    setPathDraft({pathPoints: points});
    setPathDraft({pathHandles: points.map((/** @type {any} */ _,/** @type {number} */ i)=>o.handles?.[i]||null)});
    setPathDraft({pathMode: true});
    setPathDraft({continueId: o.id});
    setPathDraft({continueStitch: o.stitch||'run'});
    api.toast(t('Click to add points. Click the first point to close the path, or press Enter to finish.'));
  }

  // Commits the drafted path (or continues the one it started from) and clears the draft. Silent leaves the tool
  // alone, which is how setTool finishes a path while switching to a different tool.
  function endPath(closed=false,cancel=false,silent=false){
    const draft=pathDraftNow();
    const penHandles=draft.pathHandles.some(Boolean)?draft.pathHandles.map(h=>h||null):null;
    if(!cancel&&draft.continueId&&draft.pathPoints.length>=(closed?3:2)){
      const continueId=draft.continueId;
      const stitch=closed||draft.continueStitch!=='fill'?draft.continueStitch:'run';
      api.commit([{op:'continue_path',id:continueId,points:draft.pathPoints,...(penHandles?{handles:penHandles}:{}),
        closed:Boolean(closed),stitch}],()=>{
        setSelection({selected: continueId});setSelection({multi: new Set([continueId])});
      });
    }else if(!cancel&&draft.pathPoints.length>=(closed?3:2)){
      const id=crypto.randomUUID();
      api.commit([{op:'add_path',id,name:closed?'Polygon':'Drawn path',x:0,y:0,points:draft.pathPoints,
        thread:$('#thread').value,...(penHandles?{handles:draft.pathPoints.map((_,i)=>penHandles[i]||null)}:{}),
        ...(closed?{closed:true,stitch:'fill'}:{})}],()=>{
        setSelection({selected: id});setSelection({multi: new Set([id])});api.setEditing(true);
      });
    }
    setPathDraft({pathPoints: []});
    setPathDraft({pathHandles: []});
    setPathDraft({pathMode: false});
    setPathDraft({continueId: null});
    setPathDraft({continueStitch: null});
    if(!silent)setTool('select');else{toolMode.set('select');}
    $('#stitches').replaceChildren();
  }

  // A dragged polygon or star: its sides come from the sidebar, and a star alternates between the radius and 45% of it.
  function addPolyShape(/** @type {any} */ kind,/** @type {any} */ center,/** @type {number} */ radius,/** @type {number} */ angle){
    const n=Math.max(3,Math.min(12,Math.round(Number($('#sides').value))||5)),pts=[];
    const count=kind==='star'?n*2:n;
    for(let k=0;k<count;k++){
      const r=kind==='star'&&k%2?radius*.45:radius,a=angle+Math.PI*2*k/count;
      pts.push([+(center[0]+r*Math.cos(a)).toFixed(3),+(center[1]+r*Math.sin(a)).toFixed(3)]);
    }
    const id=crypto.randomUUID();
    api.commit([{op:'add_path',id,name:kind==='star'?`Star ${n}`:`Polygon ${n}`,x:0,y:0,points:pts,closed:true,
      stitch:'fill',thread:$('#thread').value}],()=>{
      setSelection({selected: id});setSelection({multi: new Set([id])});
    });
  }

  function addLine(/** @type {any} */ a,/** @type {any} */ b){
    const id=crypto.randomUUID();
    api.commit([{op:'add_path',id,name:'Line',x:0,y:0,points:[a,b],thread:$('#thread').value}],()=>{
      setSelection({selected: id});setSelection({multi: new Set([id])});
    });
  }

  const pathPress=()=>{
    if(toolMode.get()==='path'&&pathDraftNow().pathPoints.length>=2){endPath();return;}
    setTool('path');
  };
  toolActions.press=name=>name==='path'?pathPress():setTool(name);

  // ---- pointer listeners ---------------------------------------------------------------------------------------
  // The path tool adds a point on click; a double-click on the last point (or a click on the first within 2 mm once
  // three points exist) finishes the path. The pen adds a corner node on press and drags its handles out.
  $('#art').addEventListener('click',(/** @type {any} */ e)=>{
    if(toolMode.get()!=='path')return;
    const raw=coord(e),p=api.canvas.snapPt(raw);
    if(Math.abs(p[0])>1000||Math.abs(p[1])>1000){api.toast(t('Path point is outside the supported workspace.'));return;}
    if(pathDraftNow().pathPoints.length>=3
      &&Math.hypot(raw[0]-pathDraftNow().pathPoints[0][0],raw[1]-pathDraftNow().pathPoints[0][1])<2){endPath(true);return;}
    const last=pathDraftNow().pathPoints.at(-1);
    if(e.detail>1&&last&&Math.hypot(p[0]-last[0],p[1]-last[1])<.01){endPath();return;}
    setPathDraft({pathPoints:[...pathDraftNow().pathPoints,p]});
    if(pathDraftNow().pathPoints.length>1000){
      setPathDraft({pathPoints:pathDraftNow().pathPoints.slice(0,-1)});
      api.toast(t('A path is limited to 1,000 points.'));return;
    }
    drawPathPreview();
  });
  $('#art').addEventListener('pointerdown',(/** @type {any} */ e)=>{
    if(e.button!==0)return;
    if(toolMode.get()==='pen'){
      const raw=coord(e),p=api.canvas.snapPt(raw);
      if(Math.abs(p[0])>1000||Math.abs(p[1])>1000)return;
      if(pathDraftNow().pathPoints.length>=3
        &&Math.hypot(raw[0]-pathDraftNow().pathPoints[0][0],raw[1]-pathDraftNow().pathPoints[0][1])<2){endPath(true);return;}
      if(pathDraftNow().pathPoints.length>=1000)return;
      setPathDraft({pathPoints:[...pathDraftNow().pathPoints,p],pathHandles:[...pathDraftNow().pathHandles,null]});
      setPathDraft({penDown: {index:pathDraftNow().pathPoints.length-1,pointerId:e.pointerId}});
      drawPathPreview();
    }else if(toolMode.get()==='line'||toolMode.get()==='polygon'||toolMode.get()==='star'){
      e.preventDefault();
      const p=api.canvas.snapPt(coord(e));
      setPathDraft({shapeDrag: {start:p,end:p,pointerId:e.pointerId}});
    }
  });
  // The pen's handle mirrors the pointer across the node it is attached to; the shape drag previews the line or the
  // polygon/star at the dragged radius and angle.
  window.addEventListener('pointermove',(/** @type {any} */ e)=>{
    const pen=pathDraftNow().penDown;
    if(pen&&e.pointerId===pen.pointerId){
      const q=coord(e),p=pathDraftNow().pathPoints[pen.index];
      if(Math.hypot(q[0]-p[0],q[1]-p[1])>.8){
        setPathDraft({pathHandles:replaceAt(pathDraftNow().pathHandles,pen.index,{i:[2*p[0]-q[0],2*p[1]-q[1]],o:q})});
      }
      drawPathPreview();return;
    }
    const drag=pathDraftNow().shapeDrag;
    if(drag&&e.pointerId===drag.pointerId){
      setPathDraft({shapeDrag:{...drag,end:api.canvas.snapPt(coord(e))}});
      const {start,end}=drag,root=$('#stitches');
      root.replaceChildren();
      /** @type {any} */
      let el;
      if(toolMode.get()==='line'){
        el=node('line');
        el.setAttribute('x1',start[0]);el.setAttribute('y1',start[1]);
        el.setAttribute('x2',end[0]);el.setAttribute('y2',end[1]);
      }else{
        const r=Math.hypot(end[0]-start[0],end[1]-start[1]),a=Math.atan2(end[1]-start[1],end[0]-start[0]);
        const n=Math.max(3,Math.min(12,Math.round(Number($('#sides').value))||5)),count=toolMode.get()==='star'?n*2:n;
        const pts=Array.from({length:count},(_,k)=>{
          const rr=toolMode.get()==='star'&&k%2?r*.45:r,turn=a+Math.PI*2*k/count;
          return [start[0]+rr*Math.cos(turn),start[1]+rr*Math.sin(turn)];
        });
        el=node('polygon');el.setAttribute('points',pts.map(q=>q.join(',')).join(' '));
      }
      el.setAttribute('fill','none');el.setAttribute('stroke','#1c7a67');
      el.setAttribute('stroke-width','.45');el.setAttribute('stroke-dasharray','1.2 .8');
      root.append(el);
    }
  });
  // Releasing a drag adds the line, or a polygon/star that falls back to a 12 mm shape under 1 mm of dragging.
  window.addEventListener('pointerup',(/** @type {any} */ e)=>{
    const pen=pathDraftNow().penDown;
    if(pen&&e.pointerId===pen.pointerId){
      setPathDraft({penDown: null});drawPathPreview();return;
    }
    const drag=pathDraftNow().shapeDrag;
    if(drag&&e.pointerId===drag.pointerId){
      const {start,end}=drag;
      setPathDraft({shapeDrag: null});
      const shape=toolMode.get(),dist=Math.hypot(end[0]-start[0],end[1]-start[1]);
      $('#stitches').replaceChildren();
      if(shape==='line'){if(dist<1){api.toast(t('Drag to draw a line.'));return;}addLine(start,end);}
      else if(dist<1)addPolyShape(shape,start,12,-Math.PI/2);
      else addPolyShape(shape,start,dist,Math.atan2(end[1]-start[1],end[0]-start[0]));
      setTool('select');
    }
  });
  $('#art').addEventListener('pointermove',(/** @type {any} */ e)=>{
    if(toolMode.get()==='path'&&pathDraftNow().pathPoints.length)drawPathPreview(api.canvas.snapPt(coord(e)));
  });
  $('#continueDig').onclick=()=>{
    const o=api.selectedObject();
    if(o?.kind!=='path'){api.toast(t('Select a path first.'));return;}
    continueDigitizing(o);
  };
  // ---- measure and knife clicks --------------------------------------------------------------------------------
  // The measure tool keeps a first point until the second click replaces it with a fresh first point.
  function measureClick(/** @type {any} */ p){
    const q=api.canvas.snapPt(p);
    const cur=measureState.get();
    measureState.set(!cur||cur.b?{a:q,b:null}:{...cur,b:q});
    api.canvas.refresh();
    return true;
  }
  // The knife collects points on the selected closed shape, or leaves the tool when there is nothing to cut.
  function knifeClick(/** @type {any} */ p){
    const o=api.selectedObject();
    if(!o||!(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed))){
      api.toast(t('Select a closed shape to cut.'));setTool('select');return true;
    }
    knifeState.set([...knifeState.get(),p]);
    api.canvas.refresh();
    return true;
  }
  return {coord,withGroup,add,setTool,continueDigitizing,endPath,drawPathPreview,pathPress,measureClick,knifeClick};
}
