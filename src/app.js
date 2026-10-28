import {documentNow,setDocument,settingsActions,documentActions} from './documentState.js';
import {setTransformFields,transformActions} from './transformState.js';
import {setReferenceFields,referenceActions} from './referenceFieldsState.js';
import {setHoopFields,hoopActions} from './hoopState.js';
import {setShortcutsOpen,shortcutsState} from './shortcutsState.js';
import {restoreActions,setRestore} from './restoreState.js';
import {setInspectorText} from './inspectorTextState.js';
import {setActions} from './actionState.js';
import {setSelectionLabels} from './selectionLabelsState.js';
import {letteringFieldsState,setLetteringFields,letteringActions} from './letteringFieldsState.js';
import {setStitchChoices,stitchChoiceActions,stitchChoicesState} from './stitchChoicesState.js';
import {setLayout} from './layoutState.js';
import {setCapRows,capRowsActions} from './capRowsState.js';
import {setBlingRows,blingRowsActions} from './blingRowsState.js';
import {setSatinEndRows,satinEndRowsActions} from './satinEndRowsState.js';
import {setRunRows,runRowsActions} from './runRowsState.js';
import {setAccordionRows,accordionRowsActions} from './accordionRowsState.js';
import {setTypeRows,typeRowsActions} from './typeRowsState.js';
import {setPathRows,pathRowsActions} from './pathRowsState.js';
import {pathDraftNow,setPathDraft,replaceAt} from './pathDraftState.js';
import {interactionNow,setInteraction} from './interactionState.js';
import {clipboardNow,setClipboard} from './clipboardState.js';
import {selState,setSelection} from './selectionState.js';
import {setStatus,statusActions} from './statusState.js';
import {setStitchRow,stitchRowsState} from './stitchRowsState.js';
import {alignState,alignActions} from './alignState.js';
import {selectionToolbarState,selectionToolbarActions} from './selectionToolbarState.js';
import {nodeButtonsState,nodeActions} from './nodeButtonsState.js';
import {knifeState} from './knifeState.js';
import {snapObjState,snapObjActions} from './snapObjState.js';
import {measureState} from './measureState.js';
import {pinState,pinActions,pinClearState,pinClearActions} from './pinState.js';
import {pivotState,pivotActions} from './pivotState.js';
import {toolMode,toolActions} from './toolMode.js';
import {viewMode,viewActions} from './viewMode.js';
import {dxfDocument,exportDxf} from './dxf.js';
import {t} from './i18n.js';
import {traceImage,traceOps,traceLines,traceLineOps} from './trace.js';
import {createAgentBridge} from './agent.js';
import {createThreadPreview} from './preview3d.js';
import {createCanvas} from './canvas.js';
import {getFont,registerFont,loadFont,isRegistryFont,documentFontIds,registerDocumentFonts} from './fonts.js';
import {createFontPicker,fetchFontIndex,LEGACY} from './fontui.js';
import {ttfToFont} from './ttf.js';
import {blockSeconds,blockTimeLabel,bundledFontUsage,countSmallHoles,isSmallIsland,isClosedShape,exportAppliqueTemplates,cornerRadii,svgPathFill,parseThreadStock,nearestStockThread,HOOP_PRESETS,customFontUsage,exportPrintTemplate,batchDocuments,batchPlan,designWarnings,TIP_CATEGORIES,visibleTips,measureBetween,widthAt,nodeFraction,initialDocument,geometry,applyOperations,validateDocument,measureText,parseSvgPath,makeStitchLayer,objectBounds,hoopSize,jefWarnings,exportSvg,textPrimitives,threadPlan,sewingSeconds,sewingWorksheet} from './engine.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],svgNS='http://www.w3.org/2000/svg';
const withSavedHoop=d=>{try{const h=JSON.parse(localStorage.getItem('welcome.hoop')||'null');if(h&&Number.isFinite(h.w)&&Number.isFinite(h.h)&&h.w>=10&&h.w<=400&&h.h>=10&&h.h<=400){d.hoop=h.w;if(h.h===h.w)delete d.hoopH;else d.hoopH=h.h;}}catch{}return d;};
setDocument({doc:withSavedHoop(initialDocument()),history:[],future:[],dirty:true});
let plan=null,worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),workerFailure=null,seq=0,generation=0,pending=new Map(),editMode=false,canvasView=null,collapsed=new Set(),snapOn=false,gridSize=1,playIndex=null,playbackTimer=null;
worker.onmessage=e=>{if(e.data.generation!==generation)return;const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.ok?p.resolve(e.data):p.reject(Error(e.data.error));};
function failPending(error){workerFailure??=error;for(const item of pending.values())item.reject(workerFailure);pending.clear();}
worker.addEventListener('error',e=>{e.preventDefault();failPending(Error(`Stitch worker failed to load or run${e.message?`: ${e.message}`:''}. Reload the editor and try again.`));});
worker.addEventListener('messageerror',()=>failPending(Error('The stitch worker returned data the editor could not read. Reload the editor and try again.')));
function request(data,transfer=[]){return new Promise((resolve,reject)=>{if(workerFailure){reject(workerFailure);return;}const id=++seq,version=generation;pending.set(id,{resolve,reject});try{worker.postMessage({id,generation:version,...data},transfer);}catch(error){pending.delete(id);reject(error);}});}
let lastPlan=null,compileError='',compileTimer=null,compiling=false;
function scheduleCompile(delay=450){clearTimeout(compileTimer);if(!documentNow().doc.objects.length||workerFailure){compileError='';return;}compileTimer=setTimeout(()=>compileNow(),delay);}
function clearComputed(){if(plan)lastPlan=plan;generation++;for(const item of pending.values())item.reject(new DOMException('The document changed.','AbortError'));pending.clear();if(playbackTimer)clearInterval(playbackTimer);playbackTimer=null;playIndex=null;plan=null;syncPlaybackControls();scheduleCompile();}
function clone(v){return structuredClone(v);}
function transact(fn){const before=clone(documentNow().doc),beforeSelected=selState().selected;try{fn();validateDocument(documentNow().doc);}catch(error){setDocument({doc:before});setSelection({selected: beforeSelected});render();toast(error.message);return false;}const current=documentNow(),nextHistory=[...current.history,before];if(nextHistory.length>80)nextHistory.shift();setDocument({doc:{...current.doc,revision:before.revision+1},history:nextHistory,future:[],dirty:true});clearComputed();render();if(viewMode.get()==='preview'&&documentNow().doc.objects.length)compileNow();return true;}
function edit(operations,after=()=>{}){return transact(()=>{applyOperations(documentNow().doc,operations);after();});}
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}
function selectedObject(){return documentNow().doc.objects.find(o=>o.id===selState().selected);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function syncPlaybackControls(){
 const button=$('#play'),playing=Boolean(playbackTimer);
 button.innerHTML=`<svg class="icon"><use href="#i-${playing?'pause':'play'}"/></svg>`;
 button.classList.toggle('playing',playing);
 button.setAttribute('aria-label',playing?'Pause stitch simulation':plan?'Play stitch simulation':'Compile and play stitch simulation');
 button.title=playing?'Pause stitch simulation':plan?'Play stitch simulation':'Compile and play stitch simulation';
 button.dataset.tooltip=playing?'Pause simulation':plan?'Play simulation':'Compile and play';
 const seek=$('#seek'),length=plan?.stitches.length||0,limit=playIndex===null?length:Math.min(playIndex,length);
 seek.max=String(Math.max(1,length));
 seek.value=String(playIndex===null?length:limit);
 if(!plan){setStatus({playback:'Ready to simulate',needle:''});seek.setAttribute('aria-valuetext','Ready to simulate');return;}
 if(playIndex===null){setStatus({playback:`Ready · ${plan.count.toLocaleString()} stitches`,needle:''});seek.setAttribute('aria-valuetext',`Ready to simulate ${plan.count} stitches`);return;}
 let sewn=0,current=null;for(let i=0;i<limit;i++){const item=plan.stitches[i];if(item.cmd==='stitch'){sewn++;current=item;}}
 const percent=length?Math.floor(limit/length*100):0;
 setStatus({playback:`${sewn.toLocaleString()} / ${plan.count.toLocaleString()} stitches · ${percent}%`,needle:current?`Needle ${current.x.toFixed(1)}, ${current.y.toFixed(1)} mm`:'Needle at start'});
 seek.setAttribute('aria-valuetext',`${sewn} of ${plan.count} stitches`);
}
// ---- fonts: bundled fonts load on demand; the document's own (loaded-from-file) fonts are registered from doc.customFonts
let fontIndex=[...LEGACY],newTextFont='welcome-mono/1';const fontLoading=new Set(),fontFailed=new Set();
const fetchJson=path=>fetch(new URL('../'+path,import.meta.url)).then(r=>{if(!r.ok)throw Error(`Font file ${path} could not be loaded (${r.status}).`);return r.json();});
const ensureFontLoaded=id=>(!isRegistryFont(id)||id.startsWith('custom/')||getFont(id))?Promise.resolve():loadFont(id,fetchJson);
async function ensureDocFonts(){registerDocumentFonts(documentNow().doc);await Promise.all(documentFontIds(documentNow().doc).map(ensureFontLoaded));}
function kickFontLoads(){registerDocumentFonts(documentNow().doc);for(const id of documentFontIds(documentNow().doc)){if(id.startsWith('custom/')||getFont(id)||fontLoading.has(id)||fontFailed.has(id))continue;fontLoading.add(id);ensureFontLoaded(id).then(()=>{fontLoading.delete(id);render();},()=>{fontLoading.delete(id);fontFailed.add(id);toast(`Font ${id} could not be loaded.`);});}}
function appendTextShapes(group,o){const prims=textPrimitives(o)||[],thread=o.thread,mk=(attrs)=>{const el=document.createElementNS(svgNS,'path');for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);group.append(el);};const d=(rings,close)=>rings.map(r=>'M'+r.map(p=>`${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')+(close?'Z':'')).join('');
  for(const p of prims){if(p.t==='f')mk({d:d(p.rings,true),fill:thread,'fill-opacity':'.85','fill-rule':'evenodd',stroke:'none'});else if(p.t==='s')mk({d:d([[...p.a,...[...p.b].reverse()]],true),fill:thread,'fill-opacity':'.7',stroke:'none'});else mk({d:d([p.pts],false),fill:'none',stroke:thread,'stroke-width':'.4','stroke-linecap':'round','stroke-linejoin':'round'});}}
const preview3d=createThreadPreview($('#preview3d'));let preview3dPlan=null;
function renderSimulation(){
 const root=$('#stitches');
 root.replaceChildren();
 const active=playIndex!==null,P=plan||(viewMode.get()==='stitches'&&!active&&lastPlan&&lastPlan.revision!==undefined?lastPlan:null),limit=P?(active?Math.min(playIndex,P.stitches.length):P.stitches.length):0;
 root.classList.toggle('stale',Boolean(P)&&!plan);
 let needle=null;
 if(P&&(viewMode.get()!=='design'||active)){const paths=new Map();let travel='',last=null,color=P.colors[0]||'#527461';for(let i=0;i<limit;i++){const item=P.stitches[i];if(item.cmd==='color'){color=item.thread||color;last={x:item.x,y:item.y};continue;}if(item.cmd==='jump'){if(last)travel+=`M${last.x},${last.y}L${item.x},${item.y}`;last=item;continue;}if(item.cmd==='trim'||item.cmd==='end') {last=null;continue;}if(item.cmd==='stop')continue;if(item.cmd==='stitch'){if(last){paths.set(color,(paths.get(color)||'')+`M${last.x},${last.y}L${item.x},${item.y}`);}last=item;needle=item;}}
  if(viewMode.get()==='preview'&&!active&&!preview3d.available){const layer=(cls,d,width,stroke,dx=0,dy=0)=>{const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);path.setAttribute('class',cls);path.setAttribute('stroke-width',width);if(stroke)path.style.stroke=stroke;if(dx||dy)path.setAttribute('transform',`translate(${dx} ${dy})`);return path;};for(const [,d] of paths)root.append(layer('thread-shadow',d,.5,null,.14,.2));for(const [thread,d] of paths){root.append(layer('thread-body',d,.4,thread));root.append(layer('thread-sheen',d,.1,null,-.07,-.09));}}
  else for(const [thread,d] of paths){const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);path.setAttribute('class','stitch-path');path.style.stroke=thread;root.append(path);}if(travel){const path=document.createElementNS(svgNS,'path');path.setAttribute('d',travel);path.setAttribute('class','stitch-path jump');root.append(path);}if(active&&needle){const marker=document.createElementNS(svgNS,'circle');marker.setAttribute('id','needleMarker');marker.setAttribute('cx',needle.x);marker.setAttribute('cy',needle.y);marker.setAttribute('r','1.2');root.append(marker);}}
 {const use3d=viewMode.get()==='preview'&&Boolean(plan)&&preview3d.available;if(use3d&&preview3dPlan!==plan){preview3d.setPlan(plan,hoopSize(documentNow().doc));preview3dPlan=plan;}if(use3d)preview3d.setLimit(active?playIndex:null);if(preview3d.available){preview3d.show(use3d);$('#previewHint').hidden=!use3d;$('#art').style.visibility=use3d?'hidden':'';$('#controls').style.display=use3d?'none':$('#controls').style.display;}}
 if(segReady){if(threadsReady)syncThreads();}if(typeof renderPlan==='function'&&threadsReady)renderPlan();
 window.__autosaveHook?.();
 renderReference();
 $('#shapes').style.opacity=viewMode.get()==='stitches'?.18:viewMode.get()==='preview'&&plan?0:viewMode.get()==='preview'?.55:1;
 $('#controls').style.display=viewMode.get()==='design'?'':'none';
 syncPlaybackControls();
}
function batchNameList(){return $('#batchNames').value.split('\n').map(v=>v.trim()).filter(Boolean);}
function updateBatchInfo(){const names=batchNameList(),copies=names.length||Math.max(1,Math.round(Number($('#arrCount').value))||1),p=batchPlan(documentNow().doc,{copies});$('#batchInfo').textContent=!p?'':p.perHoop?t('{perHoop} copies fit one {hoop} mm hoop ({cols} × {rows}). {copies} copies need {hoops} hoop(s).',{perHoop:p.perHoop,hoop:`${p.hoop[0]}×${p.hoop[1]}`,cols:p.cols,rows:p.rows,copies,hoops:p.hoopsNeeded}):t('The design does not fit in one hoop.');}
$('#batchNames').oninput=()=>updateBatchInfo();
$('#batchExport').onclick=async()=>{const names=batchNameList(),copies=names.length||Math.max(1,Math.round(Number($('#arrCount').value))||1);let docs;try{docs=batchDocuments(documentNow().doc,{copies,names:names.length?names:null});}catch(error){toast(error.message);return;}if(!docs.length){toast(t('The design does not fit in one hoop.'));return;}await ensureDocFonts().catch(()=>{});const format=$('#batchFormat').value,base=safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,''),color=selectedObject()?.thread||'#527461';for(const [i,d] of docs.entries()){const result=await request({type:'export',document:forWorker(d),format,color});download(result.bytes,`${base}-hoop${i+1}.${format==='pes6'?'pes':format}`,'application/octet-stream');}toast(t('{n} {fmt} files exported, one per hoop.',{n:docs.length,fmt:format.toUpperCase()}));};
function render(){updateBatchInfo();
 kickFontLoads();
 if(selState().selected&&!documentNow().doc.objects.some(o=>o.id===selState().selected))setSelection({selected: null});
 setSelection({multi: new Set([...selState().multi].filter(id=>documentNow().doc.objects.some(o=>o.id===id)))});
 if(selState().selected&&!selState().multi.has(selState().selected))setSelection({multi: new Set([selState().selected])});
 else if(!selState().selected&&selState().multi.size)setSelection({selected: [...selState().multi][0]});
 if(selState().selNode!==null&&!(selectedObject()?.points?.[selState().selNode]))setSelection({selNode: null});
 {const pts=selectedObject()?.points;setSelection({selNodes: new Set([...selState().selNodes].filter(i=>pts?.[i]))});}
 
 $('#snap').classList.toggle('active-tool',snapOn);
 $('.canvas').classList.toggle('snapping',snapOn);
 const nMulti=selState().multi.size;
 alignState.set({align:!(nMulti>=2||nMulti===1),distribute:nMulti<3});
 {const picked=[...selState().multi].map(id=>documentNow().doc.objects.find(o=>o.id===id)).filter(Boolean);setActions({textOnPath:!(picked.length===2&&picked.some(o=>o.kind==='text')&&picked.some(o=>o.kind==='path'))});setActions({textOffPath:!picked.some(o=>o.along)});}
 selectionToolbarState.set({...selectionToolbarState.get(),subtract:nMulti<2,union:nMulti<2,intersect:nMulti<2});
 setActions({group:nMulti<2});
 setActions({ungroup:![...selState().multi].some(id=>documentNow().doc.objects.find(o=>o.id===id)?.groupId)});
 setActions({editNodes:selState().multi.size!==1||selectedObject()?.kind==='stitch_layer'});
 $('#editNodes').classList.toggle('active-tool',editMode);
 selectionToolbarState.set({...selectionToolbarState.get(),flip:!selState().multi.size});
 nodeButtonsState.set({add:selectedObject()?.kind!=='path',del:selState().selNode===null,smooth:selState().selNode===null,corner:selState().selNode===null||!selectedObject()?.handles?.[selState().selNode]});
 document.querySelector('.canvas').classList.toggle('preview-mode',viewMode.get()==='preview');
 document.querySelector('.layout main').classList.toggle('design-view',viewMode.get()==='design');
 setActions({undo:!documentNow().history.length});
 setActions({redo:!documentNow().future.length});
 setActions({duplicate:!selState().selected});
 $('#remove').disabled=!selState().selected;
 const hoop=hoopSize(documentNow().doc);
 const setRect=(id,w,h,rx)=>{const r=$(id);r.setAttribute('x',-w/2);r.setAttribute('y',-h/2);r.setAttribute('width',w);r.setAttribute('height',h);r.setAttribute('rx',rx);};
 setRect('#hoopOuter',hoop.w+8,hoop.h+8,7);
 setRect('#hoopRing',hoop.w,hoop.h,4);
 setRect('#hoopLinen',hoop.w-2.4,hoop.h-2.4,3);
 setHoopFields({hoopW:String(hoop.w),hoopH:String(hoop.h),preset:HOOP_PRESETS.some(p=>p.w===hoop.w&&p.h===hoop.h)?`${hoop.w}x${hoop.h}`:'custom'});
 renderLayers();
 const g=$('#shapes');
 g.replaceChildren();
 const defs=document.createElementNS(svgNS,'defs'),clipDone=new Set();
 g.append(defs);
 for(const o of documentNow().doc.objects){const element=document.createElementNS(svgNS,o.kind==='text'||o.kind==='stitch_layer'?'g':o.kind==='ellipse'?'ellipse':o.kind==='path'?(o.holes?.length?'path':'polyline'):(Array.isArray(o.radii)?'path':'rect'));element.classList.add('shape');element.dataset.id=o.id;if(o.clipId){const m=documentNow().doc.objects.find(v=>v.id===o.clipId);if(m){if(!clipDone.has(m.id)){clipDone.add(m.id);const cp=document.createElementNS(svgNS,'clipPath');cp.setAttribute('id','clip-'+m.id);const pa=document.createElementNS(svgNS,'path');pa.setAttribute('d',geometry(m,0).map(r=>'M'+r.map(q=>q.join(',')).join('L')+'Z').join(''));pa.setAttribute('clip-rule','evenodd');cp.append(pa);defs.append(cp);}element.setAttribute('clip-path',`url(#clip-${m.id})`);}}
  if(o.photo){const pat=document.createElementNS(svgNS,'pattern');pat.setAttribute('id','photo-'+o.id);pat.setAttribute('patternUnits','userSpaceOnUse');pat.setAttribute('x',o.x);pat.setAttribute('y',o.y);pat.setAttribute('width',o.w);pat.setAttribute('height',o.h);const im=document.createElementNS(svgNS,'image');im.setAttribute('href',photoUrl(o.photo));im.setAttribute('width',o.w);im.setAttribute('height',o.h);im.setAttribute('preserveAspectRatio','none');pat.append(im);defs.append(pat);element.dataset.gradient='photo-'+o.id;}
  if((o.blendThread||o.blendPalette)&&o.stitch==='fill'&&o.kind!=='text'){const a=((o.blendAngle!==undefined?o.blendAngle-90:(o.angle??documentNow().doc.settings.angle))||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2,L=Math.abs(o.w*sn)+Math.abs(o.h*c)||1,lg=document.createElementNS(svgNS,'linearGradient');lg.setAttribute('id','blend-'+o.id);lg.setAttribute('gradientUnits','userSpaceOnUse');lg.setAttribute('x1',cx+sn*L/2);lg.setAttribute('y1',cy-c*L/2);lg.setAttribute('x2',cx-sn*L/2);lg.setAttribute('y2',cy+c*L/2);let s0=o.blendStart??0,s1=o.blendEnd??1,c0=o.thread,c1=o.blendThread;if(s0>s1){[s0,s1]=[s1,s0];[c0,c1]=[c1,c0];}const pal=o.blendPalette,palN=pal?.length,stops=pal?[[0,pal[0]],...pal.map((c,k)=>[(o.blendStart??0)+((o.blendEnd??1)-(o.blendStart??0))*k/(palN-1),c]),[1,pal[palN-1]]]:[[0,c0],[s0,c0],[s1,c1],[1,c1]];for(const [off,col] of stops){const st=document.createElementNS(svgNS,'stop');st.setAttribute('offset',off);st.setAttribute('stop-color',col);lg.append(st);}defs.append(lg);element.dataset.gradient='blend-'+o.id;}element.setAttribute('fill',o.stitch==='run'||(o.kind==='path'&&!(o.closed&&o.stitch==='fill'))||o.kind==='text'||o.kind==='stitch_layer'?'none':o.thread);
  if(element.dataset.gradient)element.setAttribute('fill',`url(#${element.dataset.gradient})`);
  if(o.mask){element.classList.add('mask-shape');element.setAttribute('fill','none');}if(o.kind==='path'&&o.closed&&o.stitch==='fill')element.setAttribute('fill-opacity','.85');
  element.setAttribute('stroke',o.thread);
  element.setAttribute('stroke-width','.45');
  if(o.kind==='stitch_layer'){
   const [x0,y0,x1,y1]=o.source.bounds,sx=o.w/Math.max(.1,x1-x0),sy=o.h/Math.max(.1,y1-y0),a=(o.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2,coords=st=>{const lx=(st.x-(x0+x1)/2)*sx,ly=(st.y-(y0+y1)/2)*sy;return [cx+lx*c-ly*s,cy+lx*s+ly*c];};
   let paths=new Map(),travel='',previous=null;
   for(const st of o.stitches){const p=coords(st);if(st.cmd==='jump'){if(previous)travel+=`M${previous[0]} ${previous[1]}L${p[0]} ${p[1]}`;previous=p;continue;}if(st.cmd==='trim'||st.cmd==='end'){previous=null;continue;}if(st.cmd==='stitch'){const col=o.threadOverrides[st.thread]||o.threads[st.thread].color||o.thread;if(!paths.has(col))paths.set(col,'');paths.set(col,paths.get(col)+(previous?`M${previous[0]} ${previous[1]}L${p[0]} ${p[1]}`:`M${p[0]} ${p[1]}`));previous=p;}}
   for(const [col,d] of paths){const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',col);path.setAttribute('stroke-width','.32');element.append(path);}if(travel){const jumps=document.createElementNS(svgNS,'path');jumps.setAttribute('d',travel);jumps.setAttribute('fill','none');jumps.setAttribute('stroke','#909992');jumps.setAttribute('stroke-width','.2');jumps.setAttribute('stroke-dasharray','.7 .7');element.append(jumps);}
  }else if(o.kind==='text'&&isRegistryFont(o.font)){appendTextShapes(element,o);
  }else if(o.kind==='text'){for(const line of geometry(o)){const p=document.createElementNS(svgNS,'polyline');p.setAttribute('points',line.map(pt=>pt.join(',')).join(' '));element.append(p);}}else if(o.kind==='ellipse'){element.setAttribute('cx',o.x+o.w/2);
  element.setAttribute('cy',o.y+o.h/2);
  element.setAttribute('rx',o.w/2);
  element.setAttribute('ry',o.h/2);
  }else if(o.kind==='path'&&o.holes?.length){element.setAttribute('d',geometry(o).map(r=>'M'+r.map(p=>p.join(' ')).join('L')+'Z').join(''));
  element.setAttribute('fill-rule','evenodd');
  }else if(o.kind==='path'){element.setAttribute('points',geometry(o)[0].map(p=>p.join(',')).join(' '));
  }else if(o.kind==='rect'&&Array.isArray(o.radii)){element.setAttribute('d','M'+geometry(o)[0].map(p=>p.join(' ')).join('L')+'Z');
  }else{element.setAttribute('x',o.x);
  element.setAttribute('y',o.y);
  element.setAttribute('width',o.w);
  element.setAttribute('height',o.h);
  element.setAttribute('rx',Math.min(o.radius||0,o.w/2,o.h/2));
  }if(o.rotation&&o.kind!=='path'&&o.kind!=='text'&&o.kind!=='stitch_layer')element.setAttribute('transform',`rotate(${o.rotation} ${o.x+o.w/2} ${o.y+o.h/2})`);if(o.stitch==='satin'&&o.kind==='path'){element.style.strokeWidth=String(o.satinWidth??3);
  element.style.strokeOpacity='.55';
  element.setAttribute('stroke-linejoin','round');
  element.style.strokeLinecap='butt';
  }if(o.id===selState().selected)element.classList.add('selected');else if(selState().multi.has(o.id))element.classList.add('multi');if(o.border&&o.stitch==='fill'){element.setAttribute('stroke',o.borderThread||o.thread);
  element.style.strokeWidth='.9';
  }g.append(element);}
drawControls();const o=selectedObject();setInspectorText({heading:o?.name||'Select an object'});$('#sourceInfo').hidden=o?.kind!=='stitch_layer';
$('#sourceInfo').innerHTML=o?.kind==='stitch_layer'?`<strong>${esc(o.source.format.toUpperCase())} stitch layer</strong>${o.source.metadata?`<br>${esc([o.source.metadata.name,o.source.metadata.author?t('by {author}',{author:o.source.metadata.author}):''].filter(Boolean).join(' · '))}`:''}<br>${o.stitches.length.toLocaleString()} commands · ${o.threads.length} source threads<br>${esc(o.source.fileName)} · ${(o.source.size/1024).toFixed(1)} KiB<br>Source bounds ${o.source.bounds.map(v=>v.toFixed(1)).join(' × ')} mm<br>${o.source.warnings.length?`<em>${o.source.warnings.map(esc).join('<br>')}</em>`:''}`:'';
if(o){setStitchChoices({type:['run','satin','motif','sequin','bead','bling'].includes(o.stitch)?o.stitch:'fill'});setStitchRow('satinRow',o.stitch!=='satin');setTypeRows({satinWidth:String(o.satinWidth??3)});setStitchChoices({satinOff:o.kind!=='path'});setStitchChoices({typeDisabled:o.kind==='stitch_layer'});const thread=$('#thread');if(![...thread.options].some(v=>v.value.toLowerCase()===o.thread.toLowerCase())){const opt=document.createElement('option');opt.value=o.thread;opt.textContent=o.kind==='stitch_layer'?'Imported · replace all':'Custom';thread.append(opt);}thread.value=o.thread;$('#spacing').value=o.spacing??documentNow().doc.settings.spacing;$('#angle').value=o.angle??documentNow().doc.settings.angle;setStitchRow('fillReset',['spacing','angle','stitchLength','stagger','underlayType','underlayInset','underlaySpacing'].every(k=>o[k]===undefined));$('#underlay').checked=documentNow().doc.settings.underlay;{const isPath=o.kind==='path',canFill=o.kind==='text'?getFont(o.font)?.kind==='outline':(o.kind!=='path'||o.closed);
setStitchRow('pathProps',!isPath);setPathRows({closed:Boolean(o.closed),smooth:Boolean(o.smooth),disabled:!isPath});setStitchChoices({fillOff:!canFill});$('#border').checked=Boolean(o.border);
$('#border').disabled=!(canFill&&o.stitch==='fill');const bt=$('#borderThread');bt.disabled=$('#border').disabled||(!o.border&&!o.applique);
const bv=o.borderThread||o.thread;
if(![...bt.options].some(v=>v.value.toLowerCase()===bv.toLowerCase())){const opt=document.createElement('option');opt.value=bv;opt.textContent='Custom';bt.append(opt);}bt.value=bv;
}$('#comp').value=documentNow().doc.settings.compensation;$('#fabric').value=documentNow().doc.settings.fabric??'woven';setTransformFields({posX:Number(o.x).toFixed(1),posY:Number(o.y).toFixed(1),sizeW:Number(o.w||0).toFixed(1),sizeH:Number(o.h||0).toFixed(1),rotation:String(Number(o.rotation||0))});
setStitchRow('alongRow',!o.along);setLetteringFields({alongOffset:String(o.along?.offset??0)});syncTextInspector(o);}else{syncTextInspector(null);
$('#spacing').value=documentNow().doc.settings.spacing;$('#angle').value=documentNow().doc.settings.angle;setStitchRow('fillReset',true);
setStitchRow('alongRow',true);
setStitchRow('satinRow',true);setStitchChoices({typeDisabled:false});setStitchRow('pathProps',true);$('#border').disabled=true;$('#borderThread').disabled=true;}
 
 setStatus({count:compileError?`⚠ Can't compile: ${compileError}`:plan?`${t('{n} stitches',{n:plan.count.toLocaleString()})} · ${plan.errors.length?plan.errors[0]:t('compiled')}`:documentNow().doc.objects.length?'Compiling…':'Nothing to sew yet'});
 setStatus({countError:Boolean(compileError)||Boolean(plan?.errors.length)});
 {const errs=plan?.issues||[],tips=sewingTips();setStatus({issuesHidden:errs.length+tips.length===0,issuesText:`⚠ ${[errs.length?t(errs.length===1?'1 issue':'{n} issues',{n:errs.length}):'',tips.length?t(tips.length===1?'1 sewing tip':'{n} sewing tips',{n:tips.length}):''].filter(Boolean).join(' · ')}`,issuesTitle:[...errs,...tips].map(i=>t(i.message)).join('\n')});renderSewTips(tips);}setInspectorText({summary:plan?t('{n} stitches · {m} m estimated thread · {c} thread colors',{n:plan.count.toLocaleString(),m:(plan.threadLength/1000).toFixed(1),c:plan.colors.length})+' · '+t('about {t} to sew',{t:sewTime(plan)})+(plan.errors.length?' · '+plan.errors.join(' '):''):'No generated stitches.'});
 syncSections();
 renderSimulation();
 canvasView?.refresh();
}
// Only the controls that apply to the current selection are shown (lettering for lettering, path tools for shapes and paths, ...).
function syncSections(){
 const picked=documentNow().doc.objects.filter(o=>selState().multi.has(o.id)),n=picked.length,o=selectedObject(),kind=o?.kind;
 const only=k=>n>=1&&picked.every(v=>v.kind===k),onlyAny=ks=>n>=1&&picked.every(v=>ks.includes(v.kind)),fillable=picked.some(v=>v.stitch==='fill'&&(v.kind==='rect'||v.kind==='ellipse'||(v.kind==='path'&&v.closed)||(v.kind==='text'&&getFont(v.font)?.kind==='outline')));
 setLayout({secTransform:!(n>=1)});
 setLayout({secStitch:false});
 setLayout({secText:!(n===1&&kind==='text')});
 setLayout({secPath:!picked.some(v=>['rect','ellipse','path'].includes(v.kind))});
 setLayout({secArray:!(n>=1)});
 setLayout({secOrder:!(n>=1)});
 setSelectionLabels({hintHidden:n>=1});
 setSelectionLabels({stitchTitle:n?'Stitching':'Fill defaults for new objects'});
 setLayout({typeHidden:n===0||onlyAny(['text','stitch_layer'])});setLayout({threadHidden:n===0});if(n===0)setStitchRow('satinRow',true);
 {const lettered=picked.some(v=>v.kind==='text'&&isRegistryFont(v.font));setLayout({spacingHidden:!(n===0||fillable||lettered||picked.some(v=>v.stitch==='satin')),spacingLabel:lettered&&!fillable?'Stitch spacing (mm) · lower = denser':'Row spacing (mm)'});}setLayout({angleHidden:!(n===0||fillable)});
 {const src=o||{},st=documentNow().doc.settings,satinish=picked.some(v=>v.stitch==='satin'||(v.kind==='text'&&getFont(v.font)?.kind==='stitch')),underlayable=n===0||fillable||satinish;
  const set=(id,v)=>{if(document.activeElement!==$(id))$(id).value=v;};
  set('#stitchLength',src.stitchLength??st.stitchLength??3);
  $('#stagger').value=String(src.stagger??st.stagger??4);
  const fillTypes=[['auto','Auto (by size)'],['none','None'],['contour','Edge walk'],['fill','Tatami (90°)'],['laydown','Laydown (wide rows)'],['contour+fill','Edge walk + tatami']],satinTypes=[['auto','Auto (by width)'],['none','None'],['center','Centre run'],['contour','Edge walk'],['zigzag','Zigzag'],['center+zigzag','Centre + zigzag'],['contour+zigzag','Edge walk + zigzag']];
  const types=satinish&&!fillable?satinTypes:fillTypes,sel=$('#underlayType'),want=types.map(t=>t[0]).join();
  if(sel.dataset.set!==want){sel.replaceChildren(...types.map(([v,l])=>{const op=document.createElement('option');op.value=v;op.textContent=l;return op;}));sel.dataset.set=want;}
  const cur=src.underlayType??(st.underlay===false?'none':(st.underlayType??'auto'));sel.value=types.some(t=>t[0]===cur)?cur:'auto';
  set('#underlayInset',src.underlayInset??.4);set('#underlaySpacing',src.underlaySpacing??(satinish&&!fillable?2:2.2));
  const showDetails=underlayable&&!['none','auto',undefined].includes(sel.value);
  {const one=n===1&&o&&o.kind!=='text'&&o.kind!=='stitch_layer'&&(fillable||o.stitch==='satin');
setStitchRow('pinRow',!one);if(!one)pinState.set(null);pinClearState.set(Boolean(o&&(o.startAt||o.endAt)));}
  {const rectOnly=n===1&&o?.kind==='rect';setStitchRow('radiusRow',!rectOnly);if(rectOnly&&document.activeElement!==$('#radius'))$('#radius').value=o.radius??0;if(rectOnly){const rr=cornerRadii(o);[['TL',0],['TR',1],['BR',2],['BL',3]].forEach(([k,i])=>{const el=$('#radius'+k);if(document.activeElement!==el)el.value=rr[i];});}
  const taper=n===1&&o?.kind==='path'&&(o.stitch==='satin'||(o.stitch==='motif'&&o.motifPair));
setStitchRow('satinEndRow',!taper);if(taper)setSatinEndRows({satinWidthEnd:String(o.satinWidthEnd??'')});
$('#satinRaised').checked=Boolean(o?.raised);$('#satinButtonhole').checked=Boolean(o?.buttonhole);setBlingRows({motifPair:Boolean(o?.motifPair)});
setStitchRow('motifPairRow',o?.stitch!=='motif');
{const motifish=['motif','sequin','bead','bling'].includes(o?.stitch)||['motif','sequin','bling'].includes(o?.fillMethod),sequin=o?.stitch==='sequin',bead=o?.stitch==='bead',blingLike=o?.stitch==='bling'||o?.fillMethod==='bling';setStitchRow('motifSpacingRow',!motifish);
setStitchRow('motifSizeRow',!motifish);setTypeRows({motifSpacing:String(o?.motifSpacing??(sequin||o?.fillMethod==='sequin'||blingLike?8:bead?6:4))});
setTypeRows({motifSize:String(o?.motifSize??(sequin||o?.fillMethod==='sequin'?3:bead?2:blingLike?4:1.6))});
setStitchRow('motifShapeRow',o?.stitch!=='motif');
setStitchRow('edgeCloseRow',!(o?.clipId&&['run','satin'].includes(o?.stitch)));$('#edgeClose').checked=Boolean(o?.edgeClose);
$('#motifShape').value=o?.motifShape??'circle';setStitchRow('blingShapeRow',!(o?.stitch==='bling'||o?.fillMethod==='bling'));
setStitchRow('sequinTwinRow',o?.stitch!=='sequin');setBlingRows({sequinTwin:o?.sequinTwin===true});
setStitchRow('stoneTurnRow',!(o?.stitch==='bling'&&['square','hexagon','star','baguette','marquise','pear','cushion','oval','heart','teardrop'].includes(o?.blingShape??'round')));
setBlingRows({stoneTurn:o?.stoneTurn!==false});setStitchRow('blingRingsRow',!(o?.stitch==='bling'||o?.fillMethod==='bling'));
setStitchRow('beadShapeRow',o?.stitch!=='bead');setBlingRows({beadShape:o?.beadShape??'dash'});setStitchRow('beadTwinRow',o?.stitch!=='bead');
setBlingRows({beadTwin:o?.beadTwin===true});setBlingRows({blingRings:String(o?.blingRings??2)});setBlingRows({blingShape:o?.blingShape??'round'});
const motifAlong=n===1&&o?.kind==='path'&&o?.stitch==='motif';
setStitchRow('motifWarpRow',!(motifAlong||n===1&&o?.kind!=='text'&&o?.kind!=='stitch_layer'&&o?.fillMethod==='motif'));
for(const opt of $('#motifWarp').options)opt.disabled=opt.value==='along'?!motifAlong:opt.value!=='none'&&motifAlong;
$('#motifWarp').value=o?.motifWarp??'none';
}setStitchRow('satinButtonholeRow',o?.stitch!=='satin'||o?.kind!=='path'||o?.closed);
setStitchRow('satinRaisedRow',o?.stitch!=='satin');
setStitchRow('fillRaisedRow',!(n===1&&o?.stitch==='fill'&&o?.kind!=='text'));$('#fillRaised').checked=Boolean(o?.raised);
setStitchRow('raisedSpacingRow',!(n===1&&o?.stitch==='fill'&&o?.kind!=='text'&&o?.raised));
if(o&&document.activeElement!==$('#raisedSpacing'))$('#raisedSpacing').value=o.raisedSpacing??'';
setStitchRow('raisedAngleRow',stitchRowsState.get().raisedSpacingRow);
setStitchRow('laydownSpacingRow',!(n===1&&o?.stitch==='fill'&&String(o?.underlayType??'').includes('laydown')));
if(o)setRunRows({laydownSpacing:String(o.laydownSpacing??'')});
if(o&&document.activeElement!==$('#raisedAngle'))$('#raisedAngle').value=o.raisedAngle??'';
const bordered=picked.length>0&&picked.every(v=>v.border)&&fillable;setStitchRow('borderWidthRow',!bordered);
if(bordered&&document.activeElement!==$('#borderWidth'))$('#borderWidth').value=o?.borderWidth??0;
  const fp=$('#followPath');
  if(n===1&&o?.kind==='text'){const paths=documentNow().doc.objects.filter(v=>v.kind==='path'),want=['',...paths.map(v=>v.id)].join('|')+(o.along&&!o.along.pathId?'|custom':'');if(fp.dataset.set!==want){fp.replaceChildren(new Option(t('Not on a path'),''),...paths.map(v=>new Option(v.name||v.id,v.id)));if(o.along&&!o.along.pathId)fp.append(new Option(t('Custom path'),'__custom'));fp.dataset.set=want;}fp.value=o.along?(o.along.pathId||'__custom'):'';}}
  {const method=o?.fillMethod||'rows',single=n===1&&o&&o.kind!=='text'&&o.kind!=='stitch_layer',runPick=single&&o.stitch==='run';
  setStitchRow('crossRow',!(single&&fillable&&method==='cross'));if(o)setAccordionRows({crossSize:String(o.crossSize??2.5)});
setStitchRow('runStyleRow',!runPick);if(o)setStitchChoices({runStyle:o.runStyle||'single'});setStitchRow('stemWidthRow',!(runPick&&o?.runStyle==='stem'));
if(o)setRunRows({stemWidth:String(o.stemWidth??'')});
setStitchRow('varianceRow',!(single&&fillable&&['rows','guided'].includes(method)));
if(o)setRunRows({lengthVariance:String(Math.round((o.lengthVariance??0)*100))});
  setStitchRow('appliqueRow',!(single&&fillable));setCapRows({applique:Boolean(o?.applique)});
setStitchRow('appliqueWidthRow',!(single&&fillable&&o.applique));
if(o)setCapRows({appliqueWidth:String(o.appliqueWidth??2.5)});
  setStitchRow('compRow',!(single&&(fillable||o.stitch==='satin')));
setStitchRow('pullRightRow',!(single&&o.kind==='path'&&o.stitch==='satin'));
setStitchRow('pullLeftRow',stitchRowsState.get().pullRightRow);
setStitchRow('endInsetStartRow',!(single&&o?.kind==='path'&&o?.stitch==='satin'));
setStitchRow('endInsetEndRow',!(single&&o?.kind==='path'&&o?.stitch==='satin'));
if(o)setSatinEndRows({endInsetStart:String(o.endInsetStart??o.endInset??''),endInsetEnd:String(o.endInsetEnd??o.endInset??''),pullRight:String(o.pullRight??''),pullLeft:String(o.pullLeft??'')});
if(o)setCapRows({compensation:String(o.compensation??'')});}
  {const single2=n===1&&o&&o.kind!=='text'&&o.kind!=='stitch_layer';setStitchRow('pinCenter',!(single2&&fillable&&o.fillMethod==='ripple'));
setStitchRow('underpathRow',!(single2&&fillable&&!o.photo&&!o.applique&&['rows',undefined].includes(o.fillMethod)));
setRunRows({underpath:o?.underpath!==false});
  setStitchRow('maskRow',!(n===1&&o?.clipId));
  const ph=n===1&&o?.photo;
  setStitchRow('photoBox',!ph);
  if(ph){if(document.activeElement!==$('#photoSpacing'))$('#photoSpacing').value=o.photo.spacing??.7;if(document.activeElement!==$('#photoContrast'))$('#photoContrast').value=o.photo.contrast??1.4;$('#photoInvert').checked=Boolean(o.photo.invert);$('#photoThread2').value=o.photo.thread2||'';$('#photoThread3').value=o.photo.thread3||'';setStitchRow('photoThread3Row',!o.photo.thread2);$('#photoThread4').value=o.photo.thread4||'';setStitchRow('photoThread4Row',!o.photo.thread3);}}
  {const satinPath=n===1&&o?.kind==='path'&&o.stitch==='satin',bw=Number(o?.borderWidth)>0&&picked.every(v=>v.border);
  setStitchRow('capRow',!satinPath&&!(n===1&&o?.kind==='path'&&o.stitch==='run'&&false));setStitchRow('joinRow',!(satinPath||(n>=1&&bw&&fillable)));
  if(o){setStitchChoices({cap:o.cap||'butt',join:o.join||'round'});}
const nw=satinPath&&selState().selNode!==null&&selState().selNode<o.points.length;setStitchRow('nodeWidthRow',!nw);
if(nw)setCapRows({nodeWidth:widthAt(o,nodeFraction(o,selState().selNode)).toFixed(1)});
  setStitchRow('widthClearRow',!(satinPath&&o.widthStops));
  const blendable=n===1&&o&&fillable&&o.kind!=='text'&&o.kind!=='stitch_layer'&&!o.photo;
  setStitchRow('blendRow',!blendable);
  if(blendable){$('#blendThread').value=o.blendThread||'';setStitchRow('blendRange',!(o.blendThread||o.blendPalette));for(let k=0;k<4;k++){const s=$('#blendPalette'+k),v=o.blendPalette?.[k]||'';if(v&&![...s.options].some(x=>x.value.toLowerCase()===v.toLowerCase()))s.append(new Option(threadName(v),v));s.value=v;}if(document.activeElement!==$('#blendAngle'))$('#blendAngle').value=o.blendAngle??'';if(document.activeElement!==$('#blendStart'))$('#blendStart').value=Math.round((o.blendStart??0)*100);if(document.activeElement!==$('#blendEnd'))$('#blendEnd').value=Math.round((o.blendEnd??1)*100);}
  const ordered=[...selState().multi].map(id=>documentNow().doc.objects.find(v=>v.id===id)).filter(Boolean).sort((a,b)=>documentNow().doc.objects.indexOf(a)-documentNow().doc.objects.indexOf(b)),top=ordered.at(-1);
  setActions({clip:!(ordered.length>=2&&top&&(top.kind==='rect'||top.kind==='ellipse'||(top.kind==='path'&&top.closed)))});
  setActions({unclip:!ordered.some(v=>v.clipId||v.mask)});
  }
  {const m=['contour','spiral','meander','guided','cross','ripple','motif','sequin','bling'].includes(src.fillMethod)?src.fillMethod:'rows';setStitchChoices({fillMethod:m});setStitchRow('methodRow',!fillable||n===0);
setStitchRow('accordionStartRow',!(n===1&&fillable&&m==='rows'));
setStitchRow('accordionEndRow',!(n===1&&fillable&&m==='rows'));
setStitchRow('accordionEaseRow',!(n===1&&fillable&&m==='rows'));if(o)setAccordionRows({accordionEase:String(o.accordionEase??'linear')});
if(o)setAccordionRows({accordionStart:String(o.accordionStart??'')});
if(o)setAccordionRows({accordionEnd:String(o.accordionEnd??'')});const g=n===1&&fillable&&m==='guided';setStitchRow('guideRow',!g);
if(!g)setInteraction({guideDraft: null});$('#guideDraw').textContent=t(interactionNow().guideDraft?'Finish guide':'Draw guide');$('#guideDraw').classList.toggle('armed',!!interactionNow().guideDraft);
$('#guideClear').disabled=!o?.guide;$('#angle').closest('label').hidden=!(n===0||(fillable&&(m==='rows')));}
setStitchRow('stitchLenRow',!(n===0||fillable||(n===1&&o?.stitch==='run'&&o.kind!=='text'&&o.kind!=='stitch_layer')));
{const mm=src.fillMethod||'rows';setStitchRow('staggerRow',!(n===0||(fillable&&['rows','guided'].includes(mm))));}setStitchRow('underlayRow',!underlayable);
setStitchRow('underlayDetails',!showDetails);}
 setLayout({borderHidden:!fillable,borderThreadHidden:!fillable});if(n===0||only('stitch_layer'))setStitchRow('pathProps',true);
 setInspectorText({heading:n>1?`${n} objects selected`:(o?.name||'Select an object')});
 for(const [id,kinds] of [['#offsetBtn',['rect','ellipse','path']],['#strokeBtn',['path']],['#simpBtn',['path']],['#reverseBtn',['path']],['#splitBtn',['path']],['#joinBtn',['path']]])$(id).disabled=!picked.some(v=>kinds.includes(v.kind));
}
// Nodes and Bézier handles of the path being edited (edit mode). Sizes are in screen pixels, so they stay constant while zooming.
const px=n=>n/(canvasView?.scale()||7);
function drawControls(){
 const controls=$('#controls');controls.replaceChildren();const selectedPath=selectedObject();
 {const o=selectedObject();if(o&&selState().multi.size<=1&&o.kind!=='text'&&o.kind!=='stitch_layer'){const b=objectBounds(o),gl=interactionNow().guideDraft||(o.fillMethod==='guided'?o.guide:null);if(gl&&gl.length>=1){const l=document.createElementNS(svgNS,'polyline');l.setAttribute('class','guide-line');l.setAttribute('points',gl.map(f=>`${b[0]+f[0]*(b[2]-b[0])},${b[1]+f[1]*(b[3]-b[1])}`).join(' '));controls.append(l);}for(const [key,cls] of [['startAt','start'],['endAt','end'],['rippleCenter','center']]){const f=o[key];if(!f)continue;const c=document.createElementNS(svgNS,'circle');c.setAttribute('class','pin '+cls);c.setAttribute('cx',b[0]+f[0]*(b[2]-b[0]));c.setAttribute('cy',b[1]+f[1]*(b[3]-b[1]));c.setAttribute('r',px(5));const t=document.createElementNS(svgNS,'title');t.textContent=key==='startAt'?'Start point':key==='endAt'?'End point':'Ripple centre';c.append(t);controls.append(c);}}}
 if(!editMode||selectedPath?.kind!=='path'||selState().multi.size!==1)return;
 selectedPath.points.forEach(([x,y],index)=>{const node=document.createElementNS(svgNS,'circle');node.setAttribute('class','path-node');node.setAttribute('cx',x);node.setAttribute('cy',y);node.setAttribute('r',px(4.5));node.dataset.index=index;if(selState().selNodes.has(index)||index===selState().selNode)node.classList.add('selected-node');
  node.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();
   if(e.shiftKey){const next=new Set(selState().selNodes);if(next.has(index)){next.delete(index);setSelection({selNodes: next,selNode: selState().selNode===index?[...next].at(-1)??null:selState().selNode});}else{next.add(index);setSelection({selNodes: next,selNode: index});}render();return;}
   if(!selState().selNodes.has(index)||selState().selNodes.size<2){setSelection({selNodes: new Set([index])});}setSelection({selNode: index});
   $$('.path-node').forEach(n=>n.classList.toggle('selected-node',selState().selNodes.has(Number(n.dataset.index))));
   nodeButtonsState.set({...nodeButtonsState.get(),del:false});
   setInteraction({nodeDrag: {id:selectedPath.id,index,pointerId:e.pointerId,element:node,start:coord(e),group:selState().selNodes.size>1?[...selState().selNodes]:null,originals:selectedPath.points.map(p=>[...p])}});
   });controls.append(node);});
 if(selState().selNode!==null&&selState().selNodes.size<=1&&selectedPath.handles?.[selState().selNode]){const h=selectedPath.handles[selState().selNode],p=selectedPath.points[selState().selNode];for(const which of ['in','out']){const q=which==='in'?h.i:h.o,line=document.createElementNS(svgNS,'line');line.setAttribute('class','handle-line');line.setAttribute('x1',p[0]);line.setAttribute('y1',p[1]);line.setAttribute('x2',q[0]);line.setAttribute('y2',q[1]);controls.append(line);const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('class','path-handle');dot.setAttribute('cx',q[0]);dot.setAttribute('cy',q[1]);dot.setAttribute('r',px(4));dot.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();setInteraction({nodeDrag: {id:selectedPath.id,index:selState().selNode,handle:which,mirror:!e.altKey,pointerId:e.pointerId,element:dot,line}});});controls.append(dot);}}
}

async function add(kind){const id=crypto.randomUUID();if(kind==='text'){try{await ensureFontLoaded(newTextFont);}catch(error){toast(error.message);return;}const f=getFont(newTextFont);edit([{op:'add_text',id,text:'BLOOM',x:-18,y:18,height:fitHeight(newTextFont,'BLOOM'),thread:$('#thread').value,font:newTextFont,...(f?.kind==='outline'?{stitch:'fill'}:{})}],()=>{setSelection({selected: id});setSelection({multi: new Set([id])});});return;}edit([{op:'add_shape',id,kind,name:kind==='ellipse'?'Ellipse':'Rectangle',x:-12,y:-8,width:24,height:16,thread:$('#thread').value,stitch:(stitchChoicesState.get().type==='satin'?'fill':stitchChoicesState.get().type)}],()=>{setSelection({selected: id});});}
function coord(e){const p=$('#art').createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform($('#art').getScreenCTM().inverse());return [q.x,q.y];}
const withGroup=id=>{const g=documentNow().doc.objects.find(o=>o.id===id)?.groupId;return g?new Set(documentNow().doc.objects.filter(o=>o.groupId===g).map(o=>o.id)):new Set([id]);};
let lastDown=null;
const snapv=v=>snapOn?+(Math.round(v/gridSize)*gridSize).toFixed(3):v;
// With snapping on, a point first snaps to a nearby node of another object (within 1.5 mm), otherwise to the grid.
let snapCache=null;
// Object snapping: nodes, segment midpoints, shape centres and the nearest point on other outlines, within a few screen pixels; a marker shows what was hit.
function snapTargets(){const key=documentNow().doc.revision+':'+(interactionNow().nodeDrag?.id||'');if(snapCache?.key===key)return snapCache;const nodes=[],segs=[];
  for(const o of documentNow().doc.objects){if(o.kind==='text'||o.kind==='stitch_layer'||o.visible===false||(interactionNow().nodeDrag&&o.id===interactionNow().nodeDrag.id))continue;
    let rings;try{rings=o.kind==='path'?[o.points.map(q=>[+q[0],+q[1]])]:geometry(o,0);}catch{continue;}
    for(const ring of rings){const closed=o.kind!=='path'||o.closed;const pts=o.kind==='path'?ring:ring.slice(0,closed&&ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?-1:undefined);
      const corner=o.kind==='ellipse'||(o.kind==='rect'&&cornerRadii(o).some(r=>r>0))?null:pts;if(corner)for(const q of corner)nodes.push({p:q,kind:'node'});
      const edge=o.kind==='path'?(o.closed?[...ring,ring[0]]:ring):ring;
      for(let i=1;i<edge.length;i++){segs.push([edge[i-1],edge[i]]);if(o.kind!=='ellipse'&&!(o.kind==='rect'&&cornerRadii(o).some(r=>r>0)))nodes.push({p:[(edge[i-1][0]+edge[i][0])/2,(edge[i-1][1]+edge[i][1])/2],kind:'mid'});}}
    if(o.kind==='rect'||o.kind==='ellipse'){nodes.push({p:[o.x+o.w/2,o.y+o.h/2],kind:'center'});if(o.kind==='ellipse')for(const q of [[o.x,o.y+o.h/2],[o.x+o.w,o.y+o.h/2],[o.x+o.w/2,o.y],[o.x+o.w/2,o.y+o.h]])nodes.push({p:q,kind:'node'});}}
  snapCache={key,nodes,segs};return snapCache;}
function showSnap(hit){const root=$('#overlay');root.querySelectorAll('.snap-hit').forEach(n=>n.remove());if(!hit)return;const c=document.createElementNS(svgNS,'g');c.setAttribute('class','snap-hit');const r=px(5);const shape=hit.kind==='mid'?document.createElementNS(svgNS,'path'):hit.kind==='edge'?document.createElementNS(svgNS,'circle'):document.createElementNS(svgNS,'rect');
  if(hit.kind==='mid')shape.setAttribute('d',`M${hit.p[0]},${hit.p[1]-r}L${hit.p[0]+r},${hit.p[1]+r}L${hit.p[0]-r},${hit.p[1]+r}Z`);
  else if(hit.kind==='edge'){shape.setAttribute('cx',hit.p[0]);shape.setAttribute('cy',hit.p[1]);shape.setAttribute('r',r*.7);}else{shape.setAttribute('x',hit.p[0]-r);shape.setAttribute('y',hit.p[1]-r);shape.setAttribute('width',2*r);shape.setAttribute('height',2*r);if(hit.kind==='center')shape.setAttribute('transform',`rotate(45 ${hit.p[0]} ${hit.p[1]})`);}
  c.append(shape);root.append(c);}
function snapPt(p){if(snapObjState.get()){const tol=px(9),{nodes,segs}=snapTargets();let best=null,bd=tol;for(const n of nodes){const d=Math.hypot(n.p[0]-p[0],n.p[1]-p[1])-(n.kind==='node'?px(2):0);if(d<bd){bd=d;best=n;}}
    if(!best)for(const [a,b] of segs){const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(!l2)continue;const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<Math.min(bd,px(5))){bd=d;best={p:q,kind:'edge'};}}
    if(best){showSnap(best);return [best.p[0],best.p[1]];}}
  showSnap(null);if(!snapOn)return p;return p.map(snapv);}
