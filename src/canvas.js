// @ts-check
// Canvas interaction layer: an infinite pan/zoom viewport with rulers and guides, geometric hit testing, selection with
// resize/rotate handles (oriented for a single rotated shape), smart snapping, marquee selection and the context menu.
// Document state stays in app.js; this module talks to it through `api`.
import {lang, t} from './i18n.js';
import {objectBounds} from './engine.js';
import {drawScene} from './canvasScene.js';
import {wheelZoomFactor,wheelZooms} from './wheelZoom.js';
import {createCanvasEditing} from './canvasEditing.js';
import {createCanvasTools} from './canvasTools.js';
import {toolbarInset} from './floatingToolbar.js';
import {clampMoveDelta,visibleCanvasRect} from './moveClamp.js';
import {pressClaimedByHandle} from './handleClaim.js';
import {clampResizeScale} from './resizeLimit.js';
import {multiSelectState} from './multiSelectState.js';
import {interactionNow} from './interactionState.js';
import {deletingGuideState,handModeState,panningState} from './canvasModeState.js';
import {formatNumber} from './decimalText.js';
import {createCanvasFit} from './canvasFit.js';
import {createContextMenu} from './canvasMenu.js';
import {el,union,touchPointer,hitObject,bestDelta,snapCandidates,toWorld,toLocal,HANDLES,HANDLE_LABEL} from './canvasGeometry.js';
import {RULER,drawRulers as paintRulers,overRuler} from './canvasRulers.js';
import {drawMeasureLine,drawKnifeLine,drawGuideLines,drawSmartLines,drawAngleHandle} from './canvasOverlay.js';

