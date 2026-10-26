// Canvas interaction layer: an infinite pan/zoom viewport with rulers and guides, geometric hit testing, selection with
// resize/rotate handles (oriented for a single rotated shape), smart snapping, marquee selection and the context menu.
// Document state stays in app.js; this module talks to it through `api`.
import {geometry,objectBounds,hoopSize} from './engine.js';

const SVG='http://www.w3.org/2000/svg',PX_PER_MM=96/25.4;
const el=(tag,attrs={})=>{const n=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
const union=bs=>[Math.min(...bs.map(b=>b[0])),Math.min(...bs.map(b=>b[1])),Math.max(...bs.map(b=>b[2])),Math.max(...bs.map(b=>b[3]))];
function pointInRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function segDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
const RULER=18;

export function createCanvas(api){
  const {svg,container,overlay}=api;
  const vp={cx:0,cy:0,s:PX_PER_MM*1.9};let spaceDown=false,state=null,lastClick=null,menu=null,smartLines=[],hintOn=false;
  const rulerTop=container.querySelector('#rulerTop'),rulerLeft=container.querySelector('#rulerLeft'),guidesLayer=svg.querySelector('#guides');
  const size=()=>{const r=container.getBoundingClientRect();return {w:Math.max(200,r.width),h:Math.max(200,r.height)};};
  const inField=e=>e.target.closest?.('input,select,textarea,[contenteditable="true"],#fontPanel');

  // ---- viewport ---------------------------------------------------------------------------------------------
  function toScreen(x,y){const {w,h}=size();return [(x-vp.cx)*vp.s+w/2,(y-vp.cy)*vp.s+h/2];}
  function apply(){const {w,h}=size();svg.setAttribute('viewBox',`${vp.cx-w/(2*vp.s)} ${vp.cy-h/(2*vp.s)} ${w/vp.s} ${h/vp.s}`);svg.setAttribute('preserveAspectRatio','none');api.onViewport?.(vp);drawRulers();refresh();}
  function fitRect(x0,y0,x1,y1,margin=48){const {w,h}=size();vp.cx=(x0+x1)/2;vp.cy=(y0+y1)/2;vp.s=Math.max(.4,Math.min(120,Math.min((w-margin*2-RULER)/Math.max(1,x1-x0),(h-margin*2-RULER)/Math.max(1,y1-y0))));vp.cx-=RULER/2/vp.s;vp.cy-=RULER/2/vp.s;apply();}
  function fitHoop(){const hs=hoopSize(api.doc());fitRect(-hs.w/2,-hs.h/2,hs.w/2,hs.h/2,56);}
  function contentBounds(ids){const d=api.doc(),hs=hoopSize(d),list=ids?d.objects.filter(o=>ids.includes(o.id)):d.objects,bs=list.filter(o=>o.visible!==false).map(objectBounds);return ids&&bs.length?union(bs):union([[-hs.w/2,-hs.h/2,hs.w/2,hs.h/2],...bs]);}
  function fitAll(){fitRect(...contentBounds(),56);}
  function fitSelection(){const ids=api.ids();if(!ids.length)return fitAll();fitRect(...contentBounds(ids),90);}
  function zoomAt(factor,clientX,clientY){const {w,h}=size(),r=container.getBoundingClientRect(),px=(clientX??r.left+w/2)-r.left,py=(clientY??r.top+h/2)-r.top,wx=vp.cx+(px-w/2)/vp.s,wy=vp.cy+(py-h/2)/vp.s;vp.s=Math.max(.4,Math.min(160,vp.s*factor));vp.cx=wx-(px-w/2)/vp.s;vp.cy=wy-(py-h/2)/vp.s;apply();}
  function zoomTo100(){zoomAt(PX_PER_MM/vp.s);}
  container.addEventListener('wheel',e=>{if(e.target.closest?.('#preview3d,.floating,.zoombar,#ctxMenu'))return;e.preventDefault();
    const mouse=e.deltaMode===1||(Math.abs(e.deltaY)>=100&&e.deltaX===0&&Number.isInteger(e.deltaY));
    if(e.ctrlKey||e.metaKey||mouse)zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?.01:.0016)),e.clientX,e.clientY);else{vp.cx+=e.deltaX/vp.s;vp.cy+=e.deltaY/vp.s;apply();}},{passive:false});
  new ResizeObserver(()=>apply()).observe(container);
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!inField(e)){spaceDown=true;container.classList.add('panning');if(e.target===document.body)e.preventDefault();}});
  document.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;container.classList.remove('panning');}});

  // ---- rulers and guides ------------------------------------------------------------------------------------
  function niceStep(){for(const s of [.5,1,2,5,10,20,50,100,200,500])if(s*vp.s>=42)return s;return 1000;}
  function drawRulers(){
    if(!rulerTop)return;const {w,h}=size(),dpr=devicePixelRatio||1,step=niceStep(),sub=step>=5?5:step>=2?4:2;
    for(const [cv,horizontal] of [[rulerTop,true],[rulerLeft,false]]){const len=horizontal?w:h;cv.width=(horizontal?w:RULER)*dpr;cv.height=(horizontal?RULER:h)*dpr;cv.style.width=(horizontal?w:RULER)+'px';cv.style.height=(horizontal?RULER:h)+'px';
      const g=cv.getContext('2d');g.scale(dpr,dpr);g.fillStyle='#fbfbf9';g.fillRect(0,0,cv.width,cv.height);g.strokeStyle='#c9cec8';g.fillStyle='#66726c';g.lineWidth=1;g.font='9px Inter,system-ui,sans-serif';
      const c0=horizontal?vp.cx-w/(2*vp.s):vp.cy-h/(2*vp.s),c1=c0+len/vp.s,first=Math.floor(c0/(step/sub))*(step/sub);
      for(let v=first;v<=c1+step;v+=step/sub){const pos=(v-c0)*vp.s+.5,major=Math.abs(v/step-Math.round(v/step))<1e-6,tick=major?RULER:RULER*.35;g.beginPath();if(horizontal){g.moveTo(pos,RULER);g.lineTo(pos,RULER-tick);}else{g.moveTo(RULER,pos);g.lineTo(RULER-tick,pos);}g.stroke();
        if(major){const label=String(Math.round(v*100)/100);if(horizontal)g.fillText(label,pos+2,9);else{g.save();g.translate(9,pos-2);g.rotate(-Math.PI/2);g.fillText(label,0,0);g.restore();}}}
      g.strokeStyle='#dfe3dd';g.beginPath();if(horizontal){g.moveTo(0,RULER-.5);g.lineTo(w,RULER-.5);}else{g.moveTo(RULER-.5,0);g.lineTo(RULER-.5,h);}g.stroke();}
  }
  // The measure tool's line and its two points, drawn in mm over the design.
  function drawMeasure(){const m=api.measure?.();if(!m)return;const k=1/vp.s;if(m.b)overlay.append(el('line',{class:'measure-line',x1:m.a[0],y1:m.a[1],x2:m.b[0],y2:m.b[1]}));for(const p of m.b?[m.a,m.b]:[m.a])overlay.append(el('circle',{class:'measure-point',cx:p[0],cy:p[1],r:3*k}));}
  // The knife tool's points, joined by lines, until Enter cuts the shape along them.
  function drawKnife(){const k=api.knife?.();if(!k?.length)return;if(k.length>1)overlay.append(el('polyline',{class:'measure-line',fill:'none',points:k.map(p=>p.join(',')).join(' ')}));for(const p of k)overlay.append(el('circle',{class:'measure-point',cx:p[0],cy:p[1],r:3/vp.s}));}
  function drawGuides(){
    if(!guidesLayer)return;guidesLayer.replaceChildren();const d=api.doc(),big=1e5;
    (d.guides||[]).forEach((g,i)=>{const x=g.axis==='x';const line=el('line',{class:'guide','data-guide':i,x1:x?g.pos:-big,x2:x?g.pos:big,y1:x?-big:g.pos,y2:x?big:g.pos});guidesLayer.append(line);guidesLayer.append(el('line',{class:'guide-hit','data-guide':i,x1:line.getAttribute('x1'),x2:line.getAttribute('x2'),y1:line.getAttribute('y1'),y2:line.getAttribute('y2')}));});
  }
  const overRuler=e=>{const r=container.getBoundingClientRect();return e.clientX<r.left+RULER||e.clientY<r.top+RULER||e.clientX>r.right||e.clientY>r.bottom;};
  for(const [cv,axis] of [[rulerTop,'y'],[rulerLeft,'x']])cv?.addEventListener('pointerdown',e=>{if(e.button!==0||(e.pointerType==='touch'&&touches.size>0))return;e.preventDefault();state={type:'guide',axis,index:null,pid:e.pointerId};cv.setPointerCapture?.(e.pointerId);});
  svg.addEventListener('pointerdown',e=>{const g=e.target.closest?.('.guide-hit');if(!g||e.button!==0||api.tool()!=='select')return;e.preventDefault();e.stopPropagation();const i=Number(g.dataset.guide),guide=api.doc().guides[i];state={type:'guide',axis:guide.axis,index:i,pid:e.pointerId};svg.setPointerCapture?.(e.pointerId);},true);

  // ---- smart snapping ---------------------------------------------------------------------------------------
  // Candidates: ruler guides, the hoop centre and edges, and the edges/centres of the other objects.
  function candidates(exclude){const d=api.doc(),hs=hoopSize(d),xs=[0,-hs.w/2,hs.w/2],ys=[0,-hs.h/2,hs.h/2];for(const g of d.guides||[])(g.axis==='x'?xs:ys).push(g.pos);
    for(const o of d.objects){if(exclude.includes(o.id)||o.visible===false)continue;const b=objectBounds(o);xs.push(b[0],(b[0]+b[2])/2,b[2]);ys.push(b[1],(b[1]+b[3])/2,b[3]);if(o.kind==='path'&&Array.isArray(o.points))for(const q of o.points){xs.push(q[0]);ys.push(q[1]);}}return {xs,ys};}
  function bestDelta(values,cands,tol){let best=null;for(const v of values)for(const c of cands){const d=c-v;if(Math.abs(d)<=tol&&(best===null||Math.abs(d)<Math.abs(best.d)))best={d,at:c};}return best;}
  function snapMove(box,exclude,nodes=[]){const {xs,ys}=candidates(exclude),tol=6/vp.s,bx=bestDelta([box[0],(box[0]+box[2])/2,box[2],...nodes.map(q=>q[0])],xs,tol),by=bestDelta([box[1],(box[1]+box[3])/2,box[3],...nodes.map(q=>q[1])],ys,tol);smartLines=[...(bx?[{axis:'x',pos:bx.at}]:[]),...(by?[{axis:'y',pos:by.at}]:[])];return [bx?.d??0,by?.d??0];}
  function snapPoint(p,exclude){const {xs,ys}=candidates(exclude),tol=6/vp.s,bx=bestDelta([p[0]],xs,tol),by=bestDelta([p[1]],ys,tol);smartLines=[...(bx?[{axis:'x',pos:bx.at}]:[]),...(by?[{axis:'y',pos:by.at}]:[])];return [p[0]+(bx?.d??0),p[1]+(by?.d??0)];}
  function drawSmart(){overlay.querySelectorAll('.smart').forEach(n=>n.remove());const big=1e5;for(const l of smartLines)overlay.append(el('line',{class:'smart',x1:l.axis==='x'?l.pos:-big,x2:l.axis==='x'?l.pos:big,y1:l.axis==='x'?-big:l.pos,y2:l.axis==='x'?big:l.pos}));}

  // Hovering a selected object shows the guides it already lines up with, so a drag from here will snap to them.
  function hoverHint(e){
    const f=frame(),o=f&&!f.oriented&&api.tool()==='select'?hit(coord(e)):null,on=Boolean(o)&&api.ids().includes(o.id);
    if(!on&&!hintOn)return;
    hintOn=on;smartLines=[];if(on)snapMove(f.b,api.ids());drawSmart();
  }

  // ---- hit testing -------------------------------------------------------------------------------------------
  function hitObject(o,p,tol){
    if(o.kind==='stitch_layer'||o.kind==='text'){const b=objectBounds(o);return p[0]>=b[0]-tol&&p[0]<=b[2]+tol&&p[1]>=b[1]-tol&&p[1]<=b[3]+tol;}
    const lines=geometry(o);if(!lines.length)return false;
    const interior=o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed&&o.stitch==='fill');
    if(interior){let inside=false;for(const ring of lines)if(pointInRing(p,ring))inside=!inside;if(inside)return true;}
    const reach=Math.max(tol,(o.stitch==='satin'?(o.satinWidth??3)/2:0));
    for(const line of lines)for(let i=1;i<line.length;i++)if(segDistance(p,line[i-1],line[i])<=reach)return true;
    return false;
  }
  function hit(p,tol=6/vp.s){const objs=api.doc().objects;for(let i=objs.length-1;i>=0;i--){const o=objs[i];if(o.visible===false||o.locked)continue;if(hitObject(o,p,tol))return o;}return null;}

  // ---- selection frame and overlay ---------------------------------------------------------------------------
  // The frame is axis-aligned for groups and multi-selections, and follows the object's own axes for a single rotated rectangle/ellipse/stitch layer.
  function frame(){const ids=api.ids(),d=api.doc(),objs=d.objects.filter(o=>ids.includes(o.id)&&o.visible!==false);if(!objs.length)return null;
    if(objs.length===1){const o=objs[0];if(o.rotation&&(o.kind==='rect'||o.kind==='ellipse'||o.kind==='stitch_layer'))return {rot:o.rotation*Math.PI/180,c:[o.x+o.w/2,o.y+o.h/2],W:o.w,H:o.h,oriented:true,id:o.id};}
    const b=union(objs.map(objectBounds));return {rot:0,c:[(b[0]+b[2])/2,(b[1]+b[3])/2],W:b[2]-b[0],H:b[3]-b[1],oriented:false,b};}
  const toWorld=(f,lx,ly)=>{const co=Math.cos(f.rot),si=Math.sin(f.rot);return [f.c[0]+lx*co-ly*si,f.c[1]+lx*si+ly*co];};
  const toLocal=(f,p)=>{const co=Math.cos(f.rot),si=Math.sin(f.rot),dx=p[0]-f.c[0],dy=p[1]-f.c[1];return [dx*co+dy*si,-dx*si+dy*co];};
  const HANDLES=[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]];
  const HANDLE_LABEL={nw:'Resize from north-west corner',n:'Resize from north edge',ne:'Resize from north-east corner',e:'Resize from east edge',se:'Resize from south-east corner',s:'Resize from south edge',sw:'Resize from south-west corner',w:'Resize from west edge',rot:'Rotate selection'};
  let keyFocus=null;
  function refresh(f0=null,note=null){
    drawGuides();overlay.replaceChildren();drawMeasure();drawKnife();if(api.tool()!=='select'||state?.type==='marquee'||state?.type==='nodemarquee')return;
    const f=f0||frame();if(!f||api.isEditing())return;const k=1/vp.s,hs=4*k,pv=api.pivot?.();
    if(pv)overlay.append(el('circle',{class:'pivot-mark',cx:pv[0],cy:pv[1],r:5*k}),el('line',{class:'sel-stem',x1:pv[0]-10*k,y1:pv[1],x2:pv[0]+10*k,y2:pv[1]}),el('line',{class:'sel-stem',x1:pv[0],y1:pv[1]-10*k,x2:pv[0],y2:pv[1]+10*k}));
    const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b])=>toWorld(f,a*f.W,b*f.H));
    overlay.append(el('polygon',{class:'sel-box',points:corners.map(p=>p.join(',')).join(' '),fill:'none'}));
    for(const [name,fx,fy] of HANDLES){if(name.length===1&&((name==='n'||name==='s')?f.W*vp.s<30:f.H*vp.s<30))continue;const [x,y]=toWorld(f,(fx-.5)*f.W,(fy-.5)*f.H);overlay.append(el('rect',{class:'sel-handle','data-handle':name,tabindex:0,role:'button','aria-label':HANDLE_LABEL[name],x:x-hs,y:y-hs,width:hs*2,height:hs*2,transform:f.rot?`rotate(${f.rot*180/Math.PI} ${x} ${y})`:''}));}
    const top=toWorld(f,0,-f.H/2),rot=toWorld(f,0,-f.H/2-22*k);overlay.append(el('line',{class:'sel-stem',x1:top[0],y1:top[1],x2:rot[0],y2:rot[1]}));overlay.append(el('circle',{class:'sel-handle sel-rotate','data-handle':'rot',tabindex:0,role:'button','aria-label':HANDLE_LABEL.rot,cx:rot[0],cy:rot[1],r:5*k}));
    if(note){const base=toWorld(f,0,f.H/2),t=el('text',{class:'sel-note',x:base[0],y:base[1]+16*k,'text-anchor':'middle','font-size':11*k});t.textContent=note;overlay.append(t);}
    drawSmart();
    if(keyFocus){overlay.querySelector(`[data-handle="${keyFocus}"]`)?.focus({preventScroll:true});keyFocus=null;}
  }

  // ---- pointer interaction (select tool) ---------------------------------------------------------------------
  const coord=api.coord;
  const shapeEls=ids=>ids.map(id=>svg.querySelector(`#shapes [data-id="${id}"]`)).filter(Boolean);
  const stash=elements=>elements.map(n=>({n,t:n.getAttribute('transform')||''}));
  const restore=list=>{for(const {n,t} of list){if(t)n.setAttribute('transform',t);else n.removeAttribute('transform');document.getElementById('clip-'+n.dataset.id)?.firstElementChild?.removeAttribute('transform');}};
  const setT=(list,prefix)=>{for(const {n,t} of list)n.setAttribute('transform',`${prefix} ${t}`.trim());};
  // A mask's cut lives in its clipPath, so the drag transform is mirrored there for the clipped objects to follow it.
  const previewMask=(list,prefix)=>{for(const {n,t} of list)document.getElementById('clip-'+n.dataset.id)?.firstElementChild?.setAttribute('transform',`${prefix} ${t}`.trim());};
  const deg=r=>r*180/Math.PI;

  const touches=new Map();let handMode=false;
  const handBtn=container.querySelector('#handTool');
  function setHand(on){handMode=on;container.classList.toggle('hand',on);handBtn?.setAttribute('aria-pressed',String(on));handBtn?.classList.toggle('active-tool',on);}
  handBtn?.addEventListener('click',()=>setHand(!handMode));
  function cancelState(){if(!state)return;restore(state.els||[]);overlay.removeAttribute('transform');state=null;smartLines=[];container.classList.remove('panning','deleting-guide');refresh();}
  function pinchState(){const [a,b]=touches.values(),r=container.getBoundingClientRect(),{w,h}=size(),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top;return {type:'pinch',dist:Math.hypot(a.x-b.x,a.y-b.y)||1,s0:vp.s,wx:vp.cx+(mx-w/2)/vp.s,wy:vp.cy+(my-h/2)/vp.s};}
  function pinchTo(s){const [a,b]=touches.values(),r=container.getBoundingClientRect(),{w,h}=size(),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top;vp.s=Math.max(.4,Math.min(160,s.s0*Math.hypot(a.x-b.x,a.y-b.y)/s.dist));vp.cx=s.wx-(mx-w/2)/vp.s;vp.cy=s.wy-(my-h/2)/vp.s;apply();}
  container.addEventListener('pointerleave',()=>{if(hintOn&&!state){hintOn=false;smartLines=[];drawSmart();}});
  container.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size!==2)return;
    cancelState();state=pinchState();container.classList.add('panning');
  });

  svg.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'&&touches.size>0)return;
    if(e.button===1||(e.button===0&&(spaceDown||handMode))){e.preventDefault();state={type:'pan',x:e.clientX,y:e.clientY,cx:vp.cx,cy:vp.cy,pid:e.pointerId};container.classList.add('panning');svg.setPointerCapture?.(e.pointerId);return;}
    if(e.button===0&&api.tool()==='measure'){e.preventDefault();api.measureClick(coord(e));return;}
    if(e.button===0&&api.tool()==='knife'){e.preventDefault();api.knifeClick(coord(e));return;}
    if(e.button!==0||api.tool()!=='select')return;
    if(api.pickPivot?.(coord(e))){e.preventDefault();e.stopPropagation();return;}
    if(e.target.closest?.('.path-node,.path-handle'))return;
    closeMenu();
    const handle=e.target.closest?.('[data-handle]');if(handle){e.preventDefault();startHandle(e,handle.dataset.handle);return;}
    const p=coord(e),o=hit(p);
    if(o){e.preventDefault();startMove(e,o,p);}else startMarquee(e,p);
  });
  function startMove(e,o,p){
    const now=performance.now();
    if(lastClick&&now-lastClick.t<380&&lastClick.id===o.id&&Math.hypot(p[0]-lastClick.p[0],p[1]-lastClick.p[1])*vp.s<8){lastClick=null;api.dblclick(o,p);return;}
    lastClick={t:now,id:o.id,p};
    const group=api.withGroup(o.id),cur=new Set(api.ids());
    if(e.shiftKey){const next=new Set(cur);if([...group].every(id=>cur.has(id))&&cur.size>group.size)for(const id of group)next.delete(id);else for(const id of group)next.add(id);api.select([...next],[...next].includes(o.id)?o.id:[...next].at(-1));return;}
    const wasSelected=cur.has(o.id);if(!wasSelected)api.select([...group],o.id);
    const ids=api.ids(),f=frame(),box=f?.oriented?objectBounds(api.doc().objects.find(v=>v.id===ids[0])):f.b;
    state={type:'move',ids,start:p,box,els:stash(shapeEls(ids)),moved:false,clicked:o,wasSelected,pid:e.pointerId,delta:[0,0]};svg.setPointerCapture?.(e.pointerId);
  }
  function startMarquee(e,p){state={type:api.isEditing()?'nodemarquee':'marquee',start:p,add:e.shiftKey,pid:e.pointerId,rect:null};svg.setPointerCapture?.(e.pointerId);overlay.replaceChildren();}
  function startHandle(e,name){
    const ids=api.ids(),f=frame();if(!f)return;const els=stash(shapeEls(ids)),q=coord(e);
    state=name==='rot'?{type:'rotate',ids,f,els,a0:Math.atan2(q[1]-f.c[1],q[0]-f.c[0]),angle:0,pid:e.pointerId}:{type:'resize',name,ids,f,els,pid:e.pointerId,sx:1,sy:1,anchor:null,alt:false};
    svg.setPointerCapture?.(e.pointerId);
  }
  function commitResize(s){
    if(!s.f.oriented){api.commit([{op:'scale',ids:s.ids,sx:s.sx,sy:s.sy,ox:s.anchor[0],oy:s.anchor[1]}]);return;}
    const f=s.f,[ax,ay]=s.local,nc=toWorld(f,ax*(1-s.sx),ay*(1-s.sy)),W=f.W*s.sx,H=f.H*s.sy;
    api.commit([{op:'transform',id:f.id,x:nc[0]-W/2,y:nc[1]-H/2,width:W,height:H}]);
  }
  function nudgeHandle(name,e){
    const f=frame();if(!f)return;const ids=api.ids(),step=e.shiftKey?10:1;
    const right=e.key==='ArrowRight',left=e.key==='ArrowLeft',down=e.key==='ArrowDown';
    if(name==='rot'){keyFocus=name;api.commit([{op:'rotate',ids,angle:(right||down?1:-1)*(e.shiftKey?15:1),cx:f.c[0],cy:f.c[1]}]);return;}
    const dx=right?step:left?-step:0,dy=down?step:e.key==='ArrowUp'?-step:0;
    const co=Math.cos(f.rot),si=Math.sin(f.rot),lx=dx*co+dy*si,ly=-dx*si+dy*co;
    const fx=name.includes('e')?1:name.includes('w')?0:.5,fy=name.includes('s')?1:name.includes('n')?0:.5;
    const hx=(fx-.5)*f.W,hy=(fy-.5)*f.H,ax=-hx,ay=-hy;
    const sx=name==='n'||name==='s'?1:Math.max(.02,(hx+lx-ax)/(hx-ax)),sy=name==='e'||name==='w'?1:Math.max(.02,(hy+ly-ay)/(hy-ay));
    if(Math.abs(sx-1)<1e-4&&Math.abs(sy-1)<1e-4)return;
    keyFocus=name;commitResize({f,ids,sx,sy,anchor:toWorld(f,ax,ay),local:[ax,ay]});
  }
  overlay.addEventListener('keydown',e=>{
    const h=e.target.closest?.('[data-handle]');if(!h||!e.key.startsWith('Arrow'))return;
    e.preventDefault();e.stopPropagation();nudgeHandle(h.dataset.handle,e);
  });
  window.addEventListener('pointermove',e=>{
    if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(state?.type==='pinch'){pinchTo(state);return;}
    if(!state){hoverHint(e);return;}
    if(state.type==='pan'){vp.cx=state.cx-(e.clientX-state.x)/vp.s;vp.cy=state.cy-(e.clientY-state.y)/vp.s;apply();return;}
    if(e.pointerId!==state.pid)return;
    if(state.type==='guide'){const q=coord(e);const out=overRuler(e),pos=state.axis==='x'?q[0]:q[1];overlay.querySelectorAll('.guide-preview').forEach(n=>n.remove());if(!out){const big=1e5,x=state.axis==='x';overlay.append(el('line',{class:'guide guide-preview',x1:x?pos:-big,x2:x?pos:big,y1:x?-big:pos,y2:x?big:pos}));}state.pos=pos;state.out=out;container.classList.toggle('deleting-guide',out&&state.index!==null);return;}
    const q=coord(e);
    if(state.type==='move'){let dx=q[0]-state.start[0],dy=q[1]-state.start[1];if(Math.hypot(dx,dy)*vp.s<3&&!state.moved)return;state.moved=true;
      smartLines=[];if(api.snapOn()){const g=api.gridSize();dx=+(Math.round((state.box[0]+dx)/g)*g-state.box[0]).toFixed(3);dy=+(Math.round((state.box[1]+dy)/g)*g-state.box[1]).toFixed(3);}
      if(!e.ctrlKey&&!e.metaKey){const moved=[state.box[0]+dx,state.box[1]+dy,state.box[2]+dx,state.box[3]+dy],[sx,sy]=snapMove(moved,state.ids,api.doc().objects.filter(o=>state.ids.includes(o.id)&&o.kind==='path'&&Array.isArray(o.points)).flatMap(o=>o.points.map(q=>[q[0]+dx,q[1]+dy])));dx+=sx;dy+=sy;}
      state.delta=[dx,dy];setT(state.els,`translate(${dx} ${dy})`);overlay.setAttribute('transform',`translate(${dx} ${dy})`);previewMask(state.els,`translate(${dx} ${dy})`);drawSmart();return;}
    if(state.type==='marquee'||state.type==='nodemarquee'){const [x0,y0]=state.start,r=[Math.min(x0,q[0]),Math.min(y0,q[1]),Math.max(x0,q[0]),Math.max(y0,q[1])];state.rect=r;overlay.replaceChildren(el('rect',{class:'marquee',x:r[0],y:r[1],width:r[2]-r[0],height:r[3]-r[1]}));return;}
    if(state.type==='rotate'){const f=state.f;let a=Math.atan2(q[1]-f.c[1],q[0]-f.c[0])-state.a0;a=deg(a);if(e.shiftKey)a=Math.round(a/15)*15;a=((a+540)%360)-180;state.angle=a;const tr=`rotate(${a} ${f.c[0]} ${f.c[1]})`;setT(state.els,tr);previewMask(state.els,tr);overlay.setAttribute('transform',`rotate(${a} ${f.c[0]} ${f.c[1]})`);return;}
    if(state.type==='resize'){const f=state.f,n=state.name;smartLines=[];let p=api.snapOn()?api.snapPt(q):q;if(!f.oriented&&!e.ctrlKey&&!e.metaKey)p=snapPoint(p,state.ids);
      const l=toLocal(f,p),fx=n.includes('e')?1:n.includes('w')?0:.5,fy=n.includes('s')?1:n.includes('n')?0:.5,hx=(fx-.5)*f.W,hy=(fy-.5)*f.H;
      const alt=e.altKey,ax=alt?0:-hx,ay=alt?0:-hy;
      let sx=n==='n'||n==='s'?1:(l[0]-ax)/((hx-ax)||1),sy=n==='e'||n==='w'?1:(l[1]-ay)/((hy-ay)||1);sx=Math.max(.02,sx);sy=Math.max(.02,sy);
      if(e.shiftKey){const s=n==='n'||n==='s'?sy:n==='e'||n==='w'?sx:Math.max(sx,sy);sx=s;sy=s;}
      const A=toWorld(f,ax,ay);state.sx=sx;state.sy=sy;state.anchor=A;state.local=[ax,ay];
      const r=deg(f.rot),tr=f.rot?`translate(${A[0]} ${A[1]}) rotate(${r}) scale(${sx} ${sy}) rotate(${-r}) translate(${-A[0]} ${-A[1]})`:`translate(${A[0]} ${A[1]}) scale(${sx} ${sy}) translate(${-A[0]} ${-A[1]})`;setT(state.els,tr);previewMask(state.els,tr);
      refresh({...f,W:f.W*sx,H:f.H*sy,c:toWorld(f,ax+(-ax)*sx,ay+(-ay)*sy)},`${(f.W*sx).toFixed(1)} × ${(f.H*sy).toFixed(1)} mm`);overlay.querySelectorAll('.sel-handle').forEach(()=>{});}
  });
  window.addEventListener('pointerup',e=>{
    if(touches.delete(e.pointerId)&&state?.type==='pinch'&&touches.size<2){state=null;container.classList.remove('panning');}
    if(!state)return;const s=state;
    if(s.type==='pan'){state=null;container.classList.remove('panning');return;}
    if(e.pointerId!==s.pid)return;state=null;overlay.removeAttribute('transform');smartLines=[];container.classList.remove('deleting-guide');
    if(s.type==='guide'){overlay.querySelectorAll('.guide-preview').forEach(n=>n.remove());if(s.pos===undefined){refresh();return;}if(s.index===null){if(!s.out)api.commit([{op:'add_guide',axis:s.axis,pos:s.pos}]);else refresh();}else if(s.out)api.commit([{op:'remove_guide',index:s.index}]);else api.commit([{op:'move_guide',index:s.index,pos:s.pos}]);return;}
    if(s.type==='move'){restore(s.els);if(s.moved&&Math.hypot(...s.delta)>.02)api.commit([{op:'translate',ids:s.ids,dx:s.delta[0],dy:s.delta[1]}]);else{if(!s.moved&&api.ids().length>1&&!e.shiftKey&&s.wasSelected){const g=api.withGroup(s.clicked.id);api.select([...g],s.clicked.id);}else refresh();}return;}
    if(s.type==='marquee'){const r=s.rect;if(!r||(r[2]-r[0])*vp.s<4&&(r[3]-r[1])*vp.s<4){if(!s.add)api.select([],null);else refresh();return;}
      const picked=new Set(s.add?api.ids():[]);for(const o of api.doc().objects){if(o.visible===false||o.locked)continue;const b=objectBounds(o);if(b[2]>=r[0]&&b[0]<=r[2]&&b[3]>=r[1]&&b[1]<=r[3])for(const id of api.withGroup(o.id))picked.add(id);}
      api.select([...picked],[...picked].at(-1)??null);return;}
    if(s.type==='nodemarquee'){const r=s.rect;if(!r||(r[2]-r[0])*vp.s<4&&(r[3]-r[1])*vp.s<4){if(!s.add)api.select([],null);else refresh();return;}api.selectNodesIn(r,s.add);return;}
    if(s.type==='rotate'){restore(s.els);if(Math.abs(s.angle)>.05)api.commit([{op:'rotate',ids:s.ids,angle:s.angle,cx:s.f.c[0],cy:s.f.c[1]}]);else refresh();return;}
    if(s.type==='resize'){restore(s.els);if(!s.anchor||(Math.abs(s.sx-1)<1e-4&&Math.abs(s.sy-1)<1e-4)){refresh();return;}commitResize(s);}
  });
  window.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);if(state?.type==='pinch'){state=null;container.classList.remove('panning');return;}cancelState();});

  // ---- context menu ------------------------------------------------------------------------------------------
  function closeMenu(){menu?.remove();menu=null;}
  document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target))closeMenu();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  svg.addEventListener('contextmenu',e=>{
    if(api.tool()!=='select')return;e.preventDefault();const p=coord(e),o=hit(p);if(o&&!api.ids().includes(o.id))api.select([...api.withGroup(o.id)],o.id);
    const items=api.menuItems(o,p);if(!items.length)return;closeMenu();
    menu=document.createElement('div');menu.id='ctxMenu';menu.setAttribute('role','menu');
    for(const it of items){if(it==='-'){menu.append(document.createElement('hr'));continue;}const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.disabled=Boolean(it.disabled);b.innerHTML=`<span></span><kbd></kbd>`;b.firstChild.textContent=it.label;b.lastChild.textContent=it.key||'';b.onclick=()=>{closeMenu();it.run();};menu.append(b);}
    document.body.append(menu);const r=menu.getBoundingClientRect();menu.style.left=Math.min(e.clientX,innerWidth-r.width-8)+'px';menu.style.top=Math.min(e.clientY,innerHeight-r.height-8)+'px';menu.querySelector('button:not(:disabled)')?.focus();
  });

  api.zoomUi?.(zoomAt,fitHoop,fitAll,zoomTo100);
  return {vp,apply,refresh,fitHoop,fitAll,fitSelection,zoomAt,zoomTo100,toScreen,scale:()=>vp.s,percent:()=>Math.round(vp.s/PX_PER_MM*100),hit,closeMenu,isDragging:()=>Boolean(state),inField,RULER};
}