// Moving, resizing and rotating whole objects lives in canvas.js; this handles dragging path nodes and Bézier handles in edit mode.
window.addEventListener('pointermove',e=>{if(!interactionNow().nodeDrag||e.pointerId!==interactionNow().nodeDrag.pointerId)return;
 if(interactionNow().nodeDrag.group){const q=coord(e);let dx=q[0]-interactionNow().nodeDrag.start[0],dy=q[1]-interactionNow().nodeDrag.start[1];if(Math.hypot(dx,dy)*canvasView.scale()<3&&interactionNow().nodeDrag.dx===undefined)return;if(snapOn){const o0=interactionNow().nodeDrag.originals[interactionNow().nodeDrag.index];dx=snapv(o0[0]+dx)-o0[0];dy=snapv(o0[1]+dy)-o0[1];}setInteraction({nodeDrag: {...interactionNow().nodeDrag, dx: dx}});setInteraction({nodeDrag: {...interactionNow().nodeDrag, dy: dy}});$$('.path-node').forEach(n=>{const i=Number(n.dataset.index);if(interactionNow().nodeDrag.group.includes(i)){n.setAttribute('cx',interactionNow().nodeDrag.originals[i][0]+dx);n.setAttribute('cy',interactionNow().nodeDrag.originals[i][1]+dy);}});previewMaskNodes(interactionNow().nodeDrag.id,s=>{for(const i of interactionNow().nodeDrag.group)shiftMaskNode(s,i,dx,dy);});return;}
 const q=snapPt(coord(e));
 setInteraction({nodeDrag: {...interactionNow().nodeDrag, x: q[0]}});
 setInteraction({nodeDrag: {...interactionNow().nodeDrag, y: q[1]}});
 interactionNow().nodeDrag.element.setAttribute('cx',q[0]);
 interactionNow().nodeDrag.element.setAttribute('cy',q[1]);
 interactionNow().nodeDrag.line?.setAttribute('x2',q[0]);
 interactionNow().nodeDrag.line?.setAttribute('y2',q[1]);
 if(interactionNow().nodeDrag.handle)previewMaskNodes(interactionNow().nodeDrag.id,s=>setMaskHandle(s,interactionNow().nodeDrag.index,interactionNow().nodeDrag.handle,q,interactionNow().nodeDrag.mirror));
 else previewMaskNodes(interactionNow().nodeDrag.id,s=>{const o=s.points[interactionNow().nodeDrag.index];shiftMaskNode(s,interactionNow().nodeDrag.index,q[0]-o[0],q[1]-o[1]);});
 });