const PX_PER_MM=96/25.4;
export function createCanvas(/** @type {any} */ api){
  const {svg,container,overlay}=api;
  const vp={cx:0,cy:0,s:PX_PER_MM*1.9};let spaceDown=false,hintOn=false;
  /** @type {any} */
  let state=null;
  /** @type {any} */
  let lastClick=null;
  /** @type {any[]} */
  let smartLines=[];
  const rulerTop=container.querySelector('#rulerTop'),rulerLeft=container.querySelector('#rulerLeft'),guidesLayer=svg.querySelector('#guides');
  const size=()=>{const r=container.getBoundingClientRect();return {w:Math.max(200,r.width),h:Math.max(200,r.height)};};
  const inField=(/** @type {any} */ e)=>e.target.closest?.('input,select,textarea,[contenteditable="true"],#fontPanel');

  // The draw tools own the canvas pointer listeners that add points and drag out shapes, and the measure/knife clicks.
  // They are created first so the edit-mode overlay can use their coord.
  const tools=createCanvasTools({...api,canvas:{
    refresh:()=>refresh(),
    snapPt:(/** @type {any} */ p)=>editing.snapPt(p),
    showSnap:(/** @type {any} */ hit)=>editing.showSnap(hit),
    px:(/** @type {number} */ n)=>editing.px(n),
    visibleArea:()=>visibleArea(),
  }});

  // The edit-mode overlay and its pointer listeners live here, next to the rest of the canvas's pointer handling.
  const editing=createCanvasEditing({...api,coord:tools.coord,scale:()=>vp.s});
  window.addEventListener('pointermove',(/** @type {any} */ e)=>editing.pointerMove(e));
  window.addEventListener('pointerup',(/** @type {any} */ e)=>editing.finishDrag(e));
  window.addEventListener('pointercancel',(/** @type {any} */ e)=>editing.finishDrag(e));
  window.addEventListener('pointerup',()=>editing.showSnap(null));

  // ---- viewport ---------------------------------------------------------------------------------------------
  // The drawing area is #art itself: on a portrait tablet the tool rail takes the canvas's left 64 px, and #art is set
  // beside it. Mapping the scene across the container instead would squeeze it sideways by the rail's share, and a
  // wider container (a folded panel) would stretch it again, so the scene is laid out across #art's own box.
  function drawArea(){const r=svg.getBoundingClientRect(),c=container.getBoundingClientRect();
    return {w:Math.max(1,r.width),h:Math.max(1,r.height),x:r.left-c.left,y:r.top-c.top};}
  // Screen points are in the canvas container's coordinates, the drawing sits at the drawing area's offset within it.
  function toScreen(/** @type {any} */ x,/** @type {any} */ y){const {x:ox,y:oy,w,h}=drawArea();return [(x-vp.cx)*vp.s+ox+w/2,(y-vp.cy)*vp.s+oy+h/2];}
  function apply(){const {w,h}=drawArea();svg.setAttribute('viewBox',`${vp.cx-w/(2*vp.s)} ${vp.cy-h/(2*vp.s)} ${w/vp.s} ${h/vp.s}`);
    svg.setAttribute('preserveAspectRatio','none');api.onViewport?.(vp);drawRulers();refresh();}
  const {fitHoop,fitAll,fitSelection,fitAboveSheet,revealSelection,panToReveal,hoopInBox,hoopInArea,zoomBarReserve}=
    createCanvasFit({vp,apply,size,container,api,toScreen,drawArea});
  // The zoom and centre of the view, so a sheet can put them back when it closes.
  function viewport(){return {cx:vp.cx,cy:vp.cy,s:vp.s};}
  function setViewport(/** @type {{cx:number,cy:number,s:number}} */ v){vp.cx=v.cx;vp.cy=v.cy;vp.s=v.s;apply();}
  // The part of the canvas no sheet or floating bar covers, in world mm. Screen x maps to world as (sx - ox) / scale, where ox
  // is where world 0 sits on screen (the inverse of toScreen).
  function visibleArea(){const ins=toolbarInset(container),{w,h}=size(),[ox,oy]=toScreen(0,0),s=vp.s;
    return {x0:(RULER-ox)/s,y0:(RULER+ins.top-oy)/s,x1:(w-ins.right-ox)/s,y1:(h-ins.bottom-oy)/s};}
  /**
   * @param {number} factor
   * @param {number} [clientX]
   * @param {number} [clientY]
   */
  // The anchor is measured from the drawing area (#art), which is where the scene is drawn, not from the container.
  function anchorIn(/** @type {any} */ clientX,/** @type {any} */ clientY){const {w,h}=drawArea(),sr=svg.getBoundingClientRect();
    return {w,h,px:clientX==null?w/2:clientX-sr.left,py:clientY==null?h/2:clientY-sr.top};}
  function zoomAt(factor,clientX,clientY){const {w,h,px,py}=anchorIn(clientX,clientY),wx=vp.cx+(px-w/2)/vp.s,wy=vp.cy+(py-h/2)/vp.s;vp.s=Math.max(.4,Math.min(160,vp.s*factor));vp.cx=wx-(px-w/2)/vp.s;vp.cy=wy-(py-h/2)/vp.s;apply();}
  function zoomTo100(){zoomAt(PX_PER_MM/vp.s);}
  container.addEventListener('wheel',(/** @type {any} */ e)=>{if(e.target.closest?.('#preview3d,.floating,.zoombar,#ctxMenu'))return;e.preventDefault();
    if(wheelZooms(e))zoomAt(wheelZoomFactor(e),e.clientX,e.clientY);
      else{vp.cx+=e.deltaX/vp.s;vp.cy+=e.deltaY/vp.s;apply();}},{passive:false});
  // A panel that opens, folds or swaps tabs resizes the drawing area but leaves its origin and the window alone. The scene
  // keeps its place on screen through that, so the object under the finger stays under it and the next tap lands in the
  // same spot: the viewBox's top-left corner is held, which moves the view centre by half the size change. When the window
  // changes shape instead (a rotation or a resized desktop window), the drawing area's origin moves or the viewport
  // changes; holding a corner there would leave part of the drawing outside the new area, so the scene is centred in it.
  let drawAreaBox=drawArea(),windowBox={w:innerWidth,h:innerHeight};
  // The Properties column (desktop and tablet landscape) asks for its next resize to re-centre the hoop horizontally, at the
  // zoom it has. It expires quickly, so a later resize that has nothing to do with the column does not move the view.
  let recentreUntil=0;
  new ResizeObserver(()=>{const next=drawArea();
    const measured=drawAreaBox.w>1&&drawAreaBox.h>1;
    if(measured&&next.w!==drawAreaBox.w&&performance.now()<recentreUntil){recentreUntil=0;drawAreaBox=next;windowBox={w:innerWidth,h:innerHeight};
      vp.cx=-RULER/(2*vp.s);apply();return;}
    // Whether the hoop lay wholly in the old drawing area. A shrink that pushes it into the zoom bar's band (the Stitches footer
    // appearing) refits it, so the hoop is never left under the bar.
    const reserve=zoomBarReserve(),hoopWasIn=measured&&hoopInBox(drawAreaBox,reserve);
    const resized=next.w!==drawAreaBox.w||next.h!==drawAreaBox.h;
    const originHeld=Math.abs(next.x-drawAreaBox.x)<.5&&Math.abs(next.y-drawAreaBox.y)<.5;
    const windowHeld=innerWidth===windowBox.w&&innerHeight===windowBox.h;
    if(measured&&resized&&originHeld&&windowHeld){vp.cx+=(next.w-drawAreaBox.w)/(2*vp.s);vp.cy+=(next.h-drawAreaBox.h)/(2*vp.s);}
    drawAreaBox=next;windowBox={w:innerWidth,h:innerHeight};
    // A rotation keeps the zoom, so a hoop fitted to the old shape can be taller than the new area: fit it again then.
    if(measured&&resized&&(!windowHeld||hoopWasIn)&&!hoopInArea(reserve))fitHoop();else apply();
  }).observe(container);
  document.addEventListener('keydown',e=>
    {if(e.code==='Space'&&!inField(e)){spaceDown=true;panningState.set(true);if(e.target===document.body)e.preventDefault();}});
  document.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;panningState.set(false);}});

  // ---- rulers and guides ------------------------------------------------------------------------------------
  function drawRulers(){paintRulers(rulerTop,rulerLeft,vp,size());}
  // The measure tool's line and its two points, drawn in mm over the design.
  function drawMeasure(){drawMeasureLine(overlay,api.measure?.(),vp.s);}
  // The knife tool's points, joined by lines, until Enter cuts the shape along them.
  function drawKnife(){drawKnifeLine(overlay,api.knife?.(),vp.s);}
  function drawGuides(){drawGuideLines(guidesLayer,api.doc());}
  for(const [cv,axis] of [[rulerTop,'y'],[rulerLeft,'x']])cv?.addEventListener('pointerdown',(/** @type {any} */ e)=>
    {if(e.button!==0||(e.pointerType==='touch'&&touches.size>0))return;e.preventDefault();state={type:'guide',axis,index:null,pid:e.pointerId};
    cv.setPointerCapture?.(e.pointerId);});
  svg.addEventListener('pointerdown',(/** @type {any} */ e)=>
    {const g=e.target.closest?.('.guide-hit');if(!g||e.button!==0||api.tool()!=='select')return;e.preventDefault();e.stopPropagation();const i=
    Number(g.dataset.guide),guide=api.doc().guides[i];state={type:'guide',axis:guide.axis,index:i,pid:e.pointerId};svg.setPointerCapture?.(e.pointerId);},true);

  // ---- smart snapping ---------------------------------------------------------------------------------------
  function candidates(/** @type {any} */ exclude){return snapCandidates(api.doc(),exclude);}
  function snapMove(/** @type {any} */ box,/** @type {any} */ exclude,nodes=/** @type {any[]} */([])){const {xs,ys}=candidates(exclude),tol=6/vp.s,bx=
    bestDelta([box[0],(box[0]+box[2])/2,box[2],...nodes.map(q=>q[0])],xs,tol),by=bestDelta([box[1],(box[1]+box[3])/2,box[3],...nodes.map(q=>q[1])],ys,tol);
  smartLines=[...(bx?[{axis:'x',pos:bx.at}]:[]),...(by?[{axis:'y',pos:by.at}]:[])];
  return [bx?.d??0,by?.d??0];
  }
  function snapPoint(/** @type {any} */ p,/** @type {any} */ exclude){const {xs,ys}=candidates(exclude),tol=6/vp.s,bx=bestDelta([p[0]],xs,tol),by=
    bestDelta([p[1]],ys,tol);
  smartLines=[...(bx?[{axis:'x',pos:bx.at}]:[]),...(by?[{axis:'y',pos:by.at}]:[])];
  return [p[0]+(bx?.d??0),p[1]+(by?.d??0)];
  }
  function drawSmart(){drawSmartLines(overlay,smartLines);}

  // Hovering a selected object shows the guides it already lines up with, so a drag from here will snap to them.
  function hoverHint(/** @type {any} */ e){
    const f=frame(),o=f&&!f.oriented&&api.tool()==='select'?hit(coord(e)):null,on=Boolean(o)&&api.ids().includes(o.id);
    if(!on&&!hintOn)return;
    hintOn=on;smartLines=[];if(on)snapMove(/** @type {any} */(f).b,api.ids());drawSmart();
  }

  // ---- hit testing -------------------------------------------------------------------------------------------
  function hit(/** @type {any} */ p,tol=6/vp.s){const objs=api.doc().objects;
  for(let i=objs.length-1;i>=0;i--){const o=objs[i];
  if(o.visible===false||o.locked)continue;
  if(hitObject(o,p,tol))return o;
  }return null;
  }

  // ---- selection frame and overlay ---------------------------------------------------------------------------
  // The frame is axis-aligned for groups and multi-selections, and follows the object's own axes for a single rotated rectangle/ellipse/stitch layer.
  function frame(){const ids=api.ids(),d=api.doc(),objs=d.objects.filter((/** @type {any} */ o)=>ids.includes(o.id)&&o.visible!==false);
  if(!objs.length)return null;
    if(objs.length===1){const o=objs[0];
      if(o.rotation&&(o.kind==='rect'||o.kind==='ellipse'||o.kind==='stitch_layer'))return {rot:o.rotation*Math.PI/180,c:[o.x+o.w/2,o.y+o.h/2],W:o.w,H:o.h,
      oriented:true,id:o.id};}
    const b=union(objs.map(objectBounds));return {rot:0,c:[(b[0]+b[2])/2,(b[1]+b[3])/2],W:b[2]-b[0],H:b[3]-b[1],oriented:false,b};}
  /** @type {any} */
  let keyFocus=null;
  // The fill angle handle: on a single fill, a point beyond the object's corners on the line its rows run along (the angle is in world degrees).
  // It sits outside the half-diagonal, so it never lands on a corner handle.
  function angleSpot(/** @type {any} */ f){
    const ids=api.ids();if(ids.length!==1||api.isEditing())return null;
    const o=api.doc().objects.find((/** @type {any} */ v)=>v.id===ids[0]);
    if(!o||o.visible===false||o.locked||o.stitch!=='fill'||o.kind==='text'||o.kind==='stitch_layer'||o.applique)return null;
    if(o.kind==='path'&&!o.closed)return null;
    return {id:o.id,c:f.c,deg:Number(o.angle??api.doc().settings.angle??0),dist:Math.hypot(f.W,f.H)/2};
  }
  function drawAngle(/** @type {any} */ spot,/** @type {any} */ deg,label=/** @type {string|null} */(null)){drawAngleHandle(overlay,spot,deg,label,vp.s);}
  // The rotate knob sits 22 px above the frame. When that lands under the save strip at the top of the screen, the knob goes
  // below the frame instead, so it stays reachable. Returns true when the knob should be drawn below.
  function knobUnderBar(/** @type {any} */ f,/** @type {number} */ k){
    const bar=document.querySelector('.top'),m=overlay.getScreenCTM?.();
    if(!bar||!m)return false;
    const clear=bar.getBoundingClientRect().bottom+(parseFloat(getComputedStyle(bar).marginBottom)||0);
    const [x,y]=toWorld(f,0,-f.H/2-22*k);
    return m.b*x+m.d*y+m.f-5<clear;
  }
  function refresh(f0=/** @type {any} */(null),note=/** @type {string|null} */(null)){
    drawGuides();overlay.replaceChildren();drawMeasure();drawKnife();if(api.tool()!=='select'||state?.type==='marquee'||state?.type==='nodemarquee')return;
    // While the lettering box is open it covers the object, so its handles are left off rather than drawn over the text.
    const f=f0||frame();if(!f||api.isEditing()||interactionNow().canvasText)return;const k=1/vp.s,pv=api.pivot?.();
    // On a touch screen the handle marks and the knob shrink with a small object, so they never hide its lettering. Their
    // 44 px touch targets are unchanged.
    const small=Math.min(f.W,f.H)*vp.s,hs=(touchPointer()?Math.min(3,Math.max(1.5,small*.12)):4)*k;
    if(pv)overlay.append(el('circle',{class:'pivot-mark',cx:pv[0],cy:pv[1],r:5*k}),
      el('line',{class:'sel-stem',x1:pv[0]-10*k,y1:pv[1],x2:pv[0]+10*k,y2:pv[1]}),el('line',{class:'sel-stem',x1:pv[0],y1:pv[1]-10*k,x2:pv[0],y2:pv[1]+10*k}));
    const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b])=>toWorld(f,a*f.W,b*f.H));
    overlay.append(el('polygon',{class:'sel-box',points:corners.map(p=>p.join(',')).join(' '),fill:'none'}));
    // A touch target stays 44 screen px square, but on a touch screen it reaches out from the frame, away from the object's
    // middle, so on a small object it never covers the lettering there. A mouse keeps the square centred on the handle.
    // The press rule in handleClaim.js still decides between a handle and the body.
    const reach=(/** @type {number} */ d)=>d>0?[0,44*k]:d<0?[-44*k,0]:[-22*k,22*k];
    for(const [name,fx,fy] of HANDLES){if(name.length===1&&((name==='n'||name==='s')?f.W*vp.s<30:f.H*vp.s<30))continue;const [x,y]=
      toWorld(f,(fx-.5)*f.W,(fy-.5)*f.H),rot=f.rot?`rotate(${f.rot*180/Math.PI} ${x} ${y})`:'';
      const [ox0,ox1]=touchPointer()?reach(fx-.5):[-22*k,22*k],[oy0,oy1]=touchPointer()?reach(fy-.5):[-22*k,22*k];
      overlay.append(el('rect',{class:'sel-hit','data-hit':name,x:x+ox0,y:y+oy0,width:ox1-ox0,height:oy1-oy0,transform:rot}));
      overlay.append(
      el('rect',
      {class:'sel-handle','data-handle':name,tabindex:0,role:'button','aria-label':HANDLE_LABEL[name],x:x-hs,y:y-hs,width:hs*2,height:hs*2,transform:
      f.rot?`rotate(${f.rot*180/Math.PI} ${x} ${y})`:''}));}
    const below=knobUnderBar(f,k),side=below?.5:-.5,rr=touchPointer()?Math.min(5,Math.max(2.5,small*.2)):5;
    const top=toWorld(f,0,side*f.H),rot=toWorld(f,0,side*f.H+(below?22:-22)*k);overlay.append(el('line',{class:'sel-stem',x1:top[0],y1:top[1],x2:rot[0],y2:rot[1]}));
      overlay.append(el('circle',{class:'sel-hit','data-hit':'rot',cx:rot[0],cy:rot[1],r:22*k}),
      el('circle',{class:'sel-handle sel-rotate','data-handle':'rot',tabindex:0,role:'button','aria-label':HANDLE_LABEL.rot,cx:rot[0],cy:rot[1],r:rr*k}));
    {const spot=angleSpot(f);if(spot)drawAngle(spot,spot.deg);}
    if(note){const base=toWorld(f,0,f.H/2),t=el('text',{class:'sel-note',x:base[0],y:base[1]+16*k,'text-anchor':'middle','font-size':11*k});t.textContent=
      note;overlay.append(t);}
    drawSmart();
    overlay.prepend(...overlay.querySelectorAll('.sel-hit'));
    if(keyFocus){overlay.querySelector(`[data-handle="${keyFocus}"]`)?.focus({preventScroll:true});keyFocus=null;}
  }

  // ---- pointer interaction (select tool) ---------------------------------------------------------------------
  const coord=tools.coord;
  const shapeEls=(/** @type {any} */ ids)=>ids.map((/** @type {any} */ id)=>svg.querySelector(`#shapes [data-id="${id}"]`)).filter(Boolean);
  const stash=(/** @type {any} */ elements)=>elements.map((/** @type {any} */ n)=>({n,t:n.getAttribute('transform')||''}));
  const restore=(/** @type {any} */ list)=>{for(const {n,t} of list){if(t)n.setAttribute('transform',t);
  else n.removeAttribute('transform');
  document.getElementById('clip-'+n.dataset.id)?.firstElementChild?.removeAttribute('transform');
  }};
  const setT=(/** @type {any} */ list,/** @type {any} */ prefix)=>{for(const {n,t} of list)n.setAttribute('transform',`${prefix} ${t}`.trim());};
  // A mask's cut lives in its clipPath, so the drag transform is mirrored there for the clipped objects to follow it.
  const previewMask=(/** @type {any} */ list,/** @type {any} */ prefix)=>
    {for(const {n,t} of list)document.getElementById('clip-'+n.dataset.id)?.firstElementChild?.setAttribute('transform',`${prefix} ${t}`.trim());
  };
  const deg=(/** @type {any} */ r)=>r*180/Math.PI;

  const touches=new Map();
  let previewFrame=0;
  /** @type {any} */ let previewPending=null;
  function previewMove(/** @type {number[]} */ ids,/** @type {number} */ dx,/** @type {number} */ dy){
    previewPending=[ids,dx,dy];
    if(!previewFrame)previewFrame=requestAnimationFrame(()=>{previewFrame=0;const [i,x,y]=previewPending;previewPending=null;api.previewMove?.(i,x,y);});
  }
  function cancelPreview(){if(previewFrame)cancelAnimationFrame(previewFrame);previewFrame=0;previewPending=null;}
  function cancelState(){if(!state)return;restore(state.els||[]);if(state.type==='move'){cancelPreview();api.previewMove?.(state.ids,0,0);}overlay.removeAttribute('transform');state=null;smartLines=[];panningState.set(false);
    deletingGuideState.set(false);refresh();}
  function pinchState(){const [a,b]=touches.values(),{w,h,px:mx,py:my}=anchorIn((a.x+b.x)/2,(a.y+b.y)/2);
    return {type:'pinch',dist:Math.hypot(a.x-b.x,a.y-b.y)||1,s0:vp.s,wx:vp.cx+(mx-w/2)/vp.s,wy:vp.cy+(my-h/2)/vp.s};}
  function pinchTo(/** @type {any} */ s){const [a,b]=touches.values(),{w,h,px:mx,py:my}=anchorIn((a.x+b.x)/2,(a.y+b.y)/2);
  vp.s=Math.max(.4,Math.min(160,s.s0*Math.hypot(a.x-b.x,a.y-b.y)/s.dist));
  vp.cx=s.wx-(mx-w/2)/vp.s;
  vp.cy=s.wy-(my-h/2)/vp.s;
  apply();
  }
  container.addEventListener('pointerleave',()=>{if(hintOn&&!state){hintOn=false;smartLines=[];drawSmart();}});
  container.addEventListener('pointerdown',(/** @type {any} */ e)=>{
    if(e.pointerType!=='touch')return;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size!==2)return;
    cancelState();state=pinchState();panningState.set(true);
  });

  svg.addEventListener('pointerdown',(/** @type {any} */ e)=>{
    if(e.pointerType==='touch'&&touches.size>0)return;
    if(e.button===1||(e.button===0&&(spaceDown||handModeState.get()))){e.preventDefault();state=
      {type:'pan',x:e.clientX,y:e.clientY,cx:vp.cx,cy:vp.cy,pid:e.pointerId};panningState.set(true);svg.setPointerCapture?.(e.pointerId);return;}
    if(e.button===0&&api.tool()==='measure'){e.preventDefault();tools.measureClick(coord(e));return;}
    if(e.button===0&&api.tool()==='knife'){e.preventDefault();tools.knifeClick(coord(e));return;}
    if(e.button!==0||api.tool()!=='select')return;
    if(api.pickPivot?.(coord(e))){e.preventDefault();e.stopPropagation();return;}
    if(e.target.closest?.('.path-node,.path-handle'))return;
    closeMenu();
    const p=coord(e),o=hit(p);
    const handle=e.target.closest?.('[data-handle],[data-hit]'),name=handle?.dataset.handle??handle?.dataset.hit;
    if(handle&&!bodyMoves(name,o,p)){e.preventDefault();startHandle(e,name);return;}
    if(o){e.preventDefault();startMove(e,o,p);if(e.pointerType==='touch')armLongPress(e,o,p);}else{startMarquee(e,p);if(document.getElementById('canvasText'))state.dismissesText=true;}
  });
  // A resize handle's touch target is 44 screen px square and can reach over a small object's body. The shared rule in
  // handleClaim.js decides, for mouse and touch alike, whether a press near a resize handle resizes or moves the object.
  // The rotate and fill-angle handles are not in HANDLES, so they keep their whole square.
  function bodyMoves(/** @type {string} */ name,/** @type {any} */ o,/** @type {any} */ p){
    const spec=HANDLES.find(([n])=>n===name),f=frame();
    if(!spec||!f||!o||!api.ids().includes(o.id))return false;
    const [hx,hy]=toWorld(f,(spec[1]-.5)*f.W,(spec[2]-.5)*f.H);
    return !pressClaimedByHandle(Math.hypot(p[0]-hx,p[1]-hy),f.W,f.H,vp.s);
  }
  // Touch long-press: holding a finger on an object for 500 ms opens its object menu. A move of 8 px or more, a
  // second finger, or a lift before 500 ms cancels it. The press first runs as a plain move; the hold cancels that move
  // (nothing changes) before the menu opens.
  /** @type {{pid:number,x:number,y:number,timer:any}|null} */
  let longPress=null;
  function clearLongPress(){if(longPress)clearTimeout(longPress.timer);longPress=null;}
  function armLongPress(/** @type {any} */ e,/** @type {any} */ o,/** @type {any} */ p){
    clearLongPress();const pid=e.pointerId,x=e.clientX,y=e.clientY;
    longPress={pid,x,y,timer:setTimeout(()=>{longPress=null;
      if(touches.size>1||state?.type!=='move'||state.pid!==pid)return;
      cancelState();openObjectMenu(x,y,o,p);},500)};
  }
  // On a touch screen the dock (portrait) or rail (landscape) covers the canvas's edge and the canvas does not scroll, so a
  // dragged object is kept clear of it. A mouse keeps the floating desktop rail over the canvas, so it is not clamped there.
  function keepMoveOnCanvas(/** @type {number[]} */ box,/** @type {number} */ dx,/** @type {number} */ dy){
    if(!globalThis.matchMedia?.('(pointer: coarse)').matches)return [dx,dy];
    const sr=svg.getBoundingClientRect();
    const bars=[...document.querySelectorAll('.tool-rail,.zoombar,.phone-selection')].map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height);
    // The frame's handles and rotate stem reach about 27 px past the bounding box, so the box is kept this far inside the
    // visible area; otherwise the bottom handles would be clipped at the edge.
    const m=30,v=visibleCanvasRect(sr,bars),visible={left:v.left+m,top:v.top+m,right:v.right-m,bottom:v.bottom-m};
    return clampMoveDelta({box,delta:[dx,dy],scale:vp.s,center:[vp.cx,vp.cy],svgRect:sr,visible});
  }
  function startMove(/** @type {any} */ e,/** @type {any} */ o,/** @type {any} */ p){
    // Double-click is decided on pointer-up (see the move branch), so a quick press-and-drag still moves.
    const now=performance.now(),dbl=Boolean(lastClick&&now-lastClick.t<380&&lastClick.id===o.id&&Math.hypot(p[0]-lastClick.p[0],p[1]-lastClick.p[1])*vp.s<8);
    lastClick=dbl?null:{t:now,id:o.id,p};
    const group=tools.withGroup(o.id),cur=new Set(api.ids());
    // The Select toggle on the selection bar makes a plain tap add or remove an object, as Shift+click does.
    if(e.shiftKey||multiSelectState.get()){const next=new Set(cur);if([...group].every(id=>cur.has(id))&&cur.size>group.size)for(const id of group)next.delete(id);
      else for(const id of group)next.add(id);api.select([...next],[...next].includes(o.id)?o.id:[...next].at(-1));return;}
    const wasSelected=cur.has(o.id);if(!wasSelected)api.select([...group],o.id);
    const ids=api.ids(),f=/** @type {any} */(frame()),box=f?.oriented?objectBounds(api.doc().objects.find((/** @type {any} */ v)=>v.id===ids[0])):f.b;
    state={type:'move',ids,start:p,box,els:stash(shapeEls(ids)),moved:false,clicked:o,wasSelected,pid:e.pointerId,delta:[0,0],dbl};
      svg.setPointerCapture?.(e.pointerId);
  }
  function startMarquee(/** @type {any} */ e,/** @type {any} */ p){state=
    {type:api.isEditing()?'nodemarquee':'marquee',start:p,add:e.shiftKey,pid:e.pointerId,rect:null};
  svg.setPointerCapture?.(e.pointerId);
  overlay.replaceChildren();
  }
  function startHandle(/** @type {any} */ e,/** @type {any} */ name){
    const ids=api.ids(),f=frame();if(!f)return;const els=stash(shapeEls(ids)),q=coord(e);
    if(name==='angle'){
     const spot=angleSpot(f);if(!spot)return;
     state={type:'angle',id:spot.id,c:spot.c,dist:spot.dist,deg:spot.deg,next:spot.deg,pid:e.pointerId};
     svg.setPointerCapture?.(e.pointerId);return;
    }
    state=name==='rot'?{type:'rotate',ids,f,els,a0:Math.atan2(q[1]-f.c[1],q[0]-f.c[0]),angle:0,pid:e.pointerId}:
      {type:'resize',name,ids,f,els,pid:e.pointerId,sx:1,sy:1,anchor:null,alt:false};
    svg.setPointerCapture?.(e.pointerId);
  }
  function commitResize(/** @type {any} */ s){
    if(!s.f.oriented){api.commit([{op:'scale',ids:s.ids,sx:s.sx,sy:s.sy,ox:s.anchor[0],oy:s.anchor[1]}],undefined,t('resize'));return;}
    const f=s.f,[ax,ay]=s.local,nc=toWorld(f,ax*(1-s.sx),ay*(1-s.sy)),W=f.W*s.sx,H=f.H*s.sy;
    api.commit([{op:'transform',id:f.id,x:nc[0]-W/2,y:nc[1]-H/2,width:W,height:H}],undefined,t('resize'));
  }
  function nudgeHandle(/** @type {any} */ name,/** @type {any} */ e){
    const f=frame();if(!f)return;const ids=api.ids(),step=e.shiftKey?10:1;
    const right=e.key==='ArrowRight',left=e.key==='ArrowLeft',down=e.key==='ArrowDown';
    if(name==='angle'){
     const spot=angleSpot(f);if(!spot)return;
     const d=(right||down?1:-1)*(e.shiftKey?15:1),next=((spot.deg+d)%180+180)%180;
     keyFocus=name;api.commit([{op:'set_object',id:spot.id,angle:next}]);return;
    }
    if(name==='rot'){keyFocus=name;api.commit([{op:'rotate',ids,angle:(right||down?1:-1)*(e.shiftKey?15:1),cx:f.c[0],cy:f.c[1]}]);return;}
    const dx=right?step:left?-step:0,dy=down?step:e.key==='ArrowUp'?-step:0;
    const co=Math.cos(f.rot),si=Math.sin(f.rot),lx=dx*co+dy*si,ly=-dx*si+dy*co;
    const fx=name.includes('e')?1:name.includes('w')?0:.5,fy=name.includes('s')?1:name.includes('n')?0:.5;
    const hx=(fx-.5)*f.W,hy=(fy-.5)*f.H,ax=-hx,ay=-hy;
    const sx=name==='n'||name==='s'?1:clampResizeScale((hx+lx-ax)/(hx-ax),f.W),sy=name==='e'||name==='w'?1:clampResizeScale((hy+ly-ay)/(hy-ay),f.H);
    if(Math.abs(sx-1)<1e-4&&Math.abs(sy-1)<1e-4)return;
    keyFocus=name;commitResize({f,ids,sx,sy,anchor:toWorld(f,ax,ay),local:[ax,ay]});
  }
  overlay.addEventListener('keydown',(/** @type {any} */ e)=>{
    const h=e.target.closest?.('[data-handle]');if(!h||!e.key.startsWith('Arrow'))return;
    e.preventDefault();e.stopPropagation();nudgeHandle(h.dataset.handle,e);
  });
  window.addEventListener('pointermove',e=>{
    if(longPress&&e.pointerId===longPress.pid&&Math.hypot(e.clientX-longPress.x,e.clientY-longPress.y)>=8)clearLongPress();
    if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(state?.type==='pinch'){pinchTo(state);return;}
    if(!state){hoverHint(e);return;}
    if(state.type==='pan'){vp.cx=state.cx-(e.clientX-state.x)/vp.s;vp.cy=state.cy-(e.clientY-state.y)/vp.s;apply();return;}
    if(e.pointerId!==state.pid)return;
    if(state.type==='guide'){const q=coord(e);
    const out=overRuler(e,container),pos=state.axis==='x'?q[0]:q[1];
    overlay.querySelectorAll('.guide-preview').forEach((/** @type {any} */ n)=>n.remove());
    if(!out){const big=1e5,x=state.axis==='x';
    overlay.append(el('line',{class:'guide guide-preview',x1:x?pos:-big,x2:x?pos:big,y1:x?-big:pos,y2:x?big:pos}));
    }state.pos=pos;
    state.out=out;
    deletingGuideState.set(Boolean(out&&state.index!==null));
    return;
    }
    const q=coord(e);
    if(state.type==='move'){let dx=q[0]-state.start[0],dy=q[1]-state.start[1];if(Math.hypot(dx,dy)*vp.s<3&&!state.moved)return;state.moved=true;
      smartLines=[];
        if(api.snapOn()){const g=api.gridSize();dx=+(Math.round((state.box[0]+dx)/g)*g-state.box[0]).toFixed(3);
        dy=+(Math.round((state.box[1]+dy)/g)*g-state.box[1]).toFixed(3);}
      if(!e.ctrlKey&&!e.metaKey){const moved=[state.box[0]+dx,state.box[1]+dy,state.box[2]+dx,state.box[3]+dy],[sx,sy]=
        snapMove(moved,state.ids,
        api.doc().objects.filter((/** @type {any} */ o)=>state.ids.includes(o.id)&&o.kind==='path'&&Array.isArray(o.points)).flatMap((/** @type {any} */ o)=>
        o.points.map((/** @type {any} */ q)=>[q[0]+dx,q[1]+dy])));
      dx+=sx;
      dy+=sy;
      }
      [dx,dy]=keepMoveOnCanvas(state.box,dx,dy);
      state.delta=[dx,dy];previewMove(state.ids,dx,dy);setT(state.els,`translate(${dx} ${dy})`);overlay.setAttribute('transform',`translate(${dx} ${dy})`);
        previewMask(state.els,`translate(${dx} ${dy})`);drawSmart();return;}
    if(state.type==='marquee'||state.type==='nodemarquee'){const [x0,y0]=state.start,
      r=[Math.min(x0,q[0]),Math.min(y0,q[1]),Math.max(x0,q[0]),Math.max(y0,q[1])];state.rect=r;
      overlay.replaceChildren(el('rect',{class:'marquee',x:r[0],y:r[1],width:r[2]-r[0],height:r[3]-r[1]}));return;}
    if(state.type==='angle'){
     let a=Math.atan2(q[1]-state.c[1],q[0]-state.c[0])*180/Math.PI;
     if(e.shiftKey)a=Math.round(a/15)*15;
     a=((a%180)+180)%180;state.next=Math.round(a*10)/10;
     overlay.replaceChildren();drawAngle({c:state.c,dist:state.dist},state.next,`${formatNumber(state.next, lang, 1)}°`);return;
    }
    if(state.type==='rotate'){const f=state.f;let a=Math.atan2(q[1]-f.c[1],q[0]-f.c[0])-state.a0;a=deg(a);if(e.shiftKey)a=Math.round(a/15)*15;
      a=((a+540)%360)-180;state.angle=a;const tr=`rotate(${a} ${f.c[0]} ${f.c[1]})`;setT(state.els,tr);previewMask(state.els,tr);
      overlay.setAttribute('transform',`rotate(${a} ${f.c[0]} ${f.c[1]})`);return;}
    if(state.type==='resize'){const f=state.f,n=state.name;smartLines=[];let p=api.snapOn()?api.snapPt(q):q;if(!f.oriented&&!e.ctrlKey&&!e.metaKey)p=
      snapPoint(p,state.ids);
      const l=toLocal(f,p),fx=n.includes('e')?1:n.includes('w')?0:.5,fy=n.includes('s')?1:n.includes('n')?0:.5,hx=(fx-.5)*f.W,hy=(fy-.5)*f.H;
      const alt=e.altKey,ax=alt?0:-hx,ay=alt?0:-hy;
      let sx=n==='n'||n==='s'?1:(l[0]-ax)/((hx-ax)||1),sy=n==='e'||n==='w'?1:(l[1]-ay)/((hy-ay)||1);
      // An axis the handle does not move keeps its scale of 1, so only the moving axes are clamped.
      if(e.shiftKey){const s=clampResizeScale(n==='n'||n==='s'?sy:n==='e'||n==='w'?sx:Math.max(sx,sy),Math.min(f.W,f.H));sx=s;sy=s;}
      else{if(n!=='n'&&n!=='s')sx=clampResizeScale(sx,f.W);if(n!=='e'&&n!=='w')sy=clampResizeScale(sy,f.H);}
      const A=toWorld(f,ax,ay);state.sx=sx;state.sy=sy;state.anchor=A;state.local=[ax,ay];
      const r=deg(f.rot),tr=
        f.rot?`translate(${A[0]} ${A[1]}) rotate(${r}) scale(${sx} ${sy}) rotate(${-r}) translate(${-A[0]} ` +
        `${-A[1]})`:`translate(${A[0]} ${A[1]}) scale(${sx} ${sy}) translate(${-A[0]} ${-A[1]})`;
        setT(state.els,tr);previewMask(state.els,tr);
      refresh({...f,W:f.W*sx,H:f.H*sy,c:toWorld(f,ax+(-ax)*sx,ay+(-ay)*sy)},`${formatNumber(f.W*sx, lang, 1)} × ${formatNumber(f.H*sy, lang, 1)} mm`);
        overlay.querySelectorAll('.sel-handle').forEach(()=>{});}
  });
  window.addEventListener('pointerup',e=>{
    if(longPress&&e.pointerId===longPress.pid)clearLongPress();
    if(touches.delete(e.pointerId)&&state?.type==='pinch'&&touches.size<2){state=null;panningState.set(false);}
    if(!state)return;const s=state;
    if(s.type==='pan'){state=null;panningState.set(false);return;}
    if(e.pointerId!==s.pid)return;state=null;overlay.removeAttribute('transform');smartLines=[];deletingGuideState.set(false);
    if(s.type==='guide'){overlay.querySelectorAll('.guide-preview').forEach((/** @type {any} */ n)=>n.remove());
    if(s.pos===undefined){refresh();
    return;
    }if(s.index===null){if(!s.out)api.commit([{op:'add_guide',axis:s.axis,pos:s.pos}]);
    else refresh();
    }else if(s.out)api.commit([{op:'remove_guide',index:s.index}]);
    else api.commit([{op:'move_guide',index:s.index,pos:s.pos}]);
    return;
    }
    if(s.type==='move'){restore(s.els);cancelPreview();api.previewMove?.(s.ids,0,0);
      if(!s.moved&&s.dbl){api.dblclick(s.clicked,s.start);return;}
      if(s.moved&&Math.hypot(...s.delta)>.02)api.commit([{op:'translate',ids:s.ids,dx:s.delta[0],dy:s.delta[1]}],undefined,t('move'));
      else{if(!s.moved&&api.ids().length>1&&!e.shiftKey&&s.wasSelected){const g=tools.withGroup(s.clicked.id);api.select([...g],s.clicked.id);}else refresh();
      }return;}
    if(s.type==='marquee'){const r=s.rect;if(!r||(r[2]-r[0])*vp.s<4&&(r[3]-r[1])*vp.s<4){if(!s.add&&!s.dismissesText)api.select([],null);else{refresh();if(s.dismissesText){const t=/** @type {HTMLTextAreaElement|null} */(document.getElementById('letteringText'));if(t){t.focus();t.select();}}}return;}
      const picked=new Set(s.add?api.ids():[]);
        for(const o of api.doc().objects){if(o.visible===false||o.locked)continue;const b=objectBounds(o);
        if(b[2]>=r[0]&&b[0]<=r[2]&&b[3]>=r[1]&&b[1]<=r[3])for(const id of tools.withGroup(o.id))picked.add(id);}
      api.select([...picked],[...picked].at(-1)??null);return;}
    if(s.type==='nodemarquee'){const r=s.rect;
      if(!r||(r[2]-r[0])*vp.s<4&&(r[3]-r[1])*vp.s<4){if(!s.add)api.select([],null);else refresh();return;}api.selectNodesIn(r,s.add);return;}
    if(s.type==='angle'){if(Math.abs(s.next-s.deg)<.05){refresh();return;}api.commit([{op:'set_object',id:s.id,angle:s.next}]);return;}
    if(s.type==='rotate'){restore(s.els);if(Math.abs(s.angle)>.05)api.commit([{op:'rotate',ids:s.ids,angle:s.angle,cx:s.f.c[0],cy:s.f.c[1]}]);
      else refresh();return;}
    if(s.type==='resize'){restore(s.els);if(!s.anchor||(Math.abs(s.sx-1)<1e-4&&Math.abs(s.sy-1)<1e-4)){refresh();return;}commitResize(s);}
  });
  window.addEventListener('pointercancel',e=>{if(longPress&&e.pointerId===longPress.pid)clearLongPress();touches.delete(e.pointerId);if(state?.type==='pinch'){state=null;panningState.set(false);return;}cancelState();});
  // Escape during an object move, rotate or resize (or a node drag) cancels that drag and nothing else: it is stopped in
  // the capture phase so the shortcut handler does not also clear the selection or switch tools. A press that never moved
  // is not a drag, so Escape there keeps its usual meaning.
  window.addEventListener('keydown',(/** @type {any} */ e)=>{
    if(e.key!=='Escape')return;
    if(state&&(state.type==='rotate'||state.type==='resize'||(state.type==='move'&&state.moved))){e.stopImmediatePropagation();cancelState();return;}
    if(editing.cancelNodeDrag()){e.stopImmediatePropagation();}
  },true);

  // ---- context menu ------------------------------------------------------------------------------------------
  const contextMenu=createContextMenu();
  const closeMenu=contextMenu.close;
  document.addEventListener('pointerdown',e=>contextMenu.closeIfOutside(e.target),true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  function openObjectMenu(/** @type {number} */ x,/** @type {number} */ y,/** @type {any} */ o,/** @type {any} */ p){
    contextMenu.open(api.menuItems(o,p),x,y);
  }
  svg.addEventListener('contextmenu',(/** @type {any} */ e)=>{
    if(api.tool()!=='select')return;e.preventDefault();const p=coord(e),o=hit(p);if(o&&!api.ids().includes(o.id))api.select([...tools.withGroup(o.id)],o.id);
    openObjectMenu(e.clientX,e.clientY,o,p);
  });

  api.zoomUi?.(zoomAt,fitHoop,fitAll,zoomTo100);
  return {vp,apply,refresh,drawScene,fitHoop,recentreOnNextResize:()=>{recentreUntil=performance.now()+500;},fitAll,fitSelection,fitAboveSheet,revealSelection,panToReveal,viewport,setViewport,visibleArea,zoomAt,zoomTo100,toScreen,scale:()=>vp.s,percent:()=>Math.round(vp.s/PX_PER_MM*100),hit,
    closeMenu,isDragging:()=>Boolean(state),inField,RULER,
    px:editing.px,drawControls:editing.drawControls,showSnap:editing.showSnap,
    snapPt:editing.snapPt,insertNodeAt:editing.insertNodeAt,deleteNode:editing.deleteNode,
    add:tools.add,coord,withGroup:tools.withGroup,setTool:tools.setTool,endPath:tools.endPath,
    drawPathPreview:tools.drawPathPreview,continueDigitizing:tools.continueDigitizing};
}
