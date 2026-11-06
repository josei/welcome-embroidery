// @ts-check
// Edit-mode canvas overlay: the guide line, the start/end/ripple pins, the path nodes and Bézier handles drawn at a
// constant screen size, object snapping and its marker, dragging nodes and handles, and inserting or deleting nodes.
// canvas.js exposes it on canvasView and registers its pointer listeners; app.js does the edits through `api`.
import {geometry,objectBounds,cornerRadii} from './engine.js';
import {documentNow} from './documentState.js';
import {selState,setSelection} from './selectionState.js';
import {interactionNow,setInteraction} from './interactionState.js';
import {nodeButtonsState,nodeActions} from './nodeButtonsState.js';
import {snapObjState} from './snapObjState.js';

const NS='http://www.w3.org/2000/svg';
const $=(/** @type {string} */ s)=>/** @type {any} */(document.querySelector(s));
const node=(/** @type {string} */ tag)=>/** @type {any} */(document.createElementNS(NS,tag));

/**
 * @param {any} api
 *  edits: commit(ops, after), render(), isEditing(), toast(text);
 *  the canvas: overlay, coord(e), scale(), snapOn(), gridSize().
 */
export function createCanvasEditing(api){
  const selectedObject=()=>{const id=selState().selected;return id?documentNow().doc.objects.find((/** @type {any} */ o)=>o.id===id):undefined;};
  // Sizes are in screen pixels, so the nodes and handles stay constant while zooming.
  const px=(/** @type {number} */ n)=>n/(api.scale()||7);
  const snapv=(/** @type {number} */ v)=>api.snapOn()?+(Math.round(v/api.gridSize())*api.gridSize()).toFixed(3):v;
  /** @type {any} */
  let snapCache=null;

  // ---- the overlay ---------------------------------------------------------------------------------------------
  // The nodes and Bézier handles of the path being edited, plus the guide line and the start/end/ripple pins.
  function drawControls(){
    const controls=$('#controls');controls.replaceChildren();const selectedPath=selectedObject();
    {const o=selectedObject();if(o&&selState().multi.size<=1&&o.kind!=='text'&&o.kind!=='stitch_layer'){
      const b=objectBounds(o),gl=interactionNow().guideDraft||(o.fillMethod==='guided'?o.guide:null);
      if(gl&&gl.length>=1){const l=node('polyline');l.setAttribute('class','guide-line');
        l.setAttribute('points',gl.map((/** @type {any} */ f)=>`${b[0]+f[0]*(b[2]-b[0])},${b[1]+f[1]*(b[3]-b[1])}`).join(' '));controls.append(l);}
      for(const [key,cls] of /** @type {Array<[string, string]>} */([['startAt','start'],['endAt','end'],['rippleCenter','center']])){
        const f=o[key];if(!f)continue;const c=node('circle');c.setAttribute('class','pin '+cls);
        c.setAttribute('cx',b[0]+f[0]*(b[2]-b[0]));c.setAttribute('cy',b[1]+f[1]*(b[3]-b[1]));c.setAttribute('r',px(5));
        const t=node('title');t.textContent=key==='startAt'?'Start point':key==='endAt'?'End point':'Ripple centre';
        c.append(t);controls.append(c);}}
    }
    if(!api.isEditing()||selectedPath?.kind!=='path'||selState().multi.size!==1)return;
    selectedPath.points.forEach((/** @type {any} */ [x,y],/** @type {number} */ index)=>{
      const n=node('circle');n.setAttribute('class','path-node');n.setAttribute('cx',x);n.setAttribute('cy',y);
      n.setAttribute('r',px(4.5));n.dataset.index=index;
      if(selState().selNodes.has(index)||index===selState().selNode)n.classList.add('selected-node');
      n.addEventListener('pointerdown',(/** @type {any} */ e)=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();
        if(e.shiftKey){const next=new Set(selState().selNodes);
          if(next.has(index)){next.delete(index);setSelection({selNodes: next,selNode: selState().selNode===index?[...next].at(-1)??null:selState().selNode});}
          else{next.add(index);setSelection({selNodes: next,selNode: index});}
          api.render();return;}
        if(!selState().selNodes.has(index)||selState().selNodes.size<2){setSelection({selNodes: new Set([index])});}setSelection({selNode: index});
        document.querySelectorAll('.path-node').forEach((/** @type {any} */ v)=>
          v.classList.toggle('selected-node',selState().selNodes.has(Number(v.dataset.index))));
        nodeButtonsState.set({...nodeButtonsState.get(),del:false});
        setInteraction({nodeDrag: {id:selectedPath.id,index,pointerId:e.pointerId,element:n,start:api.coord(e),
          group:selState().selNodes.size>1?[...selState().selNodes]:null,originals:selectedPath.points.map((/** @type {any} */ p)=>[...p])}});
      });
      controls.append(n);
    });
    const at=selState().selNode;
    if(at!==null&&selState().selNodes.size<=1&&selectedPath.handles?.[at]){
      const h=selectedPath.handles[at],p=selectedPath.points[at];
      for(const which of ['in','out']){const q=which==='in'?h.i:h.o,line=node('line');
        line.setAttribute('class','handle-line');line.setAttribute('x1',p[0]);line.setAttribute('y1',p[1]);
        line.setAttribute('x2',q[0]);line.setAttribute('y2',q[1]);controls.append(line);
        const dot=node('circle');dot.setAttribute('class','path-handle');dot.setAttribute('cx',q[0]);dot.setAttribute('cy',q[1]);
        dot.setAttribute('r',px(4));
        dot.addEventListener('pointerdown',(/** @type {any} */ e)=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();
          setInteraction({nodeDrag: {id:selectedPath.id,index:at,handle:which,mirror:!e.altKey,pointerId:e.pointerId,element:dot,line}});});
        controls.append(dot);}
    }
  }

  // ---- object snapping -----------------------------------------------------------------------------------------
  // Nodes, segment midpoints, shape centres and the nearest point on other outlines, within a few screen pixels;
  // a marker shows what was hit.
  function snapTargets(){
    const key=documentNow().doc.revision+':'+(interactionNow().nodeDrag?.id||'');if(snapCache?.key===key)return snapCache;
    const nodes=/** @type {any[]} */([]),segs=/** @type {any[]} */([]);
    const dragging=interactionNow().nodeDrag;
    for(const o of documentNow().doc.objects){
      if(o.kind==='text'||o.kind==='stitch_layer'||o.visible===false||(dragging&&o.id===dragging.id))continue;
      let rings;try{rings=o.kind==='path'?[o.points.map((/** @type {any} */ q)=>[+q[0],+q[1]])]:geometry(o,0);}catch{continue;}
      for(const ring of rings){const closed=o.kind!=='path'||o.closed;
        const pts=o.kind==='path'?ring:ring.slice(0,closed&&ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?-1:undefined);
        const corner=o.kind==='ellipse'||(o.kind==='rect'&&cornerRadii(o).some((/** @type {number} */ r)=>r>0))?null:pts;
        if(corner)for(const q of corner)nodes.push({p:q,kind:'node'});
        const edge=o.kind==='path'?(o.closed?[...ring,ring[0]]:ring):ring;
        for(let i=1;i<edge.length;i++){segs.push([edge[i-1],edge[i]]);
          if(o.kind!=='ellipse'&&!(o.kind==='rect'&&cornerRadii(o).some((/** @type {number} */ r)=>r>0)))
            nodes.push({p:[(edge[i-1][0]+edge[i][0])/2,(edge[i-1][1]+edge[i][1])/2],kind:'mid'});}}
      if(o.kind==='rect'||o.kind==='ellipse'){nodes.push({p:[o.x+o.w/2,o.y+o.h/2],kind:'center'});
        if(o.kind==='ellipse')for(const q of [[o.x,o.y+o.h/2],[o.x+o.w,o.y+o.h/2],[o.x+o.w/2,o.y],[o.x+o.w/2,o.y+o.h]])nodes.push({p:q,kind:'node'});}}
    snapCache={key,nodes,segs};return snapCache;
  }
  function showSnap(/** @type {any} */ hit){
    api.overlay.querySelectorAll('.snap-hit').forEach((/** @type {any} */ n)=>n.remove());if(!hit)return;
    const c=node('g');c.setAttribute('class','snap-hit');const r=px(5);
    const shape=hit.kind==='mid'?node('path'):hit.kind==='edge'?node('circle'):node('rect');
    if(hit.kind==='mid')shape.setAttribute('d',`M${hit.p[0]},${hit.p[1]-r}L${hit.p[0]+r},${hit.p[1]+r}L${hit.p[0]-r},${hit.p[1]+r}Z`);
    else if(hit.kind==='edge'){shape.setAttribute('cx',hit.p[0]);shape.setAttribute('cy',hit.p[1]);shape.setAttribute('r',r*.7);}
    else{shape.setAttribute('x',hit.p[0]-r);shape.setAttribute('y',hit.p[1]-r);shape.setAttribute('width',2*r);shape.setAttribute('height',2*r);
      if(hit.kind==='center')shape.setAttribute('transform',`rotate(45 ${hit.p[0]} ${hit.p[1]})`);}
    c.append(shape);api.overlay.append(c);
  }
  // With object snapping on, a point first snaps to another object's node or outline, otherwise to the grid.
  function snapPt(/** @type {any} */ p){
    if(snapObjState.get()){
      const tol=px(9),{nodes,segs}=snapTargets();let best=null,bd=tol;
      for(const n of nodes){const d=Math.hypot(n.p[0]-p[0],n.p[1]-p[1])-(n.kind==='node'?px(2):0);if(d<bd){bd=d;best=n;}}
      if(!best)for(const [a,b] of segs){const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(!l2)continue;
        const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(q[0]-p[0],q[1]-p[1]);
        if(d<Math.min(bd,px(5))){bd=d;best={p:q,kind:'edge'};}}
      if(best){showSnap(best);return [best.p[0],best.p[1]];}}
    showSnap(null);if(!api.snapOn())return p;return p.map(snapv);
  }

  // ---- dragging nodes and handles ------------------------------------------------------------------------------
  // A mask's cut is its clipPath; while its nodes are dragged the cut is redrawn from the moved points.
  function previewMaskNodes(/** @type {string} */ id,/** @type {any} */ change){
    const mask=documentNow().doc.objects.find((/** @type {any} */ o)=>o.id===id);
    const cp=document.getElementById('clip-'+id)?.firstElementChild;
    if(!mask||!cp)return;
    const shape={points:mask.points.map((/** @type {any} */ p)=>[...p]),
      handles:mask.handles?.map((/** @type {any} */ h)=>h&&{i:[...h.i],o:[...h.o]})};change(shape);
    cp.setAttribute('d',geometry({...mask,...shape},0)
      .map((/** @type {any} */ r)=>'M'+r.map((/** @type {any} */ q)=>q.join(',')).join('L')+'Z').join(''));
  }
  function shiftMaskNode(/** @type {any} */ s,/** @type {number} */ i,/** @type {number} */ dx,/** @type {number} */ dy){
    s.points[i]=[s.points[i][0]+dx,s.points[i][1]+dy];const h=s.handles?.[i];
    if(h){h.i=[h.i[0]+dx,h.i[1]+dy];h.o=[h.o[0]+dx,h.o[1]+dy];}
  }
  function setMaskHandle(/** @type {any} */ s,/** @type {number} */ i,/** @type {string} */ which,/** @type {any} */ q,/** @type {boolean} */ mirror){
    const h=s.handles?.[i];if(!h)return;const key=which==='in'?'i':'o',p=s.points[i];h[key]=[q[0],q[1]];
    if(mirror)h[key==='i'?'o':'i']=[2*p[0]-q[0],2*p[1]-q[1]];
  }
  function pointerMove(/** @type {any} */ e){
    const drag=/** @type {any} */(interactionNow().nodeDrag);
    if(!drag||e.pointerId!==drag.pointerId)return;
    if(drag.group){const q=api.coord(e);let dx=q[0]-drag.start[0],dy=q[1]-drag.start[1];
      if(Math.hypot(dx,dy)*api.scale()<3&&drag.dx===undefined)return;
      if(api.snapOn()){const o0=drag.originals[drag.index];dx=snapv(o0[0]+dx)-o0[0];dy=snapv(o0[1]+dy)-o0[1];}
      setInteraction(/** @type {any} */({nodeDrag: {...drag,dx: dx}}));setInteraction(/** @type {any} */({nodeDrag: {...interactionNow().nodeDrag,dy: dy}}));
      document.querySelectorAll('.path-node').forEach((/** @type {any} */ n)=>{const i=Number(n.dataset.index);
        if(drag.group.includes(i)){n.setAttribute('cx',drag.originals[i][0]+dx);n.setAttribute('cy',drag.originals[i][1]+dy);}});
      previewMaskNodes(drag.id,(/** @type {any} */ s)=>{for(const i of drag.group)shiftMaskNode(s,i,dx,dy);});
      return;
    }
    const q=snapPt(api.coord(e));
    setInteraction(/** @type {any} */({nodeDrag: {...drag,x: q[0]}}));
    setInteraction(/** @type {any} */({nodeDrag: {...interactionNow().nodeDrag,y: q[1]}}));
    drag.element.setAttribute('cx',q[0]);
    drag.element.setAttribute('cy',q[1]);
    drag.line?.setAttribute('x2',q[0]);
    drag.line?.setAttribute('y2',q[1]);
    if(drag.handle)previewMaskNodes(drag.id,(/** @type {any} */ s)=>setMaskHandle(s,drag.index,drag.handle,q,drag.mirror));
    else previewMaskNodes(drag.id,(/** @type {any} */ s)=>{const o=s.points[drag.index];shiftMaskNode(s,drag.index,q[0]-o[0],q[1]-o[1]);});
  }
  // A drag commits exactly one command; a press that never moved only re-renders.
  function finishDrag(/** @type {any} */ e){
    const drag=/** @type {any} */(interactionNow().nodeDrag);
    if(!drag||e.pointerId!==drag.pointerId)return;
    setInteraction({nodeDrag: null});
    if(drag.group){
      if(drag.dx!==undefined&&Math.hypot(drag.dx,drag.dy)>.02)api.commit([{op:'move_path_points',id:drag.id,indexes:drag.group,dx:drag.dx,dy:drag.dy}]);
      else api.render();
      return;
    }
    const moved=Number.isFinite(drag.x)&&Number.isFinite(drag.y);
    if(moved&&drag.handle)api.commit([{op:'set_path_handle',id:drag.id,index:drag.index,which:drag.handle,x:drag.x,y:drag.y,mirror:drag.mirror}]);
    else if(moved)api.commit([{op:'set_path_point',id:drag.id,index:drag.index,x:drag.x,y:drag.y}]);
    else api.render();
  }

  // ---- node insertion and deletion -----------------------------------------------------------------------------
  // Double-clicking a path inserts a node at the nearest point of its outline and selects it.
  function insertNodeAt(/** @type {any} */ o,/** @type {any} */ point){
    const g=o.points;let best=-1,bestD=Infinity;
    /** @type {any} */
    let bestP=null;
    for(let i=0;i<g.length-(o.closed?0:1);i++){
      const a=g[i],b=g[(i+1)%g.length],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,
        t=len?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/len)):0,
        q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(point[0]-q[0],point[1]-q[1]);
      if(d<bestD){bestD=d;best=i;bestP=q;}}
    if(best<0)return;
    api.commit([{op:'insert_path_point',id:o.id,index:best+1,x:snapv(bestP[0]),y:snapv(bestP[1])}],()=>{setSelection({selNode: best+1});});
  }
  function deleteNode(){
    const o=selectedObject();if(o?.kind!=='path')return;
    const idx=selState().selNodes.size?[...selState().selNodes]:selState().selNode===null?[]:[selState().selNode];
    if(!idx.length)return;
    api.commit(idx.length===1?[{op:'delete_path_point',id:o.id,index:idx[0]}]:[{op:'delete_path_points',id:o.id,indexes:idx}],
      ()=>{setSelection({selNode: null});setSelection({selNodes: new Set()});});
  }

  // The node buttons (PathNodeButtons.tsx) call these: each one edits the selected path, as it did from app.js.
  nodeActions.add=()=>{const o=selectedObject();if(o?.kind!=='path')return;
    const i=selState().selNode??0,a=o.points[i],b=o.points[(i+1)%o.points.length];
    if(!b||(!o.closed&&i>=o.points.length-1)){api.toast('Select a node that has a following segment, or double-click the path.');return;}
    api.commit([{op:'insert_path_point',id:o.id,index:i+1,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2}],()=>{setSelection({selNode: i+1});});};
  nodeActions.del=deleteNode;
  nodeActions.smooth=()=>{const o=selectedObject(),i=selState().selNode;
    if(o?.kind==='path'&&i!==null)api.commit([{op:'set_path_node_type',id:o.id,index:i,type:'smooth'}]);};
  nodeActions.corner=()=>{const o=selectedObject(),i=selState().selNode;
    if(o?.kind==='path'&&i!==null&&o.handles?.[i])api.commit([{op:'set_path_node_type',id:o.id,index:i,type:'corner'}]);};

  return {px,snapv,drawControls,showSnap,snapPt,insertNodeAt,deleteNode,pointerMove,finishDrag};
}