// A mask's cut is its clipPath; while its nodes are dragged the cut is redrawn from the moved points.
function previewMaskNodes(id,change){const mask=documentNow().doc.objects.find(o=>o.id===id),cp=document.getElementById('clip-'+id)?.firstElementChild;if(!mask||!cp)return;const shape={points:mask.points.map(p=>[...p]),handles:mask.handles?.map(h=>h&&{i:[...h.i],o:[...h.o]})};change(shape);cp.setAttribute('d',geometry({...mask,...shape},0).map(r=>'M'+r.map(q=>q.join(',')).join('L')+'Z').join(''));}
function shiftMaskNode(s,i,dx,dy){s.points[i]=[s.points[i][0]+dx,s.points[i][1]+dy];const h=s.handles?.[i];if(h){h.i=[h.i[0]+dx,h.i[1]+dy];h.o=[h.o[0]+dx,h.o[1]+dy];}}
function setMaskHandle(s,i,which,q,mirror){const h=s.handles?.[i];if(!h)return;const key=which==='in'?'i':'o',p=s.points[i];h[key]=[q[0],q[1]];if(mirror)h[key==='i'?'o':'i']=[2*p[0]-q[0],2*p[1]-q[1]];}
function finishDrag(e){if(!interactionNow().nodeDrag||e.pointerId!==interactionNow().nodeDrag.pointerId)return;const current=interactionNow().nodeDrag;setInteraction({nodeDrag: null});
 if(current.group){if(current.dx!==undefined&&Math.hypot(current.dx,current.dy)>.02)edit([{op:'move_path_points',id:current.id,indexes:current.group,dx:current.dx,dy:current.dy}]);else render();return;}
 const moved=Number.isFinite(current.x)&&Number.isFinite(current.y);
 if(moved&&current.handle)edit([{op:'set_path_handle',id:current.id,index:current.index,which:current.handle,x:current.x,y:current.y,mirror:current.mirror}]);
 else if(moved)edit([{op:'set_path_point',id:current.id,index:current.index,x:current.x,y:current.y}]);
 else render();
 }
window.addEventListener('pointerup',finishDrag);window.addEventListener('pointercancel',finishDrag);

// ---- layers / element tree: sewing order top to bottom, groups as collapsible parents, eye and lock toggles, drag to reorder, double-click to rename
function renderLayers(){
 const root=$('#objects');root.replaceChildren();const seen=new Set(),icon=(name)=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
 const rowFor=(o,depth)=>{const row=document.createElement('div');row.className=`object-row${selState().multi.has(o.id)?' selected':''}${o.visible===false?' is-hidden':''}${o.locked?' is-locked':''}`;row.dataset.id=o.id;row.draggable=true;row.tabIndex=0;row.setAttribute('role','button');row.style.paddingLeft=`${8+depth*16}px`;
  row.innerHTML=`<i class="swatch" style="background:${esc(o.thread)}"></i><span class="row-name">${esc(o.name||o.kind)}</span><span class="row-tag">${o.kind==='stitch_layer'?'machine stitches':esc(o.stitch)}</span><button type="button" class="row-btn row-eye" aria-label="${o.visible===false?'Show':'Hide'} ${esc(o.name||o.kind)}" title="${o.visible===false?'Show':'Hide'}">${icon(o.visible===false?'eye-off':'eye')}</button><button type="button" class="row-btn row-lock${o.locked?' on':''}" aria-label="${o.locked?'Unlock':'Lock'} ${esc(o.name||o.kind)}" title="${o.locked?'Unlock':'Lock'}">${icon(o.locked?'lock':'unlock')}</button>`;
  root.append(row);
  };
 for(const o of documentNow().doc.objects){if(seen.has(o.id))continue;
  if(o.groupId){const members=documentNow().doc.objects.filter(v=>v.groupId===o.groupId);members.forEach(m=>seen.add(m.id));const open=!collapsed.has(o.groupId),all=members.every(m=>selState().multi.has(m.id)),hiddenAll=members.every(m=>m.visible===false),lockedAll=members.every(m=>m.locked);
   const head=document.createElement('div');
   head.className=`group-row${all?' selected':''}`;
   head.dataset.group=o.groupId;
   head.tabIndex=0;
   head.setAttribute('role','button');
   head.innerHTML=`<button type="button" class="row-btn group-caret" aria-label="${open?'Collapse':'Expand'} group" aria-expanded="${open}">${icon(open?'chevron':'chevron-right')}</button>${icon('group')}<span class="row-name">Group · ${members.length} objects</span><button type="button" class="row-btn row-eye" aria-label="${hiddenAll?'Show':'Hide'} group">${icon(hiddenAll?'eye-off':'eye')}</button><button type="button" class="row-btn row-lock${lockedAll?' on':''}" aria-label="${lockedAll?'Unlock':'Lock'} group">${icon(lockedAll?'lock':'unlock')}</button>`;
   root.append(head);
   if(open)for(const m of members)rowFor(m,1);}
  else{seen.add(o.id);rowFor(o,0);}}
}
function layerIds(target){const g=target.closest('.group-row')?.dataset.group;return g?documentNow().doc.objects.filter(o=>o.groupId===g).map(o=>o.id):null;}
$('#objects').addEventListener('click',e=>{
 const head=e.target.closest('.group-row'),row=e.target.closest('.object-row');
 if(e.target.closest('.group-caret')&&head){const g=head.dataset.group;collapsed.has(g)?collapsed.delete(g):collapsed.add(g);render();return;}
 if(e.target.closest('.row-eye')){const ids=head?layerIds(head):[row.dataset.id],hide=!documentNow().doc.objects.filter(o=>ids.includes(o.id)).every(o=>o.visible===false);edit(ids.map(id=>({op:'set_object',id,visible:!hide})));return;}
 if(e.target.closest('.row-lock')){const ids=head?layerIds(head):[row.dataset.id],lock=!documentNow().doc.objects.filter(o=>ids.includes(o.id)).every(o=>o.locked);edit(ids.map(id=>({op:'set_object',id,locked:lock})));return;}
 if(head){const ids=layerIds(head);if(e.shiftKey)selectIds([...new Set([...selState().multi,...ids])],ids.at(-1));else selectIds(ids,ids.at(-1));return;}
 if(!row)return;
 const id=row.dataset.id;
 if(!e.shiftKey&&e.target.closest('.row-name')){const now=performance.now();if(lastRowClick&&lastRowClick.id===id&&now-lastRowClick.t<450){lastRowClick=null;startRename(row);return;}lastRowClick={id,t:now};}if(e.shiftKey){const next=new Set(selState().multi);if(next.has(id)&&next.size>1)next.delete(id);else next.add(id);selectIds([...next],id);}else selectIds([...withGroup(id)],id);
});
let lastRowClick=null;
function startRename(row){const o=documentNow().doc.objects.find(v=>v.id===row.dataset.id),name=row.querySelector('.row-name');if(!o||!name)return;
 const input=document.createElement('input');
 input.className='row-rename';
 input.value=o.name||'';
 input.maxLength=120;
 name.replaceWith(input);
 input.focus();
 input.select();
 let finished=false;
 const done=ok=>{if(finished)return;finished=true;const v=input.value.trim();if(ok&&v&&v!==o.name)edit([{op:'set_object',id:o.id,name:v}]);else render();};
 input.onkeydown=ev=>{ev.stopPropagation();if(ev.key==='Enter')done(true);else if(ev.key==='Escape')done(false);};
 input.onblur=()=>done(true);
 input.onclick=ev=>ev.stopPropagation();
 }
$('#objects').addEventListener('dragstart',e=>{const row=e.target.closest('.object-row');if(!row)return;setInteraction({dragLayer: row.dataset.id});e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',interactionNow().dragLayer);});
$('#objects').addEventListener('dragover',e=>{const row=e.target.closest('.object-row');if(!interactionNow().dragLayer||!row||row.dataset.id===interactionNow().dragLayer)return;e.preventDefault();const r=row.getBoundingClientRect(),after=e.clientY>r.top+r.height/2;$$('#objects .drop-before,#objects .drop-after').forEach(n=>n.classList.remove('drop-before','drop-after'));row.classList.add(after?'drop-after':'drop-before');});
$('#objects').addEventListener('dragleave',e=>{if(!e.relatedTarget||!$('#objects').contains(e.relatedTarget))$$('#objects .drop-before,#objects .drop-after').forEach(n=>n.classList.remove('drop-before','drop-after'));});
$('#objects').addEventListener('drop',e=>{const row=e.target.closest('.object-row');$$('#objects .drop-before,#objects .drop-after').forEach(n=>n.classList.remove('drop-before','drop-after'));if(!interactionNow().dragLayer||!row||row.dataset.id===interactionNow().dragLayer){setInteraction({dragLayer: null});return;}e.preventDefault();const from=documentNow().doc.objects.findIndex(o=>o.id===interactionNow().dragLayer),t=documentNow().doc.objects.findIndex(o=>o.id===row.dataset.id),after=e.clientY>row.getBoundingClientRect().top+row.offsetHeight/2;let to=t+(after?1:0);if(from<to)to--;const id=interactionNow().dragLayer;setInteraction({dragLayer: null});if(to!==from)edit([{op:'reorder',id,index:to}]);});
$('#objects').addEventListener('dragend',()=>{setInteraction({dragLayer: null});$$('#objects .drop-before,#objects .drop-after').forEach(n=>n.classList.remove('drop-before','drop-after'));});

$('#rect').onclick=()=>add('rect');$('#ellipse').onclick=()=>add('ellipse');$('#letter').onclick=()=>add('text');

// The measure tool's two points in mm (b is null until the second click).

// The knife tool's first point in mm (null until the first click).

let segReady=false,threadsReady=false;
const TOOL_HINTS={measure:'Click two points to measure the distance. Esc leaves the tool.',knife:'Click points along the cut across the selected closed shape, then Enter to cut. Esc leaves the tool.',path:'Click to add points. Click the first point to close a polygon, Enter or double-click to finish.',pen:'Click to add corner nodes, drag to pull curve handles. Click the first node to close, Enter to finish.',line:'Drag on the canvas to draw a line.',polygon:'Drag from the center to size and rotate. Sides come from the sidebar.',star:'Drag from the center to size and rotate. Points come from the sidebar.'};
function drawPathPreview(cursor){const root=$('#stitches');root.replaceChildren();if(!pathDraftNow().pathPoints.length)return;const pts=cursor&&toolMode.get()==='path'?[...pathDraftNow().pathPoints,cursor]:pathDraftNow().pathPoints,line=document.createElementNS(svgNS,'polyline'),outline=toolMode.get()==='pen'&&pathDraftNow().pathPoints.length>=2?geometry({kind:'path',points:pathDraftNow().pathPoints,handles:pathDraftNow().pathHandles,closed:false})[0]:pts;line.setAttribute('points',outline.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#1c7a67');line.setAttribute('stroke-width','.45');line.setAttribute('stroke-dasharray','1.2 .8');root.append(line);pathDraftNow().pathPoints.forEach((p,i)=>{const h=pathDraftNow().pathHandles[i];if(h)for(const q of [h.i,h.o]){const l=document.createElementNS(svgNS,'line');l.setAttribute('x1',p[0]);l.setAttribute('y1',p[1]);l.setAttribute('x2',q[0]);l.setAttribute('y2',q[1]);l.setAttribute('stroke','#1c7a67');l.setAttribute('stroke-width','.25');root.append(l);}const marker=document.createElementNS(svgNS,'circle');marker.setAttribute('cx',p[0]);marker.setAttribute('cy',p[1]);marker.setAttribute('r',px(i===0&&pathDraftNow().pathPoints.length>2?6:4));marker.setAttribute('fill',i===0?'#1c7a67':'#fff');marker.setAttribute('stroke','#1c7a67');marker.setAttribute('stroke-width','.3');root.append(marker);});}
function setTool(next){if(next===toolMode.get()&&next!=='select')next='select';if(pathDraftNow().pathMode&&pathDraftNow().pathPoints.length>=2&&next!==toolMode.get())endPath(false,false,true);showSnap(null);if(next!=='measure')measureState.set(null);if(next!=='knife')knifeState.set([]);toolMode.set(next);setPathDraft({pathMode: toolMode.get()==='path'||toolMode.get()==='pen'});setPathDraft({pathPoints: []});setPathDraft({pathHandles: []});setPathDraft({penDown: null});setPathDraft({shapeDrag: null});$('#art').classList.toggle('drawing',toolMode.get()!=='select');$('.sides-row').hidden=!(toolMode.get()==='polygon'||toolMode.get()==='star');$('#stitches').replaceChildren();if(toolMode.get()!=='select')toast(TOOL_HINTS[toolMode.get()]);if(toolMode.get()!=='select'&&toolMode.get()!=='knife'&&selState().selected){setSelection({selected: null});setSelection({multi: new Set()});setSelection({selNode: null});render();}}
function continueDigitizing(o){const points=o.points.map(p=>[p[0],p[1]]);setTool('pen');setPathDraft({pathPoints: points});setPathDraft({pathHandles: points.map((_,i)=>o.handles?.[i]||null)});setPathDraft({pathMode: true});setPathDraft({continueId: o.id});setPathDraft({continueStitch: o.stitch||'run'});toast('Click to add points. Click the first point to close the path, or press Enter to finish.');}
function endPath(closed=false,cancel=false,silent=false){const penHandles=pathDraftNow().pathHandles.some(Boolean)?pathDraftNow().pathHandles.map(h=>h||null):null;if(!cancel&&pathDraftNow().continueId&&pathDraftNow().pathPoints.length>=(closed?3:2)){const stitch=closed||pathDraftNow().continueStitch!=='fill'?pathDraftNow().continueStitch:'run';edit([{op:'continue_path',id:pathDraftNow().continueId,points:pathDraftNow().pathPoints,...(penHandles?{handles:penHandles}:{}),closed:Boolean(closed),stitch}],()=>{setSelection({selected: pathDraftNow().continueId});setSelection({multi: new Set([pathDraftNow().continueId])});});}else if(!cancel&&pathDraftNow().pathPoints.length>=(closed?3:2)){const id=crypto.randomUUID();edit([{op:'add_path',id,name:closed?'Polygon':'Drawn path',x:0,y:0,points:pathDraftNow().pathPoints,thread:$('#thread').value,...(penHandles?{handles:pathDraftNow().pathPoints.map((_,i)=>penHandles[i]||null)}:{}),...(closed?{closed:true,stitch:'fill'}:{})}],()=>{setSelection({selected: id});setSelection({multi: new Set([id])});editMode=true;});}setPathDraft({pathPoints: []});setPathDraft({pathHandles: []});setPathDraft({pathMode: false});setPathDraft({continueId: null});setPathDraft({continueStitch: null});if(!silent)setTool('select');else{toolMode.set('select');}$('#stitches').replaceChildren();}
function addPolyShape(kind,center,radius,angle){const n=Math.max(3,Math.min(12,Math.round(Number($('#sides').value))||5)),pts=[];const count=kind==='star'?n*2:n;for(let k=0;k<count;k++){const r=kind==='star'&&k%2?radius*.45:radius,a=angle+Math.PI*2*k/count;pts.push([+(center[0]+r*Math.cos(a)).toFixed(3),+(center[1]+r*Math.sin(a)).toFixed(3)]);}const id=crypto.randomUUID();edit([{op:'add_path',id,name:kind==='star'?`Star ${n}`:`Polygon ${n}`,x:0,y:0,points:pts,closed:true,stitch:'fill',thread:$('#thread').value}],()=>{setSelection({selected: id});setSelection({multi: new Set([id])});});}
function addLine(a,b){const id=crypto.randomUUID();edit([{op:'add_path',id,name:'Line',x:0,y:0,points:[a,b],thread:$('#thread').value}],()=>{setSelection({selected: id});setSelection({multi: new Set([id])});});}
const pathPress=()=>{if(toolMode.get()==='path'&&pathDraftNow().pathPoints.length>=2){endPath();return;}setTool('path');};
toolActions.press=name=>name==='path'?pathPress():setTool(name);
$('#art').addEventListener('click',e=>{if(toolMode.get()!=='path')return;const raw=coord(e),p=snapPt(raw);if(Math.abs(p[0])>1000||Math.abs(p[1])>1000){toast('Path point is outside the supported workspace.');return;}if(pathDraftNow().pathPoints.length>=3&&Math.hypot(raw[0]-pathDraftNow().pathPoints[0][0],raw[1]-pathDraftNow().pathPoints[0][1])<2){endPath(true);return;}if(e.detail>1&&pathDraftNow().pathPoints.length&&Math.hypot(p[0]-pathDraftNow().pathPoints.at(-1)[0],p[1]-pathDraftNow().pathPoints.at(-1)[1])<.01){endPath();return;}setPathDraft({pathPoints:[...pathDraftNow().pathPoints,p]});if(pathDraftNow().pathPoints.length>1000){setPathDraft({pathPoints:pathDraftNow().pathPoints.slice(0,-1)});toast('A path is limited to 1,000 points.');return;}drawPathPreview();});
$('#art').addEventListener('pointerdown',e=>{if(e.button!==0)return;if(toolMode.get()==='pen'){const raw=coord(e),p=snapPt(raw);if(Math.abs(p[0])>1000||Math.abs(p[1])>1000)return;if(pathDraftNow().pathPoints.length>=3&&Math.hypot(raw[0]-pathDraftNow().pathPoints[0][0],raw[1]-pathDraftNow().pathPoints[0][1])<2){endPath(true);return;}if(pathDraftNow().pathPoints.length>=1000)return;setPathDraft({pathPoints:[...pathDraftNow().pathPoints,p],pathHandles:[...pathDraftNow().pathHandles,null]});setPathDraft({penDown: {index:pathDraftNow().pathPoints.length-1,pointerId:e.pointerId}});drawPathPreview();}else if(toolMode.get()==='line'||toolMode.get()==='polygon'||toolMode.get()==='star'){e.preventDefault();const p=snapPt(coord(e));setPathDraft({shapeDrag: {start:p,end:p,pointerId:e.pointerId}});}});
window.addEventListener('pointermove',e=>{if(pathDraftNow().penDown&&e.pointerId===pathDraftNow().penDown.pointerId){const q=coord(e),p=pathDraftNow().pathPoints[pathDraftNow().penDown.index];if(Math.hypot(q[0]-p[0],q[1]-p[1])>.8){setPathDraft({pathHandles:replaceAt(pathDraftNow().pathHandles,pathDraftNow().penDown.index,{i:[2*p[0]-q[0],2*p[1]-q[1]],o:q})});}drawPathPreview();return;}if(pathDraftNow().shapeDrag&&e.pointerId===pathDraftNow().shapeDrag.pointerId){setPathDraft({shapeDrag:{...pathDraftNow().shapeDrag,end:snapPt(coord(e))}});const {start,end}=pathDraftNow().shapeDrag,root=$('#stitches');root.replaceChildren();let el;if(toolMode.get()==='line'){el=document.createElementNS(svgNS,'line');el.setAttribute('x1',start[0]);el.setAttribute('y1',start[1]);el.setAttribute('x2',end[0]);el.setAttribute('y2',end[1]);}else{const r=Math.hypot(end[0]-start[0],end[1]-start[1]),a=Math.atan2(end[1]-start[1],end[0]-start[0]),n=Math.max(3,Math.min(12,Math.round(Number($('#sides').value))||5)),count=toolMode.get()==='star'?n*2:n,pts=Array.from({length:count},(_,k)=>{const rr=toolMode.get()==='star'&&k%2?r*.45:r,t=a+Math.PI*2*k/count;return [start[0]+rr*Math.cos(t),start[1]+rr*Math.sin(t)];});el=document.createElementNS(svgNS,'polygon');el.setAttribute('points',pts.map(q=>q.join(',')).join(' '));}el.setAttribute('fill','none');el.setAttribute('stroke','#1c7a67');el.setAttribute('stroke-width','.45');el.setAttribute('stroke-dasharray','1.2 .8');root.append(el);}});
window.addEventListener('pointerup',e=>{if(pathDraftNow().penDown&&e.pointerId===pathDraftNow().penDown.pointerId){setPathDraft({penDown: null});drawPathPreview();return;}if(pathDraftNow().shapeDrag&&e.pointerId===pathDraftNow().shapeDrag.pointerId){const {start,end}=pathDraftNow().shapeDrag;setPathDraft({shapeDrag: null});const t=toolMode.get(),dist=Math.hypot(end[0]-start[0],end[1]-start[1]);$('#stitches').replaceChildren();if(t==='line'){if(dist<1){toast('Drag to draw a line.');return;}addLine(start,end);}else if(dist<1)addPolyShape(t,start,12,-Math.PI/2);else addPolyShape(t,start,dist,Math.atan2(end[1]-start[1],end[0]-start[0]));setTool('select');}});
$('#art').addEventListener('pointermove',e=>{if(toolMode.get()==='path'&&pathDraftNow().pathPoints.length)drawPathPreview(snapPt(coord(e)));});
function insertNodeAt(o,point){const g=o.points;let best=-1,bestD=Infinity,bestP=null;for(let i=0;i<g.length-(o.closed?0:1);i++){const a=g[i],b=g[(i+1)%g.length],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/len)):0,q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(point[0]-q[0],point[1]-q[1]);if(d<bestD){bestD=d;best=i;bestP=q;}}if(best<0)return;edit([{op:'insert_path_point',id:o.id,index:best+1,x:snapv(bestP[0]),y:snapv(bestP[1])}],()=>{setSelection({selNode: best+1});});}
function doubleClickPath(e){if(pathDraftNow().pathMode)return false;const point=coord(e),near=o=>{const g=geometry(o)[0];let d=Infinity;for(let i=1;i<g.length;i++){const a=g[i-1],b=g[i],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/len)):0;d=Math.min(d,Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t));}return d;},paths=documentNow().doc.objects.filter(o=>o.kind==='path'&&o.visible!==false),o=(selectedObject()?.kind==='path'?[selectedObject(),...paths]:paths).find(o=>near(o)<1.5);if(o){setSelection({selected: o.id});setSelection({multi: new Set([o.id])});insertNodeAt(o,point);}return Boolean(o);}
$('#continueDig').onclick=()=>{const o=selectedObject();if(o?.kind!=='path'){toast('Select a path first.');return;}continueDigitizing(o);};
nodeActions.add=()=>{const o=selectedObject();if(o?.kind!=='path')return;const i=selState().selNode??0,a=o.points[i],b=o.points[(i+1)%o.points.length];if(!b||(!o.closed&&i>=o.points.length-1)){toast('Select a node that has a following segment, or double-click the path.');return;}edit([{op:'insert_path_point',id:o.id,index:i+1,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2}],()=>{setSelection({selNode: i+1});});};
function deleteNode(){const o=selectedObject();if(o?.kind!=='path')return;const idx=selState().selNodes.size?[...selState().selNodes]:selState().selNode===null?[]:[selState().selNode];if(!idx.length)return;edit(idx.length===1?[{op:'delete_path_point',id:o.id,index:idx[0]}]:[{op:'delete_path_points',id:o.id,indexes:idx}],()=>{setSelection({selNode: null});setSelection({selNodes: new Set()});});}
nodeActions.del=deleteNode;
nodeActions.smooth=()=>{const o=selectedObject();if(o?.kind==='path'&&selState().selNode!==null)edit([{op:'set_path_node_type',id:o.id,index:selState().selNode,type:'smooth'}]);};
nodeActions.corner=()=>{const o=selectedObject();if(o?.kind==='path'&&selState().selNode!==null&&o.handles?.[selState().selNode])edit([{op:'set_path_node_type',id:o.id,index:selState().selNode,type:'corner'}]);};
$('#border').onchange=e=>{const o=selectedObject();if(o)edit([{op:'set_object',id:o.id,border:e.target.checked}]);};
$('#borderThread').onchange=e=>{const o=selectedObject();if(o)edit([{op:'set_object',id:o.id,borderThread:e.target.value}]);};
$('#group').onclick=()=>{const ids=[...selState().multi];if(ids.length>=2)edit([{op:'group',ids}]);};
$('#ungroup').onclick=()=>{const ids=[...selState().multi];if(ids.length)edit([{op:'ungroup',ids}]);};
const setHoop=(w,h)=>{if(edit([{op:'set_hoop',width:w,height:h}])){try{localStorage.setItem('welcome.hoop',JSON.stringify(hoopSize(documentNow().doc)));}catch{}canvasView?.fitHoop();}};
hoopActions.preset=key=>{const p=HOOP_PRESETS.find(v=>v.key===key);if(p){setHoop(p.w,p.h);return;}const cur=hoopSize(documentNow().doc);setHoopFields({preset:HOOP_PRESETS.some(v=>v.w===cur.w&&v.h===cur.h)?key:'custom'});};
hoopActions.rotate=()=>{if(edit([{op:'rotate_hoop'}])){try{localStorage.setItem('welcome.hoop',JSON.stringify(hoopSize(documentNow().doc)));}catch{}canvasView?.fitHoop();}};
hoopActions.commit=(field,text)=>{const h=hoopSize(documentNow().doc);if(field==='hoopW')setHoop(Number(text),h.h);else setHoop(h.w,Number(text));};
snapObjActions.toggle=()=>{const on=!snapObjState.get();snapObjState.set(on);try{localStorage.setItem('welcome.snapObj',on?'1':'0');}catch{}showSnap(null);toast(on?'Snapping to other objects on.':'Snapping to other objects off.');};
$('#snap').onclick=()=>{snapOn=!snapOn;render();toast(snapOn?`Snap to ${gridSize} mm grid on.`:'Snap off.');};
$('#grid').onchange=e=>{gridSize=Number(e.target.value);render();};
alignActions.press=name=>{const ids=[...selState().multi];if(name==='horizontal'||name==='vertical'){if(ids.length>=3)edit([{op:'distribute',ids,axis:name}]);return;}if(!ids.length)return;edit([{op:'align',ids,edge:name,...(ids.length===1?{to:'hoop'}:{})}]);};
$('#duplicate').onclick=()=>{const ids=[...selState().multi];if(!ids.length)return;const copies=ids.map(id=>[id,crypto.randomUUID()]),regroup=ids.length>1&&new Set(ids.map(id=>documentNow().doc.objects.find(o=>o.id===id)?.groupId)).size===1&&documentNow().doc.objects.find(o=>o.id===ids[0])?.groupId;edit([...copies.map(([id,newId])=>({op:'duplicate',id,newId,dx:3,dy:3})),...(regroup?[{op:'group',ids:copies.map(c=>c[1])}]:[])],()=>{setSelection({multi: new Set(copies.map(c=>c[1]))});setSelection({selected: copies.at(-1)[1]});});};
function removeSelected(){const ids=[...selState().multi];if(!ids.length)return;edit(ids.map(id=>({op:'delete',id})),()=>{setSelection({selected: null});setSelection({multi: new Set()});setSelection({selNode: null});});}$('#remove').onclick=removeSelected;

$('#thread').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,thread:e.target.value}]);};
$('#spacing').onchange=e=>edit(selState().selected?[{op:'set_object',id:selState().selected,spacing:Number(e.target.value)}]:[{op:'set_settings',spacing:Number(e.target.value)}]);
$('#angle').onchange=e=>edit(selState().selected?[{op:'set_object',id:selState().selected,angle:Number(e.target.value)}]:[{op:'set_settings',angle:Number(e.target.value)}]);
$('#fillResetBtn').onclick=()=>{if(selState().selected)edit(orderedIds().map(id=>({op:'set_object',id,spacing:null,angle:null,stitchLength:null,stagger:null,underlayType:null,underlayInset:null,underlaySpacing:null})));};
for(const [id,key,parse] of [['stitchLength','stitchLength',Number],['stagger','stagger',v=>Number(v)],['underlayType','underlayType',v=>v],['underlayInset','underlayInset',Number],['underlaySpacing','underlaySpacing',Number]])$('#'+id).onchange=e=>{const v=parse(e.target.value);if(selState().multi.size)edit(orderedIds().map(oid=>({op:'set_object',id:oid,[key]:v})));else edit([{op:'set_settings',[key]:v}]);};
settingsActions.set=patch=>edit([{op:'set_settings',...patch}]);
const runBoolean=mode=>{const ids=documentNow().doc.objects.map(o=>o.id).filter(id=>selState().multi.has(id));if(ids.length>=2)edit([{op:'boolean',mode,ids}],()=>{setSelection({selected: ids[0]});setSelection({multi: new Set([ids[0]])});});};
selectionToolbarActions.press=name=>{if(name==='flipH'){const ids=orderedIds();if(ids.length)edit([{op:'flip',ids,axis:'horizontal'}]);}else if(name==='flipV'){const ids=orderedIds();if(ids.length)edit([{op:'flip',ids,axis:'vertical'}]);}else runBoolean(name);};
const pickedObjects=()=>documentNow().doc.objects.filter(o=>selState().multi.has(o.id));
const afterOps=(ops,sel)=>edit(ops,()=>{if(sel){setSelection({selected: sel});setSelection({multi: new Set([sel])});}});
$('#offsetBtn').onclick=()=>{const o=selectedObject();if(o)afterOps([{op:'offset',id:o.id,distance:Number($('#offsetMm').value)}],o.id);};
$('#strokeBtn').onclick=()=>{const o=selectedObject();if(o)afterOps([{op:'stroke_to_shape',id:o.id,width:Number($('#strokeW').value)}],o.id);};
$('#simpBtn').onclick=()=>{const o=selectedObject();if(o)afterOps([{op:'simplify_path',id:o.id,tolerance:Number($('#simpTol').value)}],o.id);};
$('#reverseBtn').onclick=()=>{const ids=pickedObjects().filter(o=>o.kind==='path').map(o=>o.id);if(ids.length)edit(ids.map(id=>({op:'reverse_path',id})));};
$('#splitBtn').onclick=()=>{const o=selectedObject();if(o?.kind==='path'&&selState().selNode!==null)afterOps([{op:'split_path',id:o.id,index:selState().selNode}],o.id);else toast('Select a path and one of its nodes first.');};
$('#joinBtn').onclick=()=>{const ids=pickedObjects().filter(o=>o.kind==='path'&&!o.closed).map(o=>o.id);if(ids.length>=2)afterOps([{op:'join_paths',ids}],ids[0]);else toast('Select two or more open paths to join.');};
$('#selectSame').onclick=()=>{const o=selectedObject();if(!o)return;setSelection({multi: new Set(documentNow().doc.objects.filter(v=>v.thread.toLowerCase()===o.thread.toLowerCase()).map(v=>v.id))});render();};
const arrayUi=()=>{const m=$('#arrMode').value;$('#arrALabel').firstChild.textContent=m==='radial'?'Centre X (mm)':'Step X (mm)';$('#arrBLabel').firstChild.textContent=m==='radial'?'Centre Y (mm)':'Step Y (mm)';$('#arrALabel').style.display=$('#arrBLabel').style.display=m==='along'?'none':'';setStitchRow('arrAngleRow',m!=='radial');};
$('#arrMode').onchange=arrayUi;arrayUi();
$('#arrBtn').onclick=()=>{const m=$('#arrMode').value,count=Number($('#arrCount').value),picked=pickedObjects();let op;
 if(m==='along'){const path=picked.find(o=>o.kind==='path'),motif=picked.find(o=>o!==path);if(!path||!motif||picked.length!==2){toast('Select the motif and the path to follow (two objects).');return;}op={op:'array',id:motif.id,mode:'along',pathId:path.id,count};}
 else{const o=selectedObject();if(!o){toast('Select an object to repeat.');return;}op=m==='linear'?{op:'array',id:o.id,mode:'linear',count,dx:Number($('#arrA').value),dy:Number($('#arrB').value)}:{op:'array',id:o.id,mode:'radial',count,cx:Number($('#arrA').value),cy:Number($('#arrB').value),angle:Number($('#arrAngle').value)};}
 edit([op]);};
for(const [id,to] of [['ordBack','back'],['ordBackward','backward'],['ordForward','forward'],['ordFront','front']])$('#'+id).onclick=()=>{const ids=to==='back'||to==='forward'?documentNow().doc.objects.map(o=>o.id).filter(v=>selState().multi.has(v)).reverse():documentNow().doc.objects.map(o=>o.id).filter(v=>selState().multi.has(v));if(ids.length)edit(ids.map(i=>({op:'reorder',id:i,to})));};
$('#ordSort').onclick=()=>edit([{op:'sort_by_color'}]);
$('#redworkOutline').onclick=()=>{if(selState().selected)edit([{op:'redwork_outline',id:selState().selected}]);};

$('#appliqueGroup').onclick=()=>{const ids=[...selState().multi],closed=ids.filter(id=>isClosedShape(documentNow().doc.objects.find(o=>o.id===id))),skipped=ids.length-closed.length;if(closed.length<2){toast(t('Appliqué from a group needs two or more closed shapes.'));return;}edit([{op:'applique_group',ids:closed}],()=>{if(skipped)toast(t('{n} open objects left as they are.',{n:skipped}));});};
$('#redworkGroup').onclick=()=>{const ids=[...selState().multi];if(ids.length)edit([{op:'redwork_group',ids}]);};
$('#removeSmallHoles').onclick=()=>{const ids=[...selState().multi].filter(id=>isClosedShape(documentNow().doc.objects.find(o=>o.id===id))&&documentNow().doc.objects.find(o=>o.id===id).kind==='path'),maxArea=Number($('#smallHoleArea').value);if(!(maxArea>=.1&&maxArea<=20)){toast(t('The hole limit must be 0.1 to 20 mm².'));return;}const count=ids.reduce((n,id)=>n+countSmallHoles(documentNow().doc.objects.find(o=>o.id===id),maxArea),0);if(!count){toast(t('No holes under {a} mm² in the selection.',{a:maxArea}));return;}edit([{op:'remove_small_holes',ids,maxArea}],()=>toast(t('Removed small holes: {n}.',{n:count})));};
$('#removeSmallIslands').onclick=()=>{const ids=[...selState().multi].filter(id=>isClosedShape(documentNow().doc.objects.find(o=>o.id===id))),maxArea=Number($('#smallIslandArea').value);if(!(maxArea>=.1&&maxArea<=20)){toast(t('The island limit must be 0.1 to 20 mm².'));return;}const count=ids.filter(id=>isSmallIsland(documentNow().doc.objects.find(o=>o.id===id),maxArea)).length;if(!count){toast(t('No islands under {a} mm² in the selection.',{a:maxArea}));return;}edit([{op:'remove_small_islands',ids,maxArea}],()=>toast(t('Removed small islands: {n}.',{n:count})));};
$('#textOnPath').onclick=()=>{const picked=[...selState().multi].map(id=>documentNow().doc.objects.find(o=>o.id===id)).filter(Boolean),t=picked.find(o=>o.kind==='text'),p=picked.find(o=>o.kind==='path');if(t&&p)edit([{op:'text_on_path',textId:t.id,pathId:p.id}],()=>{setSelection({selected: t.id});setSelection({multi: new Set([t.id])});});};
$('#textOffPath').onclick=()=>{const ids=[...selState().multi].filter(id=>documentNow().doc.objects.find(o=>o.id===id)?.along);if(ids.length)edit(ids.map(textId=>({op:'text_off_path',textId})));};
letteringActions.commit=(field,text)=>{if(field==='alongOffset'){const o=selectedObject();if(o?.along)edit([{op:'set_along_offset',textId:o.id,offset:Number(text)}]);return;}const o=textObj();if(!o)return;if(field==='text'){let t=text;if(!isRegistryFont(o.font))t=t.replace(/\n/g,' ').toUpperCase().slice(0,24);if(!t.trim()){toast('Lettering needs some text.');syncTextInspector(o);return false;}edit([{op:'set_object',id:o.id,text:t}]);return;}if(field==='height'){const height=Number(text);edit([{op:'transform',id:o.id,height,width:measureText(o.text,o.font||'welcome-mono/1',height,o)}]);return;}const key={tracking:'tracking',wordSpacing:'wordSpacing',lineHeight:'lineHeight',boldMm:'bold',italicDeg:'italic'}[field];edit([{op:'set_object',id:o.id,[key]:Number(text)}]);};
letteringActions.choose=(field,value)=>{if(field==='font'){setFont(value);return;}const o=textObj();if(!o)return;if(field==='vertical'){if(value&&!isRegistryFont(o.font)){toast(t('Vertical lettering needs a bundled or loaded font. Choose one in Font.'));return false;}if(edit([{op:'set_object',id:o.id,vertical:value}])&&value)fitVerticalToHoop(o.id);return;}if(field==='nameDrop'){edit([{op:'set_object',id:o.id,nameDrop:value}]);return;}if(field==='stitch')edit([{op:'set_object',id:o.id,stitch:value}]);};
letteringActions.press=(name,value)=>{const o=textObj();if(!o)return;if(name==='bold')edit([{op:'set_object',id:o.id,bold:o.bold>0?0:Math.max(.4,Math.round(o.h*.03*10)/10)}]);else if(name==='italic')edit([{op:'set_object',id:o.id,italic:o.italic>0?0:12}]);else edit([{op:'set_object',id:o.id,align:value}]);};
$('#underlay').onchange=e=>edit([{op:'set_settings',underlay:e.target.checked}]);
$('#fabric').onchange=e=>edit([{op:'set_settings',fabric:e.target.value}]);
function renderFontsList(){const list=$('#fontsList'),usage=customFontUsage(documentNow().doc),bundled=bundledFontUsage(documentNow().doc);list.replaceChildren();for(const f of usage){const li=document.createElement('li');li.textContent=`${f.name}: used by ${f.uses.length} lettering object${f.uses.length===1?'':'s'}${f.uses.length?' ('+f.uses.join(', ')+')':''}`;list.append(li);}for(const f of bundled){const li=document.createElement('li');li.textContent=`${getFont(f.id)?.name||f.id} (bundled, not removed): used by ${f.uses.length} lettering object${f.uses.length===1?'':'s'} (${f.uses.join(', ')})`;list.append(li);}$('#fontsEmpty').hidden=usage.length+bundled.length>0;$('#removeUnusedFonts').disabled=!usage.some(f=>!f.uses.length);}
$('#organizeFonts').onclick=()=>{renderFontsList();$('#fontsDialog').showModal();};
$('#removeUnusedFonts').onclick=()=>{const before=Object.keys(documentNow().doc.customFonts||{}).length;edit([{op:'remove_unused_fonts'}]);const removed=before-Object.keys(documentNow().doc.customFonts||{}).length;renderFontsList();toast(removed?`Removed ${removed} unused font${removed===1?'':'s'}.`:'No unused fonts to remove.');};
$('#comp').onchange=e=>edit([{op:'set_settings',compensation:Number(e.target.value)}]);
// With a pivot set, the rotation field turns the whole selection by the change about the pivot; without one, each object's own rotation is set.
transformActions.commit=(field,text)=>{if(!selState().selected)return;if(field==='rotation'){const v=Number(text);if(!Number.isFinite(v))return;if(pivotState.get().pivot){const turn=((v-(Number(selectedObject()?.rotation)||0))+540)%360-180;if(turn)edit([{op:'rotate',ids:[...selState().multi],angle:turn,cx:pivotState.get().pivot[0],cy:pivotState.get().pivot[1]}]);return;}edit([{op:'transform',id:selState().selected,rotation:v}]);return;}const key={posX:'x',posY:'y',sizeW:'width',sizeH:'height'}[field];edit([{op:'transform',id:selState().selected,[key]:Number(text)}]);};
pivotActions.togglePick=()=>{const cur=pivotState.get();pivotState.set({...cur,picking:!cur.picking});};
pivotActions.reset=()=>{pivotState.set({pivot:null,picking:false});render();canvasView.refresh();};
// New text and font switches start at the font's own design size, shrunk (within the font's size range) so the line fits 85% of the hoop width.
function fitHeight(fid,text,opts={}){const f=isRegistryFont(fid)?getFont(fid):null;if(!f)return fid==='neon-blinking/1'?20:8;const lo=f.size*f.minScale,hi=f.size*f.maxScale,limit=hoopSize(documentNow().doc).w*.85,w=measureText(text,fid,f.size,opts);let h=f.size;if(w>limit)h=f.size*limit/w;return Math.max(lo,Math.min(hi,+h.toFixed(2)));}
const textObj=()=>{const o=selectedObject();return o?.kind==='text'?o:null;};
function syncTextInspector(o){
 const isText=o?.kind==='text',fid=isText?(o.font||'welcome-mono/1'):newTextFont,f=isRegistryFont(fid)?getFont(fid):null,legacyNeon=fid==='neon-blinking/1',registry=isRegistryFont(fid);
 const lo=f?+(f.size*f.minScale).toFixed(2):legacyNeon?20:registry?2:4,hi=f?+(f.size*f.maxScale).toFixed(2):legacyNeon?60:registry?200:16;
 const entry=fontIndex.find(x=>x.fid===fid),custom=fid.startsWith('custom/')?documentNow().doc.customFonts?.[fid.slice(7)]:null;
 let fontOptions=letteringFieldsState.get().fontOptions;
 if(!fontOptions.some(op=>op.value===fid))fontOptions=[...fontOptions,{value:fid,label:fid}];
 setLetteringFields({textOff:!isText,styleOff:!isText||!registry,text:isText?o.text:'',height:String(isText?+Number(o.h).toFixed(2):(f?.size??(legacyNeon?20:8))),heightMin:String(lo),heightMax:String(hi),heightTitle:`${lo}–${hi} mm for this font`,fontOptions,fontValue:fid,tracking:String(o?.tracking??0),wordSpacing:String(o?.wordSpacing??0),lineHeight:String(o?.lineHeight??1),boldMm:String(o?.bold??0),italicDeg:String(o?.italic??0),bold:Boolean(o?.bold>0),italic:Boolean(o?.italic>0),align:o?.align||'left',vertical:Boolean(o?.vertical),nameDrop:Boolean(o?.nameDrop),stitch:o?.stitch==='run'?'run':'fill',fontInfoHidden:!(entry||custom),fontInfoText:custom?`${custom.name} — loaded from a file; stored inside this project. ${custom.license||'Check the licence of the font file before sharing the design.'}`:entry?`${entry.name} — ${entry.license||''}${entry.original&&entry.original!==entry.name?` · ${t('based on')} ${entry.original}`:''}${!registry?' · '+t('single-line font: spacing, bold and italic apply to bundled outline/stitch fonts; pick a satin or fill font to set the stitch density'):''}`:''});
 setStitchRow('textStitchRow',!(isText&&f?.kind==='outline'));
 fontPicker?.refreshButton();
}
async function setFont(fid){
 try{await ensureFontLoaded(fid);}catch(error){toast(error.message);syncTextInspector(selectedObject());return;}
 newTextFont=fid;const o=textObj(),f=isRegistryFont(fid)?getFont(fid):null;
 if(o){const legacy=!isRegistryFont(fid),height=fitHeight(fid,o.text.split('\n').reduce((a,b)=>a.length>=b.length?a:b,''),o),text=legacy?o.text.replace(/\n/g,' ').toUpperCase().slice(0,24):o.text;
  edit([{op:'set_object',id:o.id,font:fid,text,stitch:f?.kind==='outline'?(getFont(o.font)?.kind==='outline'&&o.stitch==='run'?'run':'fill'):'run'},{op:'transform',id:o.id,height,width:measureText(text,fid,height,o)}]);
  }
 else syncTextInspector(null);
}








// Vertical lettering fits the hoop: a column taller than 90% of the hoop height is scaled down by its height ratio, with the width kept in proportion (the same transform the lettering height field uses).
function fitVerticalToHoop(id){const o=documentNow().doc.objects.find(v=>v.id===id);if(!o?.vertical)return;const b=objectBounds(o),colH=b[3]-b[1],limit=hoopSize(documentNow().doc).h*.9;if(!(colH>limit)||!(o.h>0))return;const height=+(o.h*limit/colH).toFixed(2);if(edit([{op:'transform',id,height,width:measureText(o.text,o.font||'welcome-mono/1',height,o)}])){const o2=documentNow().doc.objects.find(v=>v.id===id),b2=objectBounds(o2),cx=(b2[0]+b2[2])/2,cy=(b2[1]+b2[3])/2;edit([{op:'transform',id,x:o2.x-cx,y:o2.y-cy}]);toast(t('Vertical lettering fitted to the hoop at {h} mm.',{h:height}));}}


async function loadFontFile(file){
 try{if(file.size>12_000_000)throw Error('Font files over 12 MB are not supported.');const bytes=new Uint8Array(await file.arrayBuffer()),base=file.name.replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9_.-]+/g,'_').slice(0,32)||'font';let id=base,n=1;while(documentNow().doc.customFonts?.[id]||getFont(`custom/${id}`))id=`${base}_${++n}`;
  const font=ttfToFont(bytes,{id,name:file.name.replace(/\.[^.]+$/,''),license:'Loaded from a local file — check its licence',keywords:['truetype','outline','custom']});
  if(Object.keys(font.glyphs).length<10)throw Error('That font has too few Latin glyphs.');
  delete font.id;
  const key=`custom/${id}`;registerFont(key,{...font,id});
  const o=textObj();
  const ok=transact(()=>{(documentNow().doc.customFonts||={})[id]=font;if(o){const t=documentNow().doc.objects.find(v=>v.id===o.id);t.font=key;t.stitch='fill';t.h=font.size;t.w=measureText(t.text,key,font.size,t);}});
  if(ok){newTextFont=key;fontIndex=[...fontIndex.filter(f=>f.fid!==key),{fid:key,id,name:font.name,kind:'outline',keywords:['truetype','outline','custom'],license:font.license,size:font.size,minScale:font.minScale,maxScale:font.maxScale}];populateFontSelect();toast(`Loaded ${font.name}. It is stored in this project.`);syncTextInspector(selectedObject());}
 }catch(error){toast(error.message);}
}
stitchChoiceActions.choose=(id,value)=>{if(id==='fillMethod'){const v=value==='rows'?null:value;if(selState().multi.size)edit(orderedIds().map(oid=>({op:'set_object',id:oid,fillMethod:v})));else edit([{op:'set_settings',fillMethod:v}]);return;}if(id==='cap'||id==='join'){const ids=[...selState().multi];if(ids.length)edit(ids.map(i=>({op:'set_object',id:i,[id]:value==='butt'&&id==='cap'||value==='round'&&id==='join'?null:value})));return;}if(id==='runStyle'){if(selState().selected)edit([{op:'set_object',id:selState().selected,runStyle:value==='single'?null:value}]);return;}if(id==='type'){if(selState().selected)edit([{op:'set_object',id:selState().selected,stitch:value}]);}};
capRowsActions.choose=(field,checked)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,applique:checked?true:null}]);};
runRowsActions.commit=(field,text)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:field==='lengthVariance'?(Math.max(0,Math.min(50,Number(text)||0))/100||null):(text===''?null:Number(text))}]);};
runRowsActions.choose=(field,checked)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,underpath:checked?null:false}]);};
pathRowsActions.choose=(field,checked)=>{const o=selectedObject();if(!o)return;if(field==='closed'){edit([{op:'set_path',id:o.id,closed:checked},...(checked?[{op:'set_object',id:o.id,stitch:'fill'}]:[])]);return;}edit([{op:'set_path',id:o.id,smooth:checked}]);};
typeRowsActions.commit=(field,text)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:Number(text)}]);};
satinEndRowsActions.commit=(field,text)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:text===''?null:Number(text)}]);};
capRowsActions.commit=(field,text)=>{if(field==='appliqueWidth'){if(selState().selected)edit([{op:'set_object',id:selState().selected,appliqueWidth:Number(text)}]);return;}if(field==='compensation'){if(selState().selected)edit([{op:'set_object',id:selState().selected,compensation:text===''?null:Number(text)}]);return;}const o=selectedObject();if(o&&selState().selNode!==null)edit([{op:'set_width_at_node',id:o.id,index:selState().selNode,width:Number(text)}]);};
blingRowsActions.choose=(field,value)=>{if(!selState().selected)return;if(field==='motifPair'){edit([{op:'set_object',id:selState().selected,motifPair:value,...(value?{satinWidth:selectedObject()?.satinWidth??4}:{})}]);return;}const v=field==='blingRings'?Number(value):value;edit([{op:'set_object',id:selState().selected,[field]:v}]);};
function populateFontSelect(){setLetteringFields({fontOptions:fontIndex.map(f=>({value:f.fid,label:f.name}))});}
const fontPicker=createFontPicker({button:$('#fontButton'),buttonPreview:$('#fontButtonPreview'),buttonName:$('#fontButtonName'),panel:$('#fontPanel'),search:$('#fontSearch'),chips:$('#fontChips'),list:$('#fontList'),loadFile:$('#fontLoadFile'),fileInput:$('#fontFile'),getIndex:()=>[...fontIndex,...Object.entries(documentNow().doc.customFonts||{}).filter(([id])=>!fontIndex.some(f=>f.fid===`custom/${id}`)).map(([id,f])=>({fid:`custom/${id}`,id,name:f.name,kind:'outline',keywords:['truetype','custom'],license:f.license,size:f.size,minScale:f.minScale,maxScale:f.maxScale}))],getCurrent:()=>textObj()?.font||newTextFont,getSample:()=>(textObj()?.text||'Hello 123').split('\n')[0].slice(0,14),getColor:()=>textObj()?.thread||'#1d2925',ensureLoaded:ensureFontLoaded,onPick:setFont,onLoadFile:loadFontFile});
fetchFontIndex().then(index=>{fontIndex=index;populateFontSelect();syncTextInspector(selectedObject());fontPicker.refresh();});
$('#undo').onclick=()=>{const d=documentNow();if(!d.history.length)return;const prev=d.history.at(-1);setDocument({doc:{...prev,revision:prev.revision+1},history:d.history.slice(0,-1),future:[...d.future,clone(d.doc)],dirty:true});clearComputed();render();};
$('#redo').onclick=()=>{const d=documentNow();if(!d.future.length)return;const next=d.future.at(-1);setDocument({doc:{...next,revision:next.revision+1},history:[...d.history,clone(d.doc)],future:d.future.slice(0,-1),dirty:true});clearComputed();render();};
function download(bytes,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

// Notes from the last SVG import (for example, a filled path that kept its outline), shown as a toast after the file opens.
let svgImportNotes=[];
function importSvg(source){
 svgImportNotes=[];
 if(source.length>1_000_000||/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('SVG files must be under 1 MB and cannot declare entities.');
 const xml=new DOMParser().parseFromString(source,'image/svg+xml');
 if(xml.querySelector('parsererror'))throw Error('Invalid SVG XML.');
 const root=xml.documentElement;
 if(root.localName!=='svg')throw Error('SVG root element is required.');
 const rootAllowed=new Set(['xmlns','viewBox','width','height','version','id']);
 for(const a of [...root.attributes])if(!rootAllowed.has(a.name))throw Error(`SVG root attribute ${a.name} is unsupported; transforms and inherited styles are rejected.`);
 const vb=(root.getAttribute('viewBox')||'0 0 100 100').trim().split(/[ ,]+/).map(Number);
 if(vb.length!==4||vb.some(v=>!Number.isFinite(v))||vb[2]<=0||vb[3]<=0||vb[2]>100000||vb[3]>100000)throw Error('SVG needs a finite, positive viewBox no larger than 100,000 units.');
 const scale=Math.min(110/vb[2],110/vb[3]),ox=-(vb[0]+vb[2]/2)*scale,oy=-(vb[1]+vb[3]/2)*scale,objects=[];let pointTotal=0;
 for(const el of [...root.querySelectorAll('*')]){const tag=el.localName;const allowed=tag==='g'?new Set(['id']):({rect:new Set(['id','x','y','width','height','rx','ry','fill','stroke']),ellipse:new Set(['id','cx','cy','rx','ry','fill','stroke']),line:new Set(['id','x1','y1','x2','y2','fill','stroke','stroke-width']),polyline:new Set(['id','points','fill','stroke','stroke-width']),path:new Set(['id','d','fill','stroke','stroke-width'])})[tag];if(!allowed)throw Error(`SVG element <${tag}> is outside the supported safe subset.`);for(const a of [...el.attributes])if(!allowed.has(a.name)||/^on/i.test(a.name))throw Error(`SVG attribute ${a.name} is unsupported; transforms and inherited styles are rejected.`);if(tag==='g')continue;
  const fill=el.getAttribute('fill'),stroke=el.getAttribute('stroke'),raw=fill&&fill!=='none'?fill:stroke||'#527461';
  if(!/^#[0-9a-f]{6}$/i.test(raw))throw Error('SVG colors must be six-digit hexadecimal values.');
  const thread=raw.toLowerCase();
  const id=crypto.randomUUID();
  if(tag==='rect'||tag==='ellipse'){const isEllipse=tag==='ellipse',cx=Number(el.getAttribute('cx')||0),cy=Number(el.getAttribute('cy')||0),rx=Number(el.getAttribute('rx')||0),ry=Number(el.getAttribute('ry')||0),x=isEllipse?cx-rx:Number(el.getAttribute('x')||0),y=isEllipse?cy-ry:Number(el.getAttribute('y')||0),w=Number(el.getAttribute(isEllipse?'rx':'width')||0)*(isEllipse?2:1),h=Number(el.getAttribute(isEllipse?'ry':'height')||0)*(isEllipse?2:1);if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)throw Error('SVG shapes require finite positive dimensions.');objects.push({id,name:'Imported '+(tag==='rect'?'rectangle':'ellipse'),kind:tag==='rect'?'rect':'ellipse',x:x*scale+ox,y:y*scale+oy,w:w*scale,h:h*scale,thread,stitch:fill&&fill!=='none'?'fill':'run'});}
  else {let paths=[];if(tag==='path'){const d=el.getAttribute('d')||'';if(d.length>200000)throw Error('SVG path data exceeds 200,000 characters.');paths=parseSvgPath(d);}else{const rawpts=tag==='line'?[el.getAttribute('x1')||0,el.getAttribute('y1')||0,el.getAttribute('x2')||0,el.getAttribute('y2')||0].map(Number):(el.getAttribute('points')||'').trim().split(/[ ,]+/).map(Number);if(rawpts.length<4||rawpts.length%2||rawpts.some(v=>!Number.isFinite(v)))throw Error('SVG line and polyline coordinates are invalid.');paths=[Array.from({length:rawpts.length/2},(_,i)=>rawpts.slice(i*2,i*2+2))];}
   // A stroke-only path with a stroke-width of 0.3 mm or more (after the viewBox scale) sews as a satin column of that width; without a stroke-width it stays a running stitch, as before.
 const swAttr=el.getAttribute('stroke-width'),strokeMm=swAttr===null?NaN:Number(swAttr)*scale,strokeOnly=(fill===null||fill==='none')&&stroke!==null&&stroke!=='none',satinStroke=strokeOnly&&strokeMm>=.3;
 const fillRule=tag==='path'?svgPathFill(fill,stroke,paths):{fill:false,note:null,holes:0,islands:0,depths:[]};
 if(fillRule.note&&!svgImportNotes.includes(fillRule.note))svgImportNotes.push(fillRule.note);
  if(fillRule.fill){const toMm=pts=>pts.slice(0,-1).map(([x,y])=>[x*scale+ox,y*scale+oy]);const outerAt=fillRule.depths.indexOf(0),mm=toMm(paths[outerAt]);pointTotal+=paths.reduce((n,r)=>n+r.length,0);if(pointTotal>5000)throw Error('SVG import is limited to 5,000 path points.');const fillAt=(pts,holeList)=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {id:crypto.randomUUID(),name:'Imported fill',kind:'path',x:Math.min(...xs),y:Math.min(...ys),w:0,h:0,points:pts,thread,closed:true,stitch:'fill',...(holeList.length?{holes:holeList}:{})};};
    const holeRings=paths.filter((_,i)=>fillRule.depths[i]===1).map(toMm);objects.push(fillAt(mm,holeRings));
    paths.forEach((r,i)=>{if(fillRule.depths[i]===2)objects.push(fillAt(toMm(r),[]));});}
  else for(const points of paths){if(points.length<2)continue;pointTotal+=points.length;if(points.length>1000||pointTotal>5000)throw Error('SVG import is limited to 5,000 path points.');const mm=points.map(([x,y])=>[x*scale+ox,y*scale+oy]),xs=mm.map(p=>p[0]),ys=mm.map(p=>p[1]);objects.push({id:crypto.randomUUID(),name:'Imported path',kind:'path',x:Math.min(...xs),y:Math.min(...ys),w:0,h:0,points:mm,thread,...(satinStroke?{stitch:'satin',satinWidth:Math.max(.5,Math.min(12,strokeMm))}:{stitch:'run'})});}
  }
  if(objects.length>100)throw Error('SVG import is limited to 100 editable objects.');
 }
 const d={schema:'welcome/1',name:'Imported SVG',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:true,compensation:.2},objects};
 validateDocument(d);
 return d;
}
function safeProjectFilename(name){return `${String(name||'Untitled').replace(/\.welcome$/i,'').replace(/[^a-z0-9 _-]/gi,'_').trim()||'Untitled'}.welcome`;}
function projectSave(){setTimeout(()=>{try{const a=JSON.parse(localStorage.getItem('welcome.autosave')||'null');if(a){a.clean=true;localStorage.setItem('welcome.autosave',JSON.stringify(a));}}catch{}},0);download(JSON.stringify(documentNow().doc,null,2),safeProjectFilename(documentNow().doc.name),'application/json');setDocument({dirty: false});render();}
function acceptProject(next){validateDocument(next);const opened=clone(next);clearComputed();setDocument({doc: opened});setDocument({history: []});setDocument({future: []});setSelection({selected: documentNow().doc.objects[0]?.id||null});setSelection({multi: new Set(selState().selected?[selState().selected]:[])});editMode=false;setSelection({selNode: null});setDocument({dirty: false});render();canvasView?.fitAll();toast('Project opened locally.');}
async function openArtifact(id){if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid MCP project link.');let response=await fetch(`/artifacts/${id}.welcome`,{credentials:'same-origin',redirect:'error'});if(response.status===404)response=await fetch(`/artifacts/${id}.welcome`,{credentials:'same-origin',redirect:'error'});if(!response.ok)throw Error(`MCP project could not be opened (${response.status}).`);const next=await response.json();acceptProject(next);window.history.replaceState(null,'',location.pathname);}

documentActions.rename=text=>{const name=text.trim();if(!name){toast('Project name cannot be empty.');return false;}edit([{op:'rename_document',name}]);return true;};
$('#save').onclick=projectSave;
$('#new').onclick=()=>{editMode=false;if(documentNow().dirty&&!confirm(t('Discard unsaved changes?')))return;clearComputed();setDocument({doc: withSavedHoop({...initialDocument(),name:'Untitled design',objects:[]})});setDocument({history: []});setDocument({future: []});setSelection({selected: null});setSelection({multi: new Set()});setDocument({dirty: true});render();canvasView?.fitHoop();};
$('#open').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>33_554_432)throw Error('Welcome project files are limited to 32 MiB.');if(f.name.toLowerCase().endsWith('.svg')){acceptProject(importSvg(await f.text()));if(svgImportNotes.length)toast(svgImportNotes.join(' '));}else if((f.name.toLowerCase().endsWith('.welcome')||f.name.toLowerCase().endsWith('.welcome'))||f.name.toLowerCase().endsWith('.json'))acceptProject(JSON.parse(await f.text()));else if(f.name.toLowerCase().endsWith('.dxf')){const r=dxfDocument(await f.text());acceptProject(r.doc);const skipped=Object.entries(r.skipped).map(([k,n])=>`${n} ${k}`).join(', ');toast(`DXF imported: ${r.doc.objects.length} path${r.doc.objects.length===1?'':'s'}${skipped?`; skipped ${skipped}`:''}${r.bulged?`; ${r.bulged} arc${r.bulged===1?'':'s'} sewn as straight segments`:''}.`);}else throw Error('Open a .welcome project, SVG or ASCII DXF here. Use Import JEF / VP3 for machine files.');}catch(err){toast(err.message);}e.target.value='';};
$('#importMachine').onclick=()=>$('#machineFile').click();
$('#machineFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const lower=f.name.toLowerCase(),format=lower.endsWith('.jef')?'jef':lower.endsWith('.vp3')?'vp3':lower.endsWith('.dst')?'dst':lower.endsWith('.sew')?'sew':lower.endsWith('.pec')?'pec':lower.endsWith('.pes')?'pes':lower.endsWith('.exp')?'exp':lower.endsWith('.hus')?'hus':lower.endsWith('.xxx')?'xxx':lower.endsWith('.dsb')?'dsb':lower.endsWith('.dsz')?'dsz':lower.endsWith('.tap')?'tap':lower.endsWith('.tbf')?'tbf':lower.endsWith('.pcs')?'pcs':lower.endsWith('.shv')?'shv':lower.endsWith('.stx')?'stx':lower.endsWith('.bro')?'bro':lower.endsWith('.emd')?'emd':lower.endsWith('.ksm')?'ksm':lower.endsWith('.10o')?'10o':null;if(!format)throw Error(t('Choose a .jef, .vp3, .dst, .sew, .pec, .pes, .exp, .hus, .xxx, .dsb, .dsz, .tap, .tbf, .pcs, .shv, .stx, .bro, .emd, .ksm or .10o file.'));if(f.size>1_048_576)throw Error('Machine-file imports are limited to 1 MiB so original source bytes fit in the project.');const bytes=await f.arrayBuffer(),result=await request({type:'import',format,bytes,fileName:f.name},[bytes]);const layer=makeStitchLayer(result.decoded,format,{fileName:f.name,sha256:result.sha256,size:f.size,originalBytesBase64:result.sourceBytesBase64});const committed=transact(()=>{setDocument({doc:{...documentNow().doc,objects:[...documentNow().doc.objects,layer]}});setSelection({selected: layer.id});});if(committed){toast(`Imported ${f.name} as a ${format.toUpperCase()} stitch layer.`);compileNow();}}catch(err){toast(err.message);}e.target.value='';};
viewActions.choose=chosen=>{viewMode.set(chosen);if(chosen==='design'){if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;}playIndex=null;}if(chosen!=='design'&&!plan)compileNow();render();};
const MACHINE_FORMATS=['jef','vp3','dst','exp','pec','pes','pes6','sew','u01','xxx','tbf'];
function syncWorksheetRow(){$('#worksheetRow').hidden=!MACHINE_FORMATS.includes($('#format').value);}
$('#format').onchange=syncWorksheetRow;
$('#export').onclick=()=>{syncWorksheetRow();$('#exportDialog').showModal();};
$('#download').onclick=async e=>{e.preventDefault();await ensureDocFonts().catch(()=>{});if($('#format').value==='dxf'){const r=exportDxf(documentNow().doc),skipped=Object.values(r.skipped).reduce((a,b)=>a+b,0);download(r.text,`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}.dxf`,'application/dxf');$('#exportDialog').close();toast(`DXF exported: ${r.count} path${r.count===1?'':'s'}${skipped?`; ${skipped} stitch layer${skipped===1?'':'s'} skipped (no outline)`:''}.`);return;}if($('#format').value==='applique-print'){let svg;try{svg=exportAppliqueTemplates(documentNow().doc);}catch(err){toast(err.message);return;}download(svg,`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}-applique-templates.svg`,'image/svg+xml');$('#exportDialog').close();toast('Appliqué templates exported at 1:1. Print at 100% and check the 10 mm bar before cutting fabric.');return;}if($('#format').value==='print'){download(exportPrintTemplate(documentNow().doc),`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}-template.svg`,'image/svg+xml');$('#exportDialog').close();toast('Print template exported at 1:1. Print it at 100% and check the 10 mm bar before placing fabric.');return;}if($('#format').value==='svg'){download(exportSvg(documentNow().doc),`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}.svg`,'image/svg+xml');$('#exportDialog').close();toast('SVG exported (design only, not a stitch plan).');return;}try{const revision=documentNow().doc.revision,result=await request({type:'export',document:forWorker(documentNow().doc),format:$('#format').value,color:selectedObject()?.thread||'#527461'});if(result.plan.revision!==revision||revision!==documentNow().doc.revision)throw Error('The document changed during export. Export the current revision again.');plan=result.plan;const base=safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'');download(result.bytes,`${base}.${$('#format').value==='pes6'?'pes':$('#format').value}`, 'application/octet-stream');const withSheet=$('#worksheetRow').hidden===false&&$('#withWorksheet').checked,sheetFormat=$('#withWorksheetFormat').value;if(withSheet)download(sewingWorksheet(documentNow().doc,result.plan,sheetFormat),`${base}-worksheet.${sheetFormat==='svg'?'svg':'txt'}`,sheetFormat==='svg'?'image/svg+xml':'text/plain');render();$('#exportDialog').close();toast(t('{fmt} exported from revision {n}.',{fmt:$('#format').value.toUpperCase(),n:result.plan.revision})+(withSheet?t(' The sewing worksheet is downloaded with it.'):'')+jefWarnings(result.plan,$('#format').value).map(w=>' '+t(w)).join(''));}catch(err){if(err.name!=='AbortError')toast(err.message);}};
async function compileNow(manual=false){compiling=true;try{await ensureDocFonts();const revision=documentNow().doc.revision,result=await request({type:'compile',document:forWorker(documentNow().doc)});if(result.plan.revision!==revision||revision!==documentNow().doc.revision)return;plan=result.plan;lastPlan=plan;compileError='';playIndex=null;compiling=false;render();}catch(err){if(err.name!=='AbortError'){compileError=err.message;compiling=false;render();if(manual===true||manual instanceof Event)toast(err.message);}}finally{if(!plan&&compileError)compiling=false;}}statusActions.compile=()=>compileNow(true);
let issueAt=0;
statusActions.issues=()=>{const list=[...(plan?.issues||[]),...sewingTips()];if(!list.length)return;const issue=list[issueAt++%list.length];selectIds([...withGroup(issue.id)],issue.id);canvasView.fitSelection();};
$('#seek').oninput=()=>{if(!plan)return;if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;}if(viewMode.get()==='design')viewMode.set('stitches');playIndex=Number($('#seek').value);render();};
$('#play').onclick=async()=>{if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;render();return;}if(!plan)await compileNow(true);if(!plan)return;if(viewMode.get()==='design')viewMode.set('stitches');if(playIndex===null||playIndex>=plan.stitches.length)playIndex=0;playbackTimer=setInterval(()=>{playIndex=Math.min(plan.stitches.length,playIndex+Math.max(1,Math.ceil(plan.stitches.length/180)));if(playIndex>=plan.stitches.length){clearInterval(playbackTimer);playbackTimer=null;}render();},50);render();};
$('#resetPlayback').onclick=()=>{if(playbackTimer)clearInterval(playbackTimer);playbackTimer=null;if(viewMode.get()==='design')viewMode.set('stitches');playIndex=0;render();};
$('#art').onpointermove=e=>{const p=coord(e);setStatus({cursor:`x ${p[0].toFixed(1)} mm · y ${p[1].toFixed(1)} mm`});};let objectDblclickAt=-Infinity;
$('#art').addEventListener('dblclick',e=>{if(e.target===$('#art')&&!pathDraftNow().pathMode&&performance.now()-objectDblclickAt>500)add('rect');});
function applyRemote(operations,expected){
 if(expected!==documentNow().doc.revision)return {error:'stale_revision',revision:documentNow().doc.revision,message:`Revision conflict: expected ${expected}, current ${documentNow().doc.revision}. Inspect and retry.`};
 try{const trial=clone(documentNow().doc);applyOperations(trial,operations);validateDocument(trial);}catch(error){return {error:'invalid_operation',revision:documentNow().doc.revision,message:error.message};}
 edit(operations);
 toast(`Agent applied ${operations.length} edit${operations.length===1?'':'s'}.`);
 return {revision:documentNow().doc.revision,document:forWorker(documentNow().doc)};
}
function addLayerRemote(layer,expected){
 if(expected!==documentNow().doc.revision)return {error:'stale_revision',revision:documentNow().doc.revision,message:`Revision conflict: expected ${expected}, current ${documentNow().doc.revision}. Inspect and retry.`};
 try{const trial=clone(documentNow().doc);trial.objects.push(layer);validateDocument(trial);}catch(error){return {error:'invalid_import',revision:documentNow().doc.revision,message:error.message};}
 if(!transact(()=>{setDocument({doc:{...documentNow().doc,objects:[...documentNow().doc.objects,layer]}});setSelection({selected: layer.id});}))return {error:'invalid_import',revision:documentNow().doc.revision,message:'The editor rejected the imported layer.'};
 toast(`Agent imported ${layer.source.fileName}.`);
 return {revision:documentNow().doc.revision};
}
const agentTexts={idle:'Not connected.',waiting:'Connected. Waiting for an agent to use the link.',active:'Agent active.',error:'Connection problem.',unavailable:'Agent relay unavailable.'};
const agent=createAgentBridge({getReference:o=>referenceForAgent(o),getDocument:()=>{const c=clone(documentNow().doc);if(c.reference)c.reference={...c.reference,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',pictureOmitted:true};return c;},applyRemote,addLayerRemote,onChange:state=>{$('#agentStatus').textContent=`${t(agentTexts[state.status]||'')}${state.status==='active'?` ${t(state.agentCalls===1?'1 request so far.':`${state.agentCalls} requests so far.`)}`:''} ${state.message||''}`.trim();$('#agentUrl').value=state.mcpUrl||'';$('#agentCopy').disabled=$('#agentRevoke').disabled=!state.mcpUrl;const button=$('#copyEndpoint');button.classList.toggle('agent-on',state.status==='waiting'||state.status==='active');button.classList.toggle('agent-active',state.status==='active');}});
$('#copyEndpoint').onclick=async()=>{$('#agentDialog').showModal();if(!agent.hasSession())await agent.start();};
if(document.querySelector('meta[name="welcome-static"]'))setStitchRow('copyEndpoint',true);
$('#agentCopy').onclick=async()=>{const url=$('#agentUrl').value;try{await navigator.clipboard.writeText(url);toast('Copied the private MCP link.');}catch{$('#agentUrl').select();toast('Select and copy the link.');}};
$('#agentRevoke').onclick=async()=>{if(confirm(t('Revoke this link? Agents using it lose access immediately.')))await agent.revoke();};
$('#agentUrl').onfocus=e=>e.target.select();
agent.resume();
// ---- canvas: viewport, selection handles, marquee, context menu -------------------------------------------------
$('#editNodes').onclick=()=>{const o=selectedObject();if(o&&selState().multi.size===1)enterEdit(o);else toast('Select one shape, path or lettering first.');};
const orderedIds=()=>documentNow().doc.objects.map(o=>o.id).filter(id=>selState().multi.has(id));
function selectIds(ids,primary){const prev=selState().selected;setSelection({multi: new Set(ids)});setSelection({selected: primary??ids.at(-1)??null});setSelection({selNode: null});setSelection({selNodes: new Set()});if(!(ids.length===1&&selState().selected===prev&&editMode))editMode=false;render();}
// Lettering is edited right on the canvas: a text box opens over the object and the stitch outlines update as you type (Enter commits as one undo step, Shift+Enter adds a line, Esc cancels).
function startCanvasText(o){if(interactionNow().canvasText)return;const b=objectBounds(o),[x0,y0]=canvasView.toScreen(b[0],b[1]),[x1,y1]=canvasView.toScreen(b[2],b[3]),ta=document.createElement('textarea');ta.id='canvasText';ta.value=o.text;ta.setAttribute('aria-label','Edit lettering text');ta.maxLength=isRegistryFont(o.font)?120:24;
 Object.assign(ta.style,{left:`${Math.max(26,x0-8)}px`,top:`${Math.max(26,y0-10)}px`,width:`${Math.max(180,x1-x0+24)}px`,height:`${Math.max(44,Math.min(160,y1-y0+20))}px`});
 $('.canvas').append(ta);
 setInteraction({canvasText: {id:o.id,original:o.text,ta}});
 ta.focus();
 ta.select();
 ta.oninput=()=>liveText(o.id,ta.value);
 ta.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finishCanvasText(true);}else if(e.key==='Escape'){e.preventDefault();finishCanvasText(false);}};
 ta.onblur=()=>finishCanvasText(true);
 }
function liveText(id,value){const o=documentNow().doc.objects.find(v=>v.id===id);if(!o)return;const t=isRegistryFont(o.font)?value:value.replace(/\n/g,' ').toUpperCase().slice(0,24);if(!t.trim())return;o.text=t;o.w=measureText(t,o.font||'welcome-mono/1',o.h,o);render();}
function finishCanvasText(commit){if(!interactionNow().canvasText)return;const {id,original,ta}=interactionNow().canvasText;setInteraction({canvasText: null});const value=ta.value;ta.onblur=null;ta.remove();const o=documentNow().doc.objects.find(v=>v.id===id);if(!o)return;o.text=original;o.w=measureText(original,o.font||'welcome-mono/1',o.h,o);
 const t=isRegistryFont(o.font)?value:value.replace(/\n/g,' ').toUpperCase().slice(0,24);
 if(commit&&t.trim()&&t!==original)edit([{op:'set_object',id,text:t}]);
 else render();
 }
function enterEdit(o){if(!o||o.kind==='stitch_layer')return;if(o.kind==='text'){selectIds([o.id],o.id);startCanvasText(o);return;}
 if(o.kind==='path'){selectIds([o.id],o.id);editMode=true;render();return;}
 edit([{op:'to_path',ids:[o.id]}],()=>{setSelection({selected: o.id});setSelection({multi: new Set([o.id])});editMode=true;setSelection({selNode: null});});}
function copySelection(){const ids=new Set(orderedIds());if(!ids.size)return false;setClipboard({clipboard: {objects:documentNow().doc.objects.filter(o=>ids.has(o.id)).map(clone),pastes:0}});toast(`Copied ${ids.size} object${ids.size===1?'':'s'}.`);return true;}
function pasteClipboard(){if(!clipboardNow().clipboard)return;const pastes=clipboardNow().clipboard.pastes+1;setClipboard({clipboard:{...clipboardNow().clipboard,pastes}});const off=4*pastes,remap=new Map(),made=clipboardNow().clipboard.objects.map(o=>{const c=clone(o);c.id=crypto.randomUUID();c.name=`${o.name||o.kind} copy`;if(o.groupId){if(!remap.has(o.groupId))remap.set(o.groupId,crypto.randomUUID());c.groupId=remap.get(o.groupId);}return c;});
 transact(()=>{for(const c of made){const dx=off,dy=off;c.x+=dx;c.y+=dy;if(c.kind==='path'){c.points=c.points.map(([x,y])=>[x+dx,y+dy]);if(c.handles)c.handles=c.handles.map(h=>h&&{i:[h.i[0]+dx,h.i[1]+dy],o:[h.o[0]+dx,h.o[1]+dy]});if(c.holes)c.holes=c.holes.map(r=>r.map(([x,y])=>[x+dx,y+dy]));}if(c.along)c.along.points=c.along.points.map(([x,y])=>[x+dx,y+dy]);setDocument({doc:{...documentNow().doc,objects:[...documentNow().doc.objects,c]}});}setSelection({selected: made.at(-1).id});setSelection({multi: new Set(made.map(c=>c.id))});setSelection({selNode: null});editMode=false;});
 }
function nudge(dx,dy){const o=selectedObject();if(editMode&&o?.kind==='path'&&(selState().selNodes.size||selState().selNode!==null)){edit([{op:'move_path_points',id:o.id,indexes:selState().selNodes.size?[...selState().selNodes]:[selState().selNode],dx,dy}]);return;}const ids=orderedIds();if(ids.length)edit([{op:'translate',ids,dx,dy}]);}
const selectAll=()=>{const o=selectedObject();if(editMode&&o?.kind==='path'){setSelection({selNodes: new Set(o.points.map((_,i)=>i))});setSelection({selNode: null});render();return;}selectIds(documentNow().doc.objects.filter(o=>o.visible!==false&&!o.locked).map(o=>o.id));};
function menuItems(o,p){
 const has=Boolean(selState().multi.size),one=selState().multi.size===1,sel=documentNow().doc.objects.filter(v=>selState().multi.has(v.id)),canGroup=selState().multi.size>1,grouped=sel.some(v=>v.groupId),kindPath=one&&selectedObject()?.kind==='path';
 const act=(fn)=>()=>fn();const click=id=>()=>$(id).click();
 if(!has)return [{label:'Paste',key:'Ctrl+V',disabled:!clipboardNow().clipboard,run:pasteClipboard},{label:'Select all',key:'Ctrl+A',run:selectAll},'-',{label:'Fit hoop in view',key:'Shift+0',run:()=>canvasView.fitHoop()},{label:'Fit everything',key:'Shift+1',run:()=>canvasView.fitAll()}];
 return [{label:one&&selectedObject().kind==='text'?'Edit text':kindPath?'Edit nodes':'Edit nodes (convert to path)',key:'Enter',disabled:!one||selectedObject().kind==='stitch_layer',run:()=>enterEdit(selectedObject())},
  {label:'Convert to path',key:'Ctrl+Shift+C',disabled:!sel.some(v=>v.kind!=='path'&&v.kind!=='stitch_layer'),run:()=>edit([{op:'to_path',ids:sel.filter(v=>v.kind!=='path'&&v.kind!=='stitch_layer').map(v=>v.id)}])},'-',
  {label:'Cut',key:'Ctrl+X',run:()=>{if(copySelection())removeSelected();}},{label:'Copy',key:'Ctrl+C',run:copySelection},{label:'Paste',key:'Ctrl+V',disabled:!clipboardNow().clipboard,run:pasteClipboard},{label:'Duplicate',key:'Ctrl+D',run:click('#duplicate')},{label:'Copy style',key:'Ctrl+Alt+C',disabled:!one,run:copyStyle},{label:'Paste style',key:'Ctrl+Alt+V',disabled:!clipboardNow().styleClip,run:pasteStyle},{label:'Delete',key:'Del',run:removeSelected},'-',
  {label:'Group',key:'Ctrl+G',disabled:!canGroup,run:click('#group')},{label:'Ungroup',key:'Ctrl+Shift+G',disabled:!grouped,run:click('#ungroup')},'-',
  {label:'Sew first (to back)',key:'Home',run:click('#ordBack')},{label:'Sew earlier',key:'[',run:click('#ordBackward')},{label:'Sew later',key:']',run:click('#ordForward')},{label:'Sew last (to front)',key:'End',run:click('#ordFront')},'-',
  {label:sel.every(v=>v.locked)?'Unlock':'Lock',run:()=>edit(sel.map(v=>({op:'set_object',id:v.id,locked:!sel.every(w=>w.locked)})))},{label:'Hide',run:()=>edit(sel.map(v=>({op:'set_object',id:v.id,visible:false})))},'-',
  {label:'Zoom to selection',key:'Shift+2',run:()=>canvasView.fitSelection()},{label:'Select all',key:'Ctrl+A',run:selectAll}];
}
canvasView=createCanvas({svg:$('#art'),container:$('.canvas'),overlay:$('#overlay'),doc:()=>documentNow().doc,ids:orderedIds,tool:()=>toolMode.get(),pivot:()=>pivotState.get().pivot,knife:()=>knifeState.get(),knifeClick:p=>{const o=selectedObject();if(!o||!(o.kind==='rect'||o.kind==='ellipse'||(o.kind==='path'&&o.closed))){toast(t('Select a closed shape to cut.'));setTool('select');return true;}knifeState.set([...knifeState.get(),p]);canvasView.refresh();return true;},measure:()=>measureState.get(),measureClick:p=>{const q=snapPt(p);const cur=measureState.get();measureState.set(!cur||cur.b?{a:q,b:null}:{...cur,b:q});canvasView.refresh();return true;},pickPivot:p=>{if(!pivotState.get().picking)return false;pivotState.set({pivot:[Math.round(p[0]*10)/10,Math.round(p[1]*10)/10],picking:false});render();canvasView.refresh();return true;},snapPt:p=>snapPt(p),snapOn:()=>snapOn,gridSize:()=>gridSize,coord,isEditing:()=>editMode,
 select:selectIds,commit:(ops,after)=>edit(ops,after),selectNodesIn:(r,add)=>{const o=selectedObject();if(o?.kind!=='path')return;const inside=o.points.map((p,i)=>[p,i]).filter(([p])=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3]).map(([,i])=>i);setSelection({selNodes: new Set(add?[...selState().selNodes,...inside]:inside)});setSelection({selNode: inside.at(-1)??null});render();},withGroup:id=>withGroup(id),dblclick:(o,p)=>{objectDblclickAt=performance.now();if(o.kind==='path'&&editMode&&selState().selected===o.id)insertNodeAt(o,p);else enterEdit(o);},menuItems,
 onViewport:()=>{drawControls();const z=$('#zoomPct');if(z)z.textContent=`${canvasView?canvasView.percent():100}%`;},
 zoomUi:(zoomAt,fitHoop,fitAll,zoom100)=>{$('#zoomIn').onclick=()=>zoomAt(1.25);$('#zoomOut').onclick=()=>zoomAt(1/1.25);$('#zoomFit').onclick=fitHoop;$('#zoomAll').onclick=fitAll;$('#zoomPct').onclick=zoom100;}});
canvasView.fitHoop();
// ---- keyboard ---------------------------------------------------------------------------------------------------
document.addEventListener('keydown',e=>{
 if(canvasView.inField(e))return;const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(mod&&key==='z'){e.preventDefault();(e.shiftKey?$('#redo'):$('#undo')).click();return;}if(mod&&key==='y'){e.preventDefault();$('#redo').click();return;}
 if(e.shiftKey&&!mod&&(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit0')){e.preventDefault();e.code==='Digit1'?canvasView.fitAll():e.code==='Digit2'?canvasView.fitSelection():canvasView.zoomTo100();return;}
 if(!mod&&(e.key==='+'||e.key==='=')){e.preventDefault();canvasView.zoomAt(1.25);return;}if(!mod&&(e.key==='-'||e.key==='_')&&!pathDraftNow().pathMode){e.preventDefault();canvasView.zoomAt(1/1.25);return;}
 if((!pathDraftNow().pathMode||pathDraftNow().pathPoints.length===0)&&!mod&&!e.altKey&&!e.shiftKey){const map={v:'#select',r:'#rect',o:'#ellipse',l:'#line',g:'#polygon',s:'#star',p:'#pen',n:'#path',t:'#letter',m:'#measure',k:'#knife'};if(map[key]){e.preventDefault();$(map[key]).click();return;}}
 if(toolMode.get()==='knife'&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();if(e.key==='Escape'){setTool('select');return;}if(knifeState.get().length<2){toast(t('Click at least two points along the cut, then Enter.'));return;}const o=selectedObject(),points=knifeState.get();knifeState.set([]);setTool('select');if(o)edit([{op:'knife',id:o.id,points}]);return;}
if(pathDraftNow().pathMode){if(e.key==='Enter'){e.preventDefault();endPath();}else if(e.key==='Escape')endPath(false,true);else if(e.key==='Backspace'&&pathDraftNow().pathPoints.length){e.preventDefault();setPathDraft({pathPoints:pathDraftNow().pathPoints.slice(0,-1)});drawPathPreview();}return;}
 if(mod&&key==='a'){e.preventDefault();selectAll();return;}
 if(mod&&!e.altKey&&key==='c'&&!e.shiftKey){e.preventDefault();copySelection();return;}if(mod&&!e.altKey&&key==='x'){e.preventDefault();if(copySelection())removeSelected();return;}if(mod&&!e.altKey&&key==='v'){e.preventDefault();pasteClipboard();return;}
 if(mod&&key==='d'){e.preventDefault();$('#duplicate').click();return;}if(mod&&key==='g'){e.preventDefault();(e.shiftKey?$('#ungroup'):$('#group')).click();return;}
 if(mod&&e.shiftKey&&key==='c'){e.preventDefault();const ids=orderedIds().filter(id=>{const o=documentNow().doc.objects.find(v=>v.id===id);return o.kind!=='path'&&o.kind!=='stitch_layer';});if(ids.length)edit([{op:'to_path',ids}]);return;}
 if(e.key==='Enter'&&selState().multi.size===1){e.preventDefault();enterEdit(selectedObject());return;}
 if(e.key==='[')return $('#ordBackward').click();
 if(e.key===']')return $('#ordForward').click();
 if(e.key==='Home'&&selState().multi.size){e.preventDefault();return $('#ordBack').click();}if(e.key==='End'&&selState().multi.size){e.preventDefault();return $('#ordFront').click();}
 if(e.key.startsWith('Arrow')&&selState().multi.size&&mod&&!editMode){e.preventDefault();const ids=orderedIds(),bs=documentNow().doc.objects.filter(o=>ids.includes(o.id)).map(objectBounds),x0=Math.min(...bs.map(b=>b[0])),y0=Math.min(...bs.map(b=>b[1])),W=Math.max(...bs.map(b=>b[2]))-x0,H=Math.max(...bs.map(b=>b[3]))-y0,step=e.shiftKey?5:1;
  if(e.altKey){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const a=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?15:1);edit([{op:'rotate',ids,angle:a,cx:x0+W/2,cy:y0+H/2}]);}}
  else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const sx=Math.max(.02,(W+(e.key==='ArrowRight'?step:-step))/W);edit([{op:'scale',ids,sx,sy:1,ox:x0,oy:y0}]);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){const sy=Math.max(.02,(H+(e.key==='ArrowDown'?step:-step))/H);edit([{op:'scale',ids,sx:1,sy,ox:x0,oy:y0}]);}return;
  }
 if(e.key.startsWith('Arrow')&&selState().multi.size&&!mod){e.preventDefault();const step=e.altKey?.1:e.shiftKey?5:snapOn?gridSize:1;nudge(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);return;}
 if((e.key==='Delete'||e.key==='Backspace')&&selState().selected){e.preventDefault();if(editMode&&selState().selNode!==null)deleteNode();else removeSelected();return;}
 if(e.key==='Escape'){if(toolMode.get()!=='select')setTool('select');else if(editMode){editMode=false;setSelection({selNode: null});render();}else{setSelection({selected: null});setSelection({multi: new Set()});setSelection({selNode: null});render();}}
});
render();
const openId=new URL(location.href).searchParams.get('open');if(openId)openArtifact(openId).catch(error=>toast(error.message));

// Start / end points: arm a button, then click the canvas. The point is stored as a fraction of the object's bounding box so it follows the object.
pinActions.press=key=>{pinState.set(pinState.get()===key?null:key);$('#art').classList.toggle('art-pin',!!pinState.get());if(pinState.get())toast(key==='startAt'?'Click the canvas to place the start point.':key==='endAt'?'Click the canvas to place the end point.':'Click the canvas to place the ripple centre.');};
pinClearActions.clear=()=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,startAt:null,endAt:null,rippleCenter:null}]);};
$('#art').addEventListener('pointerdown',e=>{if(!pinState.get()||e.button!==0)return;const o=selectedObject();if(!o){pinState.set(null);return;}e.preventDefault();e.stopImmediatePropagation();const p=coord(e),b=objectBounds(o),w=b[2]-b[0]||1,h=b[3]-b[1]||1,key=pinState.get();pinState.set(null);$('#art').classList.remove('art-pin');edit([{op:'set_object',id:o.id,[key]:[Math.max(0,Math.min(1,+((p[0]-b[0])/w).toFixed(4))),Math.max(0,Math.min(1,+((p[1]-b[1])/h).toFixed(4)))]}]);},true);
scheduleCompile(100);

// Guided fill: Draw guide collects canvas clicks, the second press of the button commits them as the line the rows follow.
$('#guideDraw').onclick=()=>{const o=selectedObject();if(!o)return;if(interactionNow().guideDraft){const g=interactionNow().guideDraft;setInteraction({guideDraft: null});$('#art').classList.remove('art-pin');if(g.length>=2)edit([{op:'set_object',id:o.id,guide:g}]);else render();return;}setInteraction({guideDraft: []});pinState.set(null);$('#art').classList.add('art-pin');toast('Click points for the guide, then press Finish guide.');render();};
$('#guideClear').onclick=()=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,guide:null}]);};
$('#art').addEventListener('pointerdown',e=>{if(!interactionNow().guideDraft||e.button!==0)return;const o=selectedObject();if(!o){setInteraction({guideDraft: null});return;}e.preventDefault();e.stopImmediatePropagation();const p=coord(e),b=objectBounds(o),w=b[2]-b[0]||1,h=b[3]-b[1]||1;if(interactionNow().guideDraft.length<50)setInteraction({guideDraft:[...interactionNow().guideDraft,[+((p[0]-b[0])/w).toFixed(4),+((p[1]-b[1])/h).toFixed(4)]]});drawControls();},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&interactionNow().guideDraft){setInteraction({guideDraft: null});$('#art').classList.remove('art-pin');render();}});

segReady=true;
for(const d of $$('details.sec-fold')){try{d.open=localStorage.getItem('welcome.fold.'+d.id)==='1';}catch{}d.addEventListener('toggle',()=>{try{localStorage.setItem('welcome.fold.'+d.id,d.open?'1':'0');}catch{}});}

// vector-editing extras: corner radius, taper, border width, follow path, round corners
$('#radius').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,radius:Number(e.target.value)>0?Number(e.target.value):null}]);};
// Each corner radius: the rectangle's four radii, with the one corner changed (top-left, top-right, bottom-right, bottom-left).
for(const [k,i] of [['TL',0],['TR',1],['BR',2],['BL',3]])$('#radius'+k).onchange=e=>{const o=selectedObject();if(!o||o.kind!=='rect')return;const rr=cornerRadii(o);rr[i]=Math.max(0,Math.min(500,Number(e.target.value)||0));edit([{op:'set_object',id:o.id,radii:rr}]);};
$('#motifShape').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,motifShape:e.target.value}]);};






$('#motifWarp').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,motifWarp:e.target.value}]);};
$('#edgeClose').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,edgeClose:e.target.checked}]);};

$('#satinButtonhole').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,buttonhole:e.target.checked}]);};
$('#raisedSpacing').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,raisedSpacing:e.target.value===''?null:Number(e.target.value)}]);};
$('#raisedAngle').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,raisedAngle:e.target.value===''?null:Number(e.target.value)}]);};
$('#fillRaised').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,raised:e.target.checked}]);};
$('#satinRaised').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,raised:e.target.checked}]);};
$('#borderWidth').onchange=e=>{const ids=[...selState().multi];if(ids.length)edit(ids.map(id=>({op:'set_object',id,borderWidth:Number(e.target.value)>0?Number(e.target.value):null})));};
$('#followPath').onchange=e=>{const o=selectedObject();if(!o||o.kind!=='text')return;const v=e.target.value;if(v==='__custom')return;if(!v){if(o.along)edit([{op:'text_off_path',textId:o.id}]);}else edit([{op:'text_on_path',textId:o.id,pathId:v}]);};
$('#roundBtn').onclick=()=>{const o=selectedObject(),r=Number($('#roundMm').value);if(!o||!(r>0))return;if(o.kind==='rect')edit([{op:'set_object',id:o.id,radius:r}]);else if(o.kind==='path')edit([{op:'round_corners',id:o.id,radius:r,...(selState().selNodes.size?{indexes:[...selState().selNodes]}:{})}],()=>{setSelection({selNodes: new Set()});setSelection({selNode: null});});else toast('Rounding works on rectangles and paths. Convert the shape to a path first.');};

// Line ends and corners, per-node widths, colour blend, clipping masks


$('#widthClear').onclick=()=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,widthStops:null}]);};
$('#blendThread').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,blendThread:e.target.value||null,blendPalette:null,...(e.target.value?{}:{blendStart:null,blendEnd:null})}]);};
for(let k=0;k<4;k++)$('#blendPalette'+k).onchange=()=>{if(!selState().selected)return;const cols=[0,1,2,3].map(j=>$('#blendPalette'+j).value).filter(Boolean);if(cols.length===1){toast(t('Choose at least two colours for a palette.'));return;}edit([{op:'set_object',id:selState().selected,blendPalette:cols.length?cols:null,blendThread:null,...(cols.length?{}:{blendStart:null,blendEnd:null})}]);};
for(const [id,key] of [['#blendStart','blendStart'],['#blendEnd','blendEnd']])$(id).onchange=e=>{if(selState().selected){const v=Math.max(0,Math.min(100,Number(e.target.value)||0))/100;edit([{op:'set_object',id:selState().selected,[key]:v}]);}};
$('#clipBtn').onclick=()=>{const ordered=[...selState().multi].map(id=>documentNow().doc.objects.find(v=>v.id===id)).filter(Boolean).sort((a,b)=>documentNow().doc.objects.indexOf(a)-documentNow().doc.objects.indexOf(b)),top=ordered.at(-1);if(ordered.length<2||!top)return;edit([{op:'clip',ids:ordered.slice(0,-1).map(v=>v.id),maskId:top.id}],()=>{setSelection({multi: new Set(ordered.slice(0,-1).map(v=>v.id))});setSelection({selected: ordered[0].id});});};
$('#unclipBtn').onclick=()=>{const ids=new Set();for(const id of selState().multi){const o=documentNow().doc.objects.find(v=>v.id===id);if(!o)continue;if(o.clipId)ids.add(o.id);if(o.mask)for(const v of documentNow().doc.objects)if(v.clipId===o.id)ids.add(v.id);}if(ids.size)edit([{op:'release_clip',ids:[...ids]}]);};
window.addEventListener('pointerup',()=>showSnap(null));


// Embroidery options: cross stitch size, run style, length variation, appliqué, per-object compensation



accordionRowsActions.commit=(field,text)=>{if(field==='crossSize'){if(selState().selected)edit([{op:'set_object',id:selState().selected,crossSize:Number(text)}]);return;}setAccordion(field,text===''?null:Number(text));};
accordionRowsActions.choose=(field,value)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,accordionEase:value}]);};
const setAccordion=(which,v)=>{if(!selState().selected)return;const o=documentNow().doc.objects.find(x=>x.id===selState().selected),other=which==='accordionStart'?'accordionEnd':'accordionStart';if(v===null)return edit([{op:'set_object',id:selState().selected,accordionStart:null,accordionEnd:null}]);edit([{op:'set_object',id:selState().selected,[which]:v,[other]:o?.[other]??v}]);};


// Photo stitch: a picture becomes a rectangle with grey samples; the zigzag rows are planned at compile time.
const photoUrls=new Map();
function photoUrl(ph){const key=ph.pw+'x'+ph.ph+':'+ph.data.slice(0,64)+ph.data.length;let u=photoUrls.get(key);if(u)return u;const c=document.createElement('canvas');c.width=ph.pw;c.height=ph.ph;const ctx=c.getContext('2d'),img=ctx.createImageData(ph.pw,ph.ph),bin=atob(ph.data);for(let i=0;i<ph.pw*ph.ph;i++){const g=bin.charCodeAt(i)||0;img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=g;img.data[i*4+3]=255;}ctx.putImageData(img,0,0);u=c.toDataURL('image/png');photoUrls.set(key,u);return u;}
$('#photo').onclick=()=>$('#photoFile').click();
$('#photoFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{
  const bmp=await createImageBitmap(file),hs=hoopSize(documentNow().doc),wMm=Math.max(10,Math.min(80,hs.w-10)),hMm0=wMm*bmp.height/bmp.width,hMm=Math.min(hMm0,hs.h-10),w=hMm<hMm0?hMm*bmp.width/bmp.height:wMm,h=hMm;
  const pw=Math.max(8,Math.min(320,Math.round(w/.45))),ph=Math.max(8,Math.min(320,Math.round(pw*h/w))),c=document.createElement('canvas');
  c.width=pw;
  c.height=ph;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,pw,ph);
  ctx.drawImage(bmp,0,0,pw,ph);
  const px=ctx.getImageData(0,0,pw,ph).data,gray=new Uint8Array(pw*ph);
  for(let i=0;i<pw*ph;i++)gray[i]=Math.round(.299*px[i*4]+.587*px[i*4+1]+.114*px[i*4+2]);
  let bin='';
  for(let i=0;i<gray.length;i+=0x8000)bin+=String.fromCharCode(...gray.subarray(i,i+0x8000));
  const id=crypto.randomUUID();
  edit([{op:'add_shape',id,kind:'rect',name:'Photo',x:+(-w/2).toFixed(2),y:+(-h/2).toFixed(2),width:+w.toFixed(2),height:+h.toFixed(2)},{op:'set_object',id,photo:{pw,ph,data:btoa(bin),spacing:.7,contrast:1.4}}],()=>{setSelection({selected: id});setSelection({multi: new Set([id])});});
  toast('Photo stitch added. Adjust spacing and contrast in the sidebar.');
 }catch(err){toast(err.message||'That picture could not be read.');}};
const setPhoto=patch=>{const o=selectedObject();if(o?.photo)edit([{op:'set_object',id:o.id,photo:{...o.photo,...patch}}]);};
$('#photoSpacing').onchange=e=>setPhoto({spacing:Math.max(.3,Math.min(2,Number(e.target.value)||.7))});
$('#photoContrast').onchange=e=>setPhoto({contrast:Math.max(.4,Math.min(3,Number(e.target.value)||1.4))});
$('#photoInvert').onchange=e=>setPhoto({invert:e.target.checked});
$('#blendAngle').onchange=e=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,blendAngle:e.target.value===''?null:Number(e.target.value)}]);};
$('#selectMask').onclick=()=>{const o=selectedObject();if(o?.clipId&&documentNow().doc.objects.some(v=>v.id===o.clipId))selectIds([o.clipId],o.clipId);};
const photoThreadKeys=['thread2','thread3','thread4'];
for(const key of photoThreadKeys)$('#photo'+key[0].toUpperCase()+key.slice(1)).onchange=e=>{const o=selectedObject();if(!o?.photo)return;const ph={...o.photo};
  if(e.target.value)ph[key]=e.target.value;else for(const k of photoThreadKeys.slice(photoThreadKeys.indexOf(key)))delete ph[k];
  edit([{op:'set_object',id:o.id,photo:ph}]);};

// Image tracing: picture -> colour regions -> filled paths (with holes), grouped.
$('#traceBtn').onclick=()=>{$('#traceInfo').textContent='';$('#traceDialog').showModal();};
$('#traceMode').onchange=()=>{const lines=$('#traceMode').value==='lines';$('#traceColorsRow').hidden=lines;$('#traceBgRow').hidden=lines;};
$('#traceGo').onclick=async()=>{const file=$('#traceFile').files[0],info=$('#traceInfo');if(!file){info.textContent=t('Choose a picture first.');return;}
  try{info.textContent=t('Tracing…');await new Promise(r=>setTimeout(r,20));
    const bmp=await createImageBitmap(file),scale=Math.min(1,640/Math.max(bmp.width,bmp.height)),w=Math.max(2,Math.round(bmp.width*scale)),h=Math.max(2,Math.round(bmp.height*scale)),c=document.createElement('canvas');
    c.width=w;
    c.height=h;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bmp,0,0,w,h);
    const px=ctx.getImageData(0,0,w,h).data,hs0=hoopSize(documentNow().doc),wmm=Math.min(Number($('#traceWidth').value)||60,hs0.w-6);
    if($('#traceMode').value==='lines'){const lr=traceLines(px,w,h,{minLength:Math.max(5,w/70),detail:Number($('#traceDetail').value)>=1?1.4:.8});
      if(!lr.paths.length){info.textContent=t('Nothing to trace: no dark strokes were found.');return;}
      if(documentNow().doc.objects.length+lr.paths.length>100){info.textContent=t('The document would exceed 100 objects; trace with fewer colours or delete some objects first.');return;}
      const lo=traceLineOps(lr,{widthMm:wmm,maxHeightMm:hs0.h-6});
      $('#traceDialog').close();
      edit(lo.ops,()=>{setSelection({multi: new Set(lo.ids)});setSelection({selected: lo.ids[0]});});
      toast(t('Traced {n} strokes.',{n:lo.ids.length})+(lr.dropped?' '+t('{n} small regions were left out.',{n:lr.dropped}):''));
      return;
      }
    const result=traceImage(px,w,h,{colors:Number($('#traceColors').value)||6,detail:Number($('#traceDetail').value)||.5,background:$('#traceBg').checked?'auto':'none',minArea:Math.max(6,w*h/30000)});
    if(!result.regions.length){info.textContent=t('Nothing to trace: only the background colour was found.');return;}
    const hs=hoopSize(documentNow().doc),{ops,ids,running}=traceOps(result,{widthMm:Math.min(Number($('#traceWidth').value)||60,hs.w-6),maxHeightMm:hs.h-6});
    if(documentNow().doc.objects.length+ids.length>100){info.textContent=t('The document would exceed 100 objects; trace with fewer colours or delete some objects first.');return;}
    $('#traceDialog').close();
    edit(ops,()=>{setSelection({multi: new Set(ids)});setSelection({selected: ids[0]});});
    toast(t('Traced {n} shapes in {c} colours.',{n:ids.length,c:new Set(result.regions.map(g=>g.color)).size})+(result.dropped?' '+t('{n} small regions were left out.',{n:result.dropped}):'')+(running?' '+t('Thin regions sewn as running outline: {n}.',{n:running}):''));
  }catch(err){info.textContent=err.message||t('That picture could not be read.');}};

// Reference image: a picture under the shapes to draw over. Stored in the project, never sewn, never sent to the stitch worker or an agent.
function forWorker(d){const c=clone(d);delete c.reference;return c;}
function renderReference(){const layer=$('#refLayer');if(!layer)return;layer.replaceChildren();const r=documentNow().doc.reference;
  setStitchRow('refEmpty',Boolean(r));
setStitchRow('refControls',!r);
setStitchRow('refRemove',!r);$('#refLoad').textContent=t(r?'Replace picture…':'Load picture…');
  if(!r){setInteraction({refMoving: false});$('#art').classList.remove('ref-moving');return;}
  if(r.visible!==false&&viewMode.get()!=='preview'){const im=document.createElementNS(svgNS,'image');im.setAttribute('href',r.data);im.setAttribute('x',r.x);im.setAttribute('y',r.y);im.setAttribute('width',r.w);im.setAttribute('height',r.h);im.setAttribute('preserveAspectRatio','none');im.setAttribute('opacity',r.opacity??.5);layer.append(im);}
  const set=(id,v)=>{if(document.activeElement!==$(id))$(id).value=v;};
  set('#refOpacity',Math.round((r.opacity??.5)*100));
  setReferenceFields({refX:String(+r.x.toFixed(2)),refY:String(+r.y.toFixed(2)),refW:String(+r.w.toFixed(2)),refH:String(+r.h.toFixed(2))});
  setReferenceFields({refVisible:r.visible!==false,refLocked:Boolean(r.locked)});
  $('#refMove').disabled=Boolean(r.locked);
  if(r.locked){setInteraction({refMoving: false});$('#art').classList.remove('ref-moving');}$('#refMove').classList.toggle('armed',interactionNow().refMoving);
  }
async function loadReference(file){try{const bmp=await createImageBitmap(file),hs=hoopSize(documentNow().doc),scale=Math.min(1,1400/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale)),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);
  let q=.85,data=c.toDataURL('image/jpeg',q);while(data.length>1_200_000&&q>.4){q-=.1;data=c.toDataURL('image/jpeg',q);}
  if(data.length>1_400_000)throw Error(t('That picture is too large to keep in the project.'));
  const fit=Math.min((hs.w-4)/bmp.width,(hs.h-4)/bmp.height),mw=+(bmp.width*fit).toFixed(2),mh=+(bmp.height*fit).toFixed(2);
  edit([{op:'set_reference',data,x:+(-mw/2).toFixed(2),y:+(-mh/2).toFixed(2),w:mw,h:mh,opacity:documentNow().doc.reference?.opacity??.5,visible:true,locked:false,name:String(file.name||'picture').slice(0,200)}]);
  const d=$('#secRef');
  if(d)d.open=true;
  toast(t('Reference picture loaded. Draw on top of it; it is not sewn.'));
 }catch(err){toast(err.message||t('That picture could not be read.'));}}
$('#refLoad').onclick=()=>$('#refFile').click();
$('#refFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)loadReference(f);};
$('#refRemove').onclick=()=>edit([{op:'clear_reference'}]);
$('#refOpacity').oninput=e=>{const im=$('#refLayer image');if(im)im.setAttribute('opacity',Number(e.target.value)/100);};
$('#refOpacity').onchange=e=>edit([{op:'set_reference',opacity:Math.max(.05,Math.min(1,Number(e.target.value)/100))}]);
referenceActions.choose=(field,checked)=>edit([{op:'set_reference',...(field==='refVisible'?{visible:checked}:{locked:checked})}]);
referenceActions.commit=(field,text)=>{const r=documentNow().doc.reference;if(field==='refX'||field==='refY'){const key=field==='refX'?'x':'y';if(!Number.isFinite(Number(text)))return false;edit([{op:'set_reference',[key]:Number(text)}]);return;}if(field==='refW'){const w=Number(text);if(!(r&&w>=1))return false;edit([{op:'set_reference',w,h:+(r.h*w/r.w).toFixed(2)}]);return;}const h=Number(text);if(!(r&&h>=1))return false;edit([{op:'set_reference',h,w:+(r.w*h/r.h).toFixed(2)}]);};
$('#refFit').onclick=()=>{const r=documentNow().doc.reference;if(!r)return;const hs=hoopSize(documentNow().doc),f=Math.min((hs.w-4)/r.w,(hs.h-4)/r.h),w=+(r.w*f).toFixed(2),h=+(r.h*f).toFixed(2);edit([{op:'set_reference',x:+(-w/2).toFixed(2),y:+(-h/2).toFixed(2),w,h}]);};
$('#refMove').onclick=()=>{if(!documentNow().doc.reference||documentNow().doc.reference.locked)return;setInteraction({refMoving: !interactionNow().refMoving});$('#art').classList.toggle('ref-moving',interactionNow().refMoving);$('#refMove').classList.toggle('armed',interactionNow().refMoving);if(interactionNow().refMoving)toast(t('Drag on the canvas to move the picture. Press the button again to go back to drawing.'));};
$('#art').addEventListener('pointerdown',e=>{if(!interactionNow().refMoving||e.button!==0||!documentNow().doc.reference)return;e.preventDefault();e.stopImmediatePropagation();const r=documentNow().doc.reference,start=coord(e);setInteraction({refDrag: {start,x:r.x,y:r.y,pointerId:e.pointerId}});$('#art').setPointerCapture?.(e.pointerId);},true);
window.addEventListener('pointermove',e=>{if(!interactionNow().refDrag||e.pointerId!==interactionNow().refDrag.pointerId)return;const q=coord(e),im=$('#refLayer image');setInteraction({refDrag: {...interactionNow().refDrag, nx: interactionNow().refDrag.x+q[0]-interactionNow().refDrag.start[0]}});setInteraction({refDrag: {...interactionNow().refDrag, ny: interactionNow().refDrag.y+q[1]-interactionNow().refDrag.start[1]}});if(im){im.setAttribute('x',interactionNow().refDrag.nx);im.setAttribute('y',interactionNow().refDrag.ny);}});
window.addEventListener('pointerup',e=>{if(!interactionNow().refDrag||e.pointerId!==interactionNow().refDrag.pointerId)return;const d=interactionNow().refDrag;setInteraction({refDrag: null});if(d.nx!==undefined&&(Math.abs(d.nx-d.x)>.01||Math.abs(d.ny-d.y)>.01))edit([{op:'set_reference',x:+d.nx.toFixed(2),y:+d.ny.toFixed(2)}]);});
renderReference();

// What an agent gets for the reference picture: the placement in millimetres plus either the raw picture or an annotated view (the picture where it sits in the
// document, a millimetre grid with labels, the hoop outline, the origin and optionally the current shapes) so coordinates can be read straight off the image.
async function referenceForAgent({view='annotated',includeShapes=true}={}){
  const r=documentNow().doc.reference;if(!r)return {placement:null,hoop:hoopSize(documentNow().doc),image:null};
  const placement={x:r.x,y:r.y,w:r.w,h:r.h,opacity:r.opacity??.5,visible:r.visible!==false,locked:Boolean(r.locked),name:r.name||null},hs=hoopSize(documentNow().doc);
  if(view==='raw')return {placement,hoop:hs,image:r.data};
  const bmp=await createImageBitmap(await (await fetch(r.data)).blob()),m=6,x0=Math.min(-hs.w/2,r.x)-m,y0=Math.min(-hs.h/2,r.y)-m,x1=Math.max(hs.w/2,r.x+r.w)+m,y1=Math.max(hs.h/2,r.y+r.h)+m,W=x1-x0,H=y1-y0,scale=Math.min(1000/W,1000/H),cw=Math.round(W*scale),ch=Math.round(H*scale),c=document.createElement('canvas');
  c.width=cw;
  c.height=ch;
  const ctx=c.getContext('2d'),X=x=>(x-x0)*scale,Y=y=>(y-y0)*scale;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,cw,ch);ctx.drawImage(bmp,X(r.x),Y(r.y),r.w*scale,r.h*scale);
  ctx.lineWidth=1;ctx.font='12px sans-serif';ctx.textBaseline='top';
  for(let gx=Math.ceil(x0/10)*10;gx<=x1;gx+=10){const major=gx%20===0;ctx.strokeStyle=major?'rgba(0,90,120,.45)':'rgba(0,90,120,.18)';ctx.beginPath();ctx.moveTo(X(gx),0);ctx.lineTo(X(gx),ch);ctx.stroke();if(major){ctx.fillStyle='#04506a';ctx.fillText(String(gx),X(gx)+2,2);}}
  for(let gy=Math.ceil(y0/10)*10;gy<=y1;gy+=10){const major=gy%20===0;ctx.strokeStyle=major?'rgba(0,90,120,.45)':'rgba(0,90,120,.18)';ctx.beginPath();ctx.moveTo(0,Y(gy));ctx.lineTo(cw,Y(gy));ctx.stroke();if(major){ctx.fillStyle='#04506a';ctx.fillText(String(gy),2,Y(gy)+2);}}
  ctx.strokeStyle='#d03a2a';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(X(-hs.w/2),Y(-hs.h/2),hs.w*scale,hs.h*scale);ctx.setLineDash([]);
  ctx.strokeStyle='#d03a2a';
  ctx.beginPath();
  ctx.moveTo(X(0)-10,Y(0));
  ctx.lineTo(X(0)+10,Y(0));
  ctx.moveTo(X(0),Y(0)-10);
  ctx.lineTo(X(0),Y(0)+10);
  ctx.stroke();
  ctx.fillStyle='#d03a2a';
  ctx.fillText('0,0',X(0)+6,Y(0)+6);
  if(includeShapes)for(const o of documentNow().doc.objects){if(o.visible===false||o.kind==='stitch_layer')continue;let lines;try{lines=geometry(o,0);}catch{continue;}ctx.strokeStyle=o.thread||'#1c725d';ctx.lineWidth=2;for(const line of lines){if(line.length<2)continue;ctx.beginPath();line.forEach(([px,py],i)=>i?ctx.lineTo(X(px),Y(py)):ctx.moveTo(X(px),Y(py)));ctx.stroke();}}
  return {placement,hoop:hs,image:c.toDataURL('image/png'),imageBox:{x:+x0.toFixed(2),y:+y0.toFixed(2),w:+W.toFixed(2),h:+H.toFixed(2),pixelsPerMm:+scale.toFixed(3)}};
}

// One shared tooltip, fixed to the viewport and above everything: above the control when there is room, below otherwise, kept inside the window.
{const tip=document.createElement('div');tip.id='tooltip';tip.setAttribute('role','tooltip');document.body.append(tip);let current=null;
 const hide=()=>{current=null;tip.classList.remove('show');};
 const show=el=>{const text=el.dataset.tooltip;if(!text){hide();return;}current=el;tip.textContent=text;tip.style.left='0px';tip.style.top='0px';const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,vw=document.documentElement.clientWidth;let top=r.top-h-8;if(top<6)top=r.bottom+8;const left=Math.max(6,Math.min(vw-w-6,r.left+r.width/2-w/2));tip.style.left=Math.round(left)+'px';tip.style.top=Math.round(top)+'px';tip.classList.add('show');};
 document.addEventListener('pointerover',e=>{const el=e.target.closest?.('[data-tooltip]');if(el)show(el);else if(current)hide();});
 document.addEventListener('pointerleave',hide,true);
 document.addEventListener('pointerdown',hide,true);
 window.addEventListener('scroll',hide,true);
 window.addEventListener('blur',hide);
 document.addEventListener('focusin',e=>{if(e.target.matches?.('[data-tooltip]:focus-visible'))show(e.target);});
 document.addEventListener('focusout',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 }

// Sewing time: 600 stitches a minute, 20 s per colour change or stop, 8 s per trim.
function sewTime(p){const m=Math.max(1,Math.round(sewingSeconds(p)/60));return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min`;}

// Thread colours: a swatch button per colour select opens a palette (plus recent and custom colours); the select stays as the value holder.
const THREAD_PALETTE=[['White','#ffffff'],['Ivory','#f3ead7'],['Cream','#efe0b9'],['Light grey','#c9cccf'],['Silver','#a4a8ae'],['Grey','#7a7f87'],['Charcoal','#3f4349'],['Black','#111111'],
 ['Pale pink','#f6cbd4'],['Pink','#ec8fa7'],['Hot pink','#d9467f'],['Coral','#d9897e'],['Red','#c8281e'],['Cherry','#9c1b25'],['Burgundy','#6a1a2a'],['Rust','#a8452b'],
 ['Peach','#f4b183'],['Orange','#ec7a1c'],['Honey','#d3ad61'],['Gold','#c9962b'],['Yellow','#f2d21b'],['Lemon','#f7ec7a'],['Mustard','#b88a14'],['Tan','#c8a679'],
 ['Mint','#bfe3c9'],['Sage','#89a377'],['Lime','#9ccb3b'],['Green','#3f9b4f'],['Forest','#527461'],['Emerald','#1f7a52'],['Olive','#7a7a2d'],['Dark green','#1f4a33'],
 ['Baby blue','#bcd8ec'],['Sky','#6fb1e0'],['Turquoise','#28a7b0'],['Teal','#1f7f86'],['Blue','#2f6fc4'],['Royal','#2347a8'],['Navy','#17275c'],['Denim','#4a6a94'],
 ['Lavender','#c6b3e0'],['Lilac','#a37fcf'],['Purple','#6d3aa8'],['Plum','#5a2a58'],['Brown','#7a4a2a'],['Chocolate','#4a2c1b'],['Beige','#d9c3a0'],['Skin','#e8b894']];
const threadName=hex=>{const h=String(hex||'').toLowerCase(),e=THREAD_PALETTE.find(([,x])=>x===h);if(e)return t(e[0]);const rgb=v=>[1,3,5].map(i=>parseInt(v.slice(i,i+2),16));if(!/^#[0-9a-f]{6}$/.test(h))return h;const a=rgb(h);let best=null,bd=1e9;for(const [n,x] of THREAD_PALETTE){const b=rgb(x),d=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);if(d<bd){bd=d;best=n;}}return bd<28?t(best):h;};
const threadSelects=['#thread','#borderThread','#blendThread','#blendPalette0','#blendPalette1','#blendPalette2','#blendPalette3','#photoThread2','#photoThread3','#photoThread4'].map(id=>$(id)).filter(Boolean);
const pop=$('#threadPop');let popFor=null;
const recents=()=>{try{return JSON.parse(localStorage.getItem('welcome.threads.recent')||'[]').filter(h=>/^#[0-9a-f]{6}$/i.test(h)).slice(0,8);}catch{return [];}};
const remember=hex=>{try{localStorage.setItem('welcome.threads.recent',JSON.stringify([hex,...recents().filter(h=>h.toLowerCase()!==hex.toLowerCase())].slice(0,8)));}catch{}};
function pickThread(sel,hex){if(hex&&![...sel.options].some(o=>o.value.toLowerCase()===hex.toLowerCase()))sel.append(new Option(threadName(hex),hex));sel.value=hex;if(hex)remember(hex);closeThreadPop();sel.dispatchEvent(new Event('change',{bubbles:true}));syncThreads();}
function closeThreadPop(){pop.hidden=true;popFor=null;}
function openThreadPop(sel,btn){popFor=sel;pop.replaceChildren();const cur=(sel.value||'').toLowerCase(),title=document.createElement('h5');
  if([...sel.options].some(o=>o.value===''))pop.append(Object.assign(document.createElement('button'),{type:'button',className:'none-btn',textContent:t('None'),onclick:()=>pickThread(sel,'')}));
  const grid=document.createElement('div');
  grid.className='grid';
  for(const [n,hex] of THREAD_PALETTE){const b=document.createElement('button');b.type='button';b.style.background=hex;b.title=t(n);b.setAttribute('aria-label',t(n));b.setAttribute('aria-pressed',String(hex===cur));b.onclick=()=>pickThread(sel,hex);grid.append(b);}pop.append(grid);
  const rec=recents();
  if(rec.length){const h=document.createElement('h5');h.textContent=t('Recent');const g=document.createElement('div');g.className='grid';for(const hex of rec){const b=document.createElement('button');b.type='button';b.style.background=hex;b.title=hex;b.setAttribute('aria-label',hex);b.onclick=()=>pickThread(sel,hex);g.append(b);}pop.append(h,g);}
  const cu=document.createElement('div');
  cu.className='custom';
  const col=Object.assign(document.createElement('input'),{type:'color',value:/^#[0-9a-f]{6}$/.test(cur)?cur:'#527461',ariaLabel:t('Custom colour')}),txt=Object.assign(document.createElement('input'),{type:'text',value:/^#[0-9a-f]{6}$/.test(cur)?cur:'',placeholder:'#rrggbb',maxLength:7,ariaLabel:t('Hex colour')}),use=Object.assign(document.createElement('button'),{type:'button',textContent:t('Use')});
  col.oninput=()=>{txt.value=col.value;};
  use.onclick=()=>{const v=txt.value.trim().toLowerCase();if(/^#[0-9a-f]{6}$/.test(v))pickThread(sel,v);else txt.focus();};
  txt.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();use.click();}};
  cu.append(col,txt,use);
  pop.append(cu);
  pop.hidden=false;
  const r=btn.getBoundingClientRect(),h=pop.offsetHeight,vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
  pop.style.left=Math.max(6,Math.min(vw-pop.offsetWidth-6,r.right-pop.offsetWidth))+'px';
  pop.style.top=Math.max(6,r.bottom+6+h>vh?r.top-h-6:r.bottom+6)+'px';
  }
for(const sel of threadSelects){sel.classList.add('sr-only');sel.tabIndex=-1;const b=document.createElement('button');b.type='button';b.className='thread-btn';b.setAttribute('aria-haspopup','dialog');b.innerHTML='<span class="sw"></span><span class="nm"></span>';b.onclick=e=>{e.preventDefault();if(popFor===sel&&!pop.hidden)closeThreadPop();else openThreadPop(sel,b);};sel.after(b);}
function syncThreads(){for(const sel of threadSelects){const b=sel.nextElementSibling;if(!b?.classList.contains('thread-btn'))continue;const v=sel.value,sw=b.querySelector('.sw');sw.className=v?'sw':'sw none';sw.style.background=v||'';b.querySelector('.nm').textContent=v?threadName(v):t('None');b.disabled=sel.disabled;b.setAttribute('aria-label',(sel.closest('label')?.firstChild?.textContent||'').trim()+': '+(v?threadName(v):t('None')));}}
document.addEventListener('pointerdown',e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest?.('.thread-btn'))closeThreadPop();},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){e.stopImmediatePropagation();closeThreadPop();}},true);
threadsReady=true;syncThreads();

// Autosave: the design is kept in this browser (localStorage) after every edit, and offered back after a reload or crash. Saving a project file marks it clean.
{let timer=null,lastKey='';
 const write=()=>{try{const s=JSON.stringify({savedAt:Date.now(),clean:!documentNow().dirty,doc:documentNow().doc});if(documentNow().doc.revision>0&&s.length<4_500_000)localStorage.setItem('welcome.autosave',s);}catch{}};
 const schedule=()=>{const key=documentNow().doc.revision+'|'+documentNow().doc.name+'|'+documentNow().dirty;if(key===lastKey)return;lastKey=key;clearTimeout(timer);timer=setTimeout(write,700);};
 window.__autosaveHook=schedule;window.addEventListener('pagehide',write);
 const raw=(()=>{try{return localStorage.getItem('welcome.autosave');}catch{return null;}})();
 if(raw&&!new URL(location.href).searchParams.get('open')){try{const saved=JSON.parse(raw);validateDocument(clone(saved.doc));
   if(!saved.clean&&saved.doc.revision>0&&saved.doc.objects.length>0){const ago=Math.max(1,Math.round((Date.now()-saved.savedAt)/60000));setRestore({info:t('"{name}", {n} objects, edited {m} min ago.',{name:saved.doc.name,n:saved.doc.objects.length,m:ago})});restoreActions.yes=()=>{try{acceptProject(saved.doc);setDocument({dirty: true});render();}catch(err){toast(err.message);}setRestore({open:false});};restoreActions.no=()=>{try{localStorage.removeItem('welcome.autosave');}catch{}setRestore({open:false});};queueMicrotask(()=>setRestore({open:true}));}}catch{try{localStorage.removeItem('welcome.autosave');}catch{}}}
}

// Thread plan: the colours in sewing order with their stitch counts.
// The user's own thread stock, kept per browser as the text of the My threads box.
const STOCK_KEY='welcome.threadStock';
function threadStock(){try{return parseThreadStock(localStorage.getItem(STOCK_KEY)||'');}catch{return parseThreadStock('');}}
$('#threadStock').value=(()=>{try{return localStorage.getItem(STOCK_KEY)||'';}catch{return '';}})();
$('#threadStock').oninput=e=>{try{localStorage.setItem(STOCK_KEY,e.target.value);}catch{}renderPlan();};
function renderPlan(){const list=$('#planList');if(!list)return;list.replaceChildren();
setStitchRow('planEmpty',Boolean(plan));const stock=threadStock();
$('#threadStockInfo').textContent=stock.invalid||stock.colours.length?t('{n} threads, {m} lines ignored',{n:stock.colours.length,m:stock.invalid}):'';
if(!plan)return;const blocks=threadPlan(plan);
  blocks.slice(0,60).forEach((b,i)=>{const row=document.createElement('div');row.className='plan-row';const pick=document.createElement('select');pick.className='plan-replace';pick.title=t('Replace this thread everywhere');pick.setAttribute('aria-label',t('Replace this thread everywhere'));pick.append(new Option(t('Replace with…'),''));for(const [n,hex] of THREAD_PALETTE)pick.append(new Option(t(n),hex));pick.onchange=()=>{const from=b.thread,to=pick.value;if(!to)return;const count=documentNow().doc.objects.filter(o=>o.kind!=='stitch_layer'&&o.thread&&o.thread.toLowerCase()===from.toLowerCase()).length;edit([{op:'replace_thread',from,to}]);toast(t('Replaced {thread} in {n} objects.',{thread:from,n:count}));};const sw=document.createElement('span');sw.className='sw';sw.style.background=b.thread;const nm=document.createElement('span');nm.textContent=`${i+1}. ${threadName(b.thread)}`;const n=document.createElement('span');n.className='n';n.textContent=`${t('{n} stitches',{n:b.stitches.toLocaleString()})} · ${(b.mm/1000).toFixed(2)} m · ${blockTimeLabel(blockSeconds(b))}`;row.append(sw,nm,n);row.append(pick);const near=nearestStockThread(b.thread,stock.colours);if(near){const ms=document.createElement('span');ms.className='stock-match';const dot=document.createElement('span');dot.className='sw';dot.style.background=near.hex;ms.append(dot,` ${t('Closest of your threads')}: ${near.hex}`);row.append(ms);}list.append(row);});
  }
// Sewing worksheet: the thread plan as printable text or SVG. Compiles first when the plan is missing or older than the document.
$('#worksheetDownload').onclick=async e=>{e.preventDefault();if(!plan||plan.revision!==documentNow().doc.revision)await compileNow(true);if(!plan||plan.revision!==documentNow().doc.revision){toast(compileError||t('Compile the design first.'));return;}
  const fmt=$('#worksheetFormat').value,base=safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'');
  download(sewingWorksheet(documentNow().doc,plan,fmt),`${base}-worksheet.${fmt==='svg'?'svg':'txt'}`,fmt==='svg'?'image/svg+xml':'text/plain');
  toast(t('Sewing worksheet downloaded.'));
  };
// Copies the text worksheet of the current revision to the clipboard, compiling first when needed. Only the text form is copied; the SVG form stays a download.
$('#worksheetCopy').onclick=async e=>{e.preventDefault();if(!plan||plan.revision!==documentNow().doc.revision)await compileNow(true);if(!plan||plan.revision!==documentNow().doc.revision){toast(compileError||t('Compile the design first.'));return;}try{await navigator.clipboard.writeText(sewingWorksheet(documentNow().doc,plan,'text'));toast(t('Worksheet copied to the clipboard.'));}catch{toast(t('The browser did not allow copying. Use Download instead.'));}};
// Keyboard shortcuts

$('#helpBtn').onclick=()=>setShortcutsOpen(true);
document.addEventListener('keydown',e=>{if(e.key==='?'&&!e.ctrlKey&&!e.metaKey&&!canvasView.inField(e)&&!shortcutsState.get()){e.preventDefault();setShortcutsOpen(true);}});

// Copy / paste style: thread, stitch type and every stitching option, from one object to the selection.
const STYLE_KEYS=['thread','spacing','angle','stitchLength','stagger','underlayType','underlayInset','underlaySpacing','fillMethod','crossSize','border','borderThread','borderWidth','join','cap','blendThread','blendPalette','blendStart','blendEnd','blendAngle','compensation','runStyle','lengthVariance','underpath'];
const FILL_ONLY=new Set(['spacing','angle','stagger','fillMethod','crossSize','blendThread','blendPalette','blendStart','blendEnd','blendAngle','lengthVariance','underpath','border','borderThread','borderWidth']);
function copyStyle(){const o=selectedObject();if(!o||selState().multi.size!==1){toast(t('Select one object to copy its style from.'));return;}setClipboard({styleClip: {stitch:o.stitch,kind:o.kind,values:Object.fromEntries(STYLE_KEYS.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]))}});toast(t('Style copied. Paste it onto other objects with Ctrl+Alt+V.'));}
function pasteStyle(){if(!clipboardNow().styleClip){toast(t('Copy a style first (Ctrl+Alt+C).'));return;}const ops=[];
  for(const id of [...selState().multi]){const o=documentNow().doc.objects.find(v=>v.id===id);if(!o||o.kind==='stitch_layer'||o.id===undefined)continue;const filled=o.stitch==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed);
    const op={op:'set_object',id:o.id};
    const stitch=clipboardNow().styleClip.stitch==='satin'&&o.kind!=='path'?null:clipboardNow().styleClip.stitch;
    if(stitch&&stitch!==o.stitch&&o.kind!=='text')op.stitch=stitch;
    const willFill=(op.stitch||o.stitch)==='fill'&&o.kind!=='text'&&(o.kind!=='path'||o.closed);
    for(const k of STYLE_KEYS){if(FILL_ONLY.has(k)&&!willFill){if(o[k]!==undefined)op[k]=null;continue;}op[k]=clipboardNow().styleClip.values[k]!==undefined?clipboardNow().styleClip.values[k]:(o[k]!==undefined?null:undefined);if(op[k]===undefined)delete op[k];}
    if(o.kind==='text')for(const k of ['blendThread','blendPalette','blendStart','blendEnd','blendAngle'])delete op[k];
    ops.push(op);}
  if(ops.length)edit(ops);}
document.addEventListener('keydown',e=>{if(canvasView.inField(e))return;if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='c'){e.preventDefault();copyStyle();}else if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='v'){e.preventDefault();pasteStyle();}});

// Sewing tips: plain-language advice (too-small fills, very narrow satin, tiny lettering, duplicates ...) from the same checks agents get over MCP.
var tipsCache={rev:-1,key:'',list:[]};
// Sewing tips the user has switched off in the Tips settings list, kept per browser.
const TIPS_KEY='welcome.hiddenTips';
function hiddenTips(){try{const v=JSON.parse(localStorage.getItem(TIPS_KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}}
function sewingTips(){const key=documentNow().doc.revision+'|'+documentNow().doc.objects.length;if(!tipsCache||tipsCache.key!==key){let list=[];try{list=designWarnings(documentNow().doc);}catch{}tipsCache={key,list};}return visibleTips(tipsCache.list,hiddenTips());}
function buildTipsList(){const box=$('#tipsList');if(!box)return;const hidden=new Set(hiddenTips());box.replaceChildren();for(const c of TIP_CATEGORIES){const label=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=!hidden.has(c.id);cb.onchange=()=>{const off=new Set(hiddenTips());if(cb.checked)off.delete(c.id);else off.add(c.id);try{localStorage.setItem(TIPS_KEY,JSON.stringify([...off]));}catch{}render();};label.append(cb,' ',t(c.label));box.append(label);}}
buildTipsList();
function renderSewTips(tips){const box=$('#sewTips');if(!box)return;const mine=tips.filter(w=>selState().multi.has(w.id));box.replaceChildren();box.hidden=mine.length===0;if(!mine.length)return;const h=document.createElement('b');h.textContent=t('Sewing tips');box.append(h);for(const w of mine.slice(0,4)){const p=document.createElement('p');p.textContent=t(w.message);box.append(p);}}
