import {documentNow,setDocument,documentActions} from './documentState.js';
import {configureInspector, syncInspector} from './inspector.js';
import {configureLettering, ensureDocFonts, ensureFontLoaded, fitHeight, initFontPicker, kickFontLoads, letteringTextFont} from './letteringFonts.js';
import {setShortcutsOpen,shortcutsState} from './shortcutsState.js';
import {restoreActions,setRestore} from './restoreState.js';
import {configureStitchPanel, syncStitchPanel} from './stitchPanel.js';
import {configureArray} from './arrayState.js';
import {configureBatchExport, syncBatchInfo} from './batchExport.js';
import {configureSewingOrder, moveSelection} from './sewingOrder.js';
import {configureShapePathActions} from './shapePathCommands.js';
import {configureSelectionToolbarActions} from './selectionToolbarCommands.js';
import {stitchChoiceActions} from './stitchChoicesState.js';
import {capRowsActions} from './capRowsState.js';
import {blingRowsActions} from './blingRowsState.js';
import {satinEndRowsActions} from './satinEndRowsState.js';
import {runRowsActions} from './runRowsState.js';
import {accordionRowsActions} from './accordionRowsState.js';
import {typeRowsActions} from './typeRowsState.js';
import {raisedRowsActions} from './raisedRowsState.js';
import {fillValuesActions} from './fillValuesState.js';
import {agentLinkActions, setAgentLink} from './agentLinkState.js';
import {photoRowsActions} from './photoRowsState.js';
import {THREAD_PALETTE,threadName} from './threadPalette.js';
import {openThreadPopover,closeThreadPopover,threadPopoverState} from './threadPopoverState.js';
import {setFontsDialogOpen} from './fontsDialogState.js';
import {pathRowsActions} from './pathRowsState.js';
import {loopRowsActions} from './loopRowsState.js';
import {setThreadStock,threadStockActions} from './threadStockState.js';
import {radiusActions} from './radiusState.js';
import {setSettingsOpen} from './settingsState.js';
import {pathDraftNow,setPathDraft} from './pathDraftState.js';
import {interactionNow,setInteraction} from './interactionState.js';
import {clipboardNow,setClipboard} from './clipboardState.js';
import {selState,setSelection} from './selectionState.js';
import {editModeNow,setEditMode} from './editModeState.js';
import {configureSelectionCommands,copySelection,nudge,orderedIds,pasteClipboard,removeSelected,selectAll,selectIds,selectedObject} from './selectionCommands.js';
import {configureLayersCommands} from './layersCommands.js';
import {configureToolbarCommands} from './toolbarCommands.js';
import {configureContextMenu,menuItems} from './contextMenu.js';
import {configureHoopCommands} from './hoopCommands.js';
import {configureGridSnap,gridSnapState} from './gridSnapState.js';
import {configureZoom,setZoomPercent} from './zoomState.js';
import './toolbarSync.js';
import {setStatus,statusActions} from './statusState.js';
import {setStitchRow} from './stitchRowsState.js';
import {knifeState} from './knifeState.js';
import {measureState} from './measureState.js';
import {pinState,pinActions,pinClearActions} from './pinState.js';
import {pivotState} from './pivotState.js';
import {toolMode} from './toolMode.js';
import {viewMode,viewActions} from './viewMode.js';
import {dxfDocument,exportDxf} from './dxf.js';
import {t} from './i18n.js';
import {traceImage,traceOps,traceLines,traceLineOps} from './trace.js';
import {createAgentBridge} from './agent.js';
import {createThreadPreview} from './preview3d.js';
import {previewState,setPreviewState,previewActions} from './previewState.js';
import {exportFormatState} from './exportFormatState.js';
import {playbackActions,setPlayback} from './playbackState.js';
import {setSewingCounts} from './sewingCountsState.js';
import {sewTipActions,setSewTips} from './sewTipsState.js';
import {configureGrid,gridState} from './gridState.js';
import {createCanvas} from './canvas.js';
import {configureCanvasText, enterEdit} from './canvasText.js';
import {configureReference, referenceForAgent} from './referencePicture.js';
import {distortionGrid,blockSeconds,blockTimeLabel,bundledFontUsage,exportAppliqueTemplates,cornerRadii,svgPathFill,parseThreadStock,nearestStockThread,customFontUsage,exportPrintTemplate,designWarnings,TIP_CATEGORIES,visibleTips,measureBetween,initialDocument,geometry,applyOperations,validateDocument,parseSvgPath,makeStitchLayer,objectBounds,hoopSize,jefWarnings,exportSvg,threadPlan,threadSpans,sewingSeconds,sewingSecondsUpTo,sewingWorksheet} from './engine.js';
import {clone,download,safeProjectFilename,sewTime,tipKey,forWorker} from './appHelpers.js';
import {withSavedHoop,STOCK_KEY,threadStock,TIPS_KEY,hiddenTips,ignoredTipsKey,ignoredTips} from './storedPrefs.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],svgNS='http://www.w3.org/2000/svg';
setDocument({doc:withSavedHoop(initialDocument()),history:[],future:[],dirty:true});
let plan=null,worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),workerFailure=null,seq=0,generation=0,pending=new Map(),canvasView=null,playIndex=null,playbackTimer=null;
worker.onmessage=e=>{if(e.data.generation!==generation)return;const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.ok?p.resolve(e.data):p.reject(Error(e.data.error));};
function failPending(error){workerFailure??=error;for(const item of pending.values())item.reject(workerFailure);pending.clear();}
worker.addEventListener('error',e=>{e.preventDefault();failPending(Error(`Stitch worker failed to load or run${e.message?`: ${e.message}`:''}. Reload the editor and try again.`));});
worker.addEventListener('messageerror',()=>failPending(Error('The stitch worker returned data the editor could not read. Reload the editor and try again.')));
function request(data,transfer=[]){return new Promise((resolve,reject)=>{if(workerFailure){reject(workerFailure);return;}const id=++seq,version=generation;pending.set(id,{resolve,reject});try{worker.postMessage({id,generation:version,...data},transfer);}catch(error){pending.delete(id);reject(error);}});}
let lastPlan=null,compileError='',compileTimer=null,compiling=false;
function scheduleCompile(delay=450){clearTimeout(compileTimer);if(!documentNow().doc.objects.length||workerFailure){compileError='';return;}compileTimer=setTimeout(()=>compileNow(),delay);}
function clearComputed(){if(plan)lastPlan=plan;generation++;for(const item of pending.values())item.reject(new DOMException('The document changed.','AbortError'));pending.clear();if(playbackTimer)clearInterval(playbackTimer);playbackTimer=null;playIndex=null;plan=null;setSewingCounts({});syncPlaybackControls();scheduleCompile();}
function transact(fn){const before=clone(documentNow().doc),beforeSelected=selState().selected;try{fn();validateDocument(documentNow().doc);}catch(error){setDocument({doc:before});setSelection({selected: beforeSelected});render();toast(error.message);return false;}const current=documentNow(),nextHistory=[...current.history,before];if(nextHistory.length>80)nextHistory.shift();setDocument({doc:{...current.doc,revision:before.revision+1},history:nextHistory,future:[],dirty:true});clearComputed();render();if(viewMode.get()==='preview'&&documentNow().doc.objects.length)compileNow();return true;}
function edit(operations,after=()=>{}){return transact(()=>{applyOperations(documentNow().doc,operations);after();});}
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}
// The simulation bar (PlaybackBar.tsx) reads the playback store; this sets it from the plan and the playback position. Status text stays in statusState.
let spanCache={plan:null,spans:[],trims:0,metres:0,changes:0};
function planSpans(){if(spanCache.plan!==plan){const spans=plan?threadSpans(plan).map(s=>({...s,seconds:sewingSecondsUpTo(plan,s.start)})):[];spanCache={plan,spans,trims:plan?plan.stitches.filter(s=>s.cmd==='trim').length:0,metres:plan?threadPlan(plan).reduce((n,b)=>n+b.mm,0)/1000:0,changes:Math.max(0,spans.length-1)};}return spanCache;}
function syncPlaybackControls(){
 const cache=planSpans(),length=plan?.stitches.length||0,ready=playIndex===null,limit=ready?length:Math.min(playIndex,length);
 let sewn=0,current=null;for(let i=0;i<limit;i++){const item=plan.stitches[i];if(item.cmd==='stitch'){sewn++;current=item;}}
 setPlayback({hasPlan:Boolean(plan),ready,playing:Boolean(playbackTimer),index:limit,seekMax:Math.max(1,length),count:plan?.count||0,sewn,sewnSeconds:plan?sewingSecondsUpTo(plan,limit):0,totalSeconds:plan?sewingSeconds(plan):0,spans:cache.spans,colourChanges:cache.changes,trims:cache.trims,metres:cache.metres});
 if(!plan){setStatus({playback:'Ready to simulate',needle:''});return;}
 if(ready){setStatus({playback:`Ready · ${plan.count.toLocaleString()} stitches`,needle:''});return;}
 const percent=length?Math.floor(limit/length*100):0;
 setStatus({playback:`${sewn.toLocaleString()} / ${plan.count.toLocaleString()} stitches · ${percent}%`,needle:current?`Needle ${current.x.toFixed(1)}, ${current.y.toFixed(1)} mm`:'Needle at start'});
}
const preview3d=createThreadPreview($('#preview3d'));let preview3dPlan=null,pullFabric=null;
// The pull estimate: computed from the compiled plan and the fabric, and shown only while the 3D view and the checkbox are on.
function refreshPull(){const st=previewState.get(),doc=documentNow().doc;if(!st.pull||!st.threeD||!preview3dPlan){preview3d.setPull(null);if(st.note)setPreviewState({note:''});return;}const grid=distortionGrid(preview3dPlan,doc.settings.fabric??'woven',hoopSize(doc));preview3d.setPull(grid);setPreviewState({note:t('Peak estimate {n}% of the scale on {fabric}. Lines show the direction the fabric pulls. A guide for where to look: it uses stitch density, stitch direction and fabric stretch, not a simulation of the machine.',{n:Math.round(grid.peak*100),fabric:t(grid.label)})});}
previewActions.choosePull=checked=>{setPreviewState({pull:checked});refreshPull();};
previewActions.chooseView=view=>setPreviewState({view});
previewActions.chooseLoupe=on=>setPreviewState({loupe:on});
previewState.subscribe(()=>{if(!preview3d.available)return;const st=previewState.get();preview3d.setView(st.view);preview3d.setLoupe(st.loupe);});
function renderSimulation(){
 const root=$('#stitches');
 root.replaceChildren();
 const active=playIndex!==null,P=plan||(viewMode.get()==='stitches'&&!active&&lastPlan&&lastPlan.revision!==undefined?lastPlan:null),limit=P?(active?Math.min(playIndex,P.stitches.length):P.stitches.length):0;
 root.classList.toggle('stale',Boolean(P)&&!plan);
 let needle=null;
 if(P&&(viewMode.get()!=='design'||active)){const paths=new Map();let travel='',last=null,color=P.colors[0]||'#527461';for(let i=0;i<limit;i++){const item=P.stitches[i];if(item.cmd==='color'){color=item.thread||color;last={x:item.x,y:item.y};continue;}if(item.cmd==='jump'){if(last)travel+=`M${last.x},${last.y}L${item.x},${item.y}`;last=item;continue;}if(item.cmd==='trim'||item.cmd==='end') {last=null;continue;}if(item.cmd==='stop')continue;if(item.cmd==='stitch'){if(last){paths.set(color,(paths.get(color)||'')+`M${last.x},${last.y}L${item.x},${item.y}`);}last=item;needle=item;}}
  if(viewMode.get()==='preview'&&!active&&!preview3d.available){const layer=(cls,d,width,stroke,dx=0,dy=0)=>{const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);path.setAttribute('class',cls);path.setAttribute('stroke-width',width);if(stroke)path.style.stroke=stroke;if(dx||dy)path.setAttribute('transform',`translate(${dx} ${dy})`);return path;};for(const [,d] of paths)root.append(layer('thread-shadow',d,.5,null,.14,.2));for(const [thread,d] of paths){root.append(layer('thread-body',d,.4,thread));root.append(layer('thread-sheen',d,.1,null,-.07,-.09));}}
  else for(const [thread,d] of paths){const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);path.setAttribute('class','stitch-path');path.style.stroke=thread;root.append(path);}if(travel){const path=document.createElementNS(svgNS,'path');path.setAttribute('d',travel);path.setAttribute('class','stitch-path jump');root.append(path);}if(active&&needle){const marker=document.createElementNS(svgNS,'circle');marker.setAttribute('id','needleMarker');marker.setAttribute('cx',needle.x);marker.setAttribute('cy',needle.y);marker.setAttribute('r','1.2');root.append(marker);}}
 {const use3d=viewMode.get()==='preview'&&Boolean(plan)&&preview3d.available;setPreviewState({threeD:use3d});let fresh=false;if(use3d&&preview3dPlan!==plan){preview3d.setPlan(plan,hoopSize(documentNow().doc));preview3dPlan=plan;fresh=true;}if(use3d)preview3d.setLimit(active?playIndex:null);if(preview3d.available){preview3d.show(use3d);$('#art').style.visibility=use3d?'hidden':'';$('#controls').style.display=use3d?'none':$('#controls').style.display;}const fabricNow=documentNow().doc.settings.fabric??'woven';if(preview3d.available)preview3d.setFabric(fabricNow);if(use3d&&(fresh||fabricNow!==pullFabric)){pullFabric=fabricNow;refreshPull();}}
 if(segReady){if(threadsReady)syncThreads();}if(typeof renderPlan==='function'&&threadsReady)renderPlan();
 window.__autosaveHook?.();
 $('#shapes').style.opacity=viewMode.get()==='stitches'?.18:viewMode.get()==='preview'&&plan?0:viewMode.get()==='preview'?.55:1;
 $('#controls').style.display=viewMode.get()==='design'?'':'none';
 syncPlaybackControls();
}
configureBatchExport({request,ensureFonts:ensureDocFonts,toast});
function render(){syncBatchInfo();
 kickFontLoads();
 if(selState().selected&&!documentNow().doc.objects.some(o=>o.id===selState().selected))setSelection({selected: null});
 setSelection({multi: new Set([...selState().multi].filter(id=>documentNow().doc.objects.some(o=>o.id===id)))});
 if(selState().selected&&!selState().multi.has(selState().selected))setSelection({multi: new Set([selState().selected])});
 else if(!selState().selected&&selState().multi.size)setSelection({selected: [...selState().multi][0]});
 if(selState().selNode!==null&&!(selectedObject()?.points?.[selState().selNode]))setSelection({selNode: null});
 {const pts=selectedObject()?.points;setSelection({selNodes: new Set([...selState().selNodes].filter(i=>pts?.[i]))});}
 
 canvasView?.drawScene();
canvasView?.drawControls();
const tips=sewingTips();
syncInspector({plan,compileError,tips});
renderSewTips(tips);
 syncStitchPanel();
 renderSimulation();
 canvasView?.refresh();
}
let lastDown=null;



let segReady=false,threadsReady=false;
configureSelectionCommands({edit,transact,render,toast});
configureLayersCommands({edit});
configureToolbarCommands({edit,render,toast,clearComputed,addShape:kind=>canvasView.add(kind),clearSnapMarker:()=>canvasView.showSnap(null)});
configureHoopCommands({edit,fitHoop:()=>canvasView?.fitHoop()});
configureGrid({render});
configureGridSnap({render,toast});
configureArray({edit,toast});
configureShapePathActions({edit,toast,render});
configureSelectionToolbarActions({edit});
configureSewingOrder({edit});

configureLettering({edit, transact, toast, render});
$('#organizeFonts').onclick=()=>{setFontsDialogOpen(true);$('#fontsDialog').showModal();};
$('#removeUnusedFonts').onclick=()=>{const before=Object.keys(documentNow().doc.customFonts||{}).length;edit([{op:'remove_unused_fonts'}]);const removed=before-Object.keys(documentNow().doc.customFonts||{}).length;toast(removed?`Removed ${removed} unused font${removed===1?'':'s'}.`:'No unused fonts to remove.');};
configureInspector({edit, render, refreshCanvas:()=>canvasView.refresh()});

stitchChoiceActions.choose=(id,value)=>{if(id==='fillMethod'){const v=value==='rows'?null:value;if(selState().multi.size)edit(orderedIds().map(oid=>({op:'set_object',id:oid,fillMethod:v})));else edit([{op:'set_settings',fillMethod:v}]);return;}if(id==='cap'||id==='join'){const ids=[...selState().multi];if(ids.length)edit(ids.map(i=>({op:'set_object',id:i,[id]:value==='butt'&&id==='cap'||value==='round'&&id==='join'?null:value})));return;}if(id==='runStyle'){if(selState().selected)edit([{op:'set_object',id:selState().selected,runStyle:value==='single'?null:value}]);return;}if(id==='type'){if(selState().selected)edit([{op:'set_object',id:selState().selected,stitch:value}]);}};
capRowsActions.choose=(field,checked)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,applique:checked?true:null}]);};
runRowsActions.commit=(field,text)=>{if(field==='borderWidth'){const ids=[...selState().multi];if(ids.length)edit(ids.map(id=>({op:'set_object',id,borderWidth:Number(text)>0?Number(text):null})));return;}if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:field==='lengthVariance'?(Math.max(0,Math.min(50,Number(text)||0))/100||null):(text===''?null:Number(text))}]);};
runRowsActions.choose=(field,value)=>{if(field==='borderThread'){const o=selectedObject();if(o)edit([{op:'set_object',id:o.id,borderThread:value}]);return;}if(field==='border'){const o=selectedObject();if(o)edit([{op:'set_object',id:o.id,border:value}]);return;}if(field==='stagger'){const v=Number(value);if(selState().multi.size)edit(orderedIds().map(oid=>({op:'set_object',id:oid,stagger:v})));else edit([{op:'set_settings',stagger:v}]);return;}if(selState().selected)edit([{op:'set_object',id:selState().selected,underpath:value?null:false}]);};
radiusActions.commit=(field,text)=>{if(field==='radius'){if(selState().selected)edit([{op:'set_object',id:selState().selected,radius:Number(text)>0?Number(text):null}]);return;}const o=selectedObject();if(!o||o.kind!=='rect')return;const rr=cornerRadii(o),i=['radiusTL','radiusTR','radiusBR','radiusBL'].indexOf(field);rr[i]=Math.max(0,Math.min(500,Number(text)||0));edit([{op:'set_object',id:o.id,radii:rr}]);};
loopRowsActions.choose=(field,value)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:value}]);};
pathRowsActions.choose=(field,checked)=>{const o=selectedObject();if(!o)return;if(field==='closed'){edit([{op:'set_path',id:o.id,closed:checked},...(checked?[{op:'set_object',id:o.id,stitch:'fill'}]:[])]);return;}edit([{op:'set_path',id:o.id,smooth:checked}]);};
fillValuesActions.commit=(field,text)=>edit(selState().selected?[{op:'set_object',id:selState().selected,[field]:Number(text)}]:[{op:'set_settings',[field]:Number(text)}]);
raisedRowsActions.choose=(field,checked)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,...(field==='fillRaised'||field==='satinRaised'?{raised:checked}:field==='satinButtonhole'?{buttonhole:checked}:{edgeClose:checked})}]);};
raisedRowsActions.commit=(field,text)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:text===''?null:Number(text)}]);};
typeRowsActions.commit=(field,text)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:Number(text)}]);};
satinEndRowsActions.commit=(field,text)=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,[field]:text===''?null:Number(text)}]);};
capRowsActions.commit=(field,text)=>{if(field==='appliqueWidth'){if(selState().selected)edit([{op:'set_object',id:selState().selected,appliqueWidth:Number(text)}]);return;}if(field==='compensation'){if(selState().selected)edit([{op:'set_object',id:selState().selected,compensation:text===''?null:Number(text)}]);return;}const o=selectedObject();if(o&&selState().selNode!==null)edit([{op:'set_width_at_node',id:o.id,index:selState().selNode,width:Number(text)}]);};
blingRowsActions.choose=(field,value)=>{if(!selState().selected)return;if(field==='motifPair'){edit([{op:'set_object',id:selState().selected,motifPair:value,...(value?{satinWidth:selectedObject()?.satinWidth??4}:{})}]);return;}const v=field==='blingRings'?Number(value):value;edit([{op:'set_object',id:selState().selected,[field]:v}]);};
initFontPicker();

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
function projectSave(){setTimeout(()=>{try{const a=JSON.parse(localStorage.getItem('welcome.autosave')||'null');if(a){a.clean=true;localStorage.setItem('welcome.autosave',JSON.stringify(a));}}catch{}},0);download(JSON.stringify(documentNow().doc,null,2),safeProjectFilename(documentNow().doc.name),'application/json');setDocument({dirty: false});render();}
function acceptProject(next){validateDocument(next);const opened=clone(next);clearComputed();setDocument({doc: opened});setDocument({history: []});setDocument({future: []});setSelection({selected: documentNow().doc.objects[0]?.id||null});setSelection({multi: new Set(selState().selected?[selState().selected]:[])});setEditMode(false);setSelection({selNode: null});setDocument({dirty: false});render();canvasView?.fitAll();toast('Project opened locally.');}
async function openArtifact(id){if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid MCP project link.');let response=await fetch(`/artifacts/${id}.welcome`,{credentials:'same-origin',redirect:'error'});if(response.status===404)response=await fetch(`/artifacts/${id}.welcome`,{credentials:'same-origin',redirect:'error'});if(!response.ok)throw Error(`MCP project could not be opened (${response.status}).`);const next=await response.json();acceptProject(next);window.history.replaceState(null,'',location.pathname);}

documentActions.rename=text=>{const name=text.trim();if(!name){toast('Project name cannot be empty.');return false;}edit([{op:'rename_document',name}]);return true;};
$('#save').onclick=projectSave;
$('#new').onclick=()=>{setEditMode(false);if(documentNow().dirty&&!confirm(t('Discard unsaved changes?')))return;clearComputed();setDocument({doc: withSavedHoop({...initialDocument(),name:'Untitled design',objects:[]})});setDocument({history: []});setDocument({future: []});setSelection({selected: null});setSelection({multi: new Set()});setDocument({dirty: true});render();canvasView?.fitHoop();};
$('#open').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>33_554_432)throw Error('Welcome project files are limited to 32 MiB.');if(f.name.toLowerCase().endsWith('.svg')){acceptProject(importSvg(await f.text()));if(svgImportNotes.length)toast(svgImportNotes.join(' '));}else if((f.name.toLowerCase().endsWith('.welcome')||f.name.toLowerCase().endsWith('.welcome'))||f.name.toLowerCase().endsWith('.json'))acceptProject(JSON.parse(await f.text()));else if(f.name.toLowerCase().endsWith('.dxf')){const r=dxfDocument(await f.text());acceptProject(r.doc);const skipped=Object.entries(r.skipped).map(([k,n])=>`${n} ${k}`).join(', ');toast(`DXF imported: ${r.doc.objects.length} path${r.doc.objects.length===1?'':'s'}${skipped?`; skipped ${skipped}`:''}${r.bulged?`; ${r.bulged} arc${r.bulged===1?'':'s'} sewn as straight segments`:''}.`);}else throw Error('Open a .welcome project, SVG or ASCII DXF here. Use Import JEF / VP3 for machine files.');}catch(err){toast(err.message);}e.target.value='';};
$('#importMachine').onclick=()=>$('#machineFile').click();
$('#machineFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const lower=f.name.toLowerCase(),format=lower.endsWith('.jef')?'jef':lower.endsWith('.vp3')?'vp3':lower.endsWith('.dst')?'dst':lower.endsWith('.sew')?'sew':lower.endsWith('.pec')?'pec':lower.endsWith('.pes')?'pes':lower.endsWith('.exp')?'exp':lower.endsWith('.hus')?'hus':lower.endsWith('.xxx')?'xxx':lower.endsWith('.dsb')?'dsb':lower.endsWith('.dsz')?'dsz':lower.endsWith('.tap')?'tap':lower.endsWith('.tbf')?'tbf':lower.endsWith('.pcs')?'pcs':lower.endsWith('.shv')?'shv':lower.endsWith('.stx')?'stx':lower.endsWith('.bro')?'bro':lower.endsWith('.emd')?'emd':lower.endsWith('.ksm')?'ksm':lower.endsWith('.10o')?'10o':null;if(!format)throw Error(t('Choose a .jef, .vp3, .dst, .sew, .pec, .pes, .exp, .hus, .xxx, .dsb, .dsz, .tap, .tbf, .pcs, .shv, .stx, .bro, .emd, .ksm or .10o file.'));if(f.size>1_048_576)throw Error('Machine-file imports are limited to 1 MiB so original source bytes fit in the project.');const bytes=await f.arrayBuffer(),result=await request({type:'import',format,bytes,fileName:f.name},[bytes]);const layer=makeStitchLayer(result.decoded,format,{fileName:f.name,sha256:result.sha256,size:f.size,originalBytesBase64:result.sourceBytesBase64});const committed=transact(()=>{setDocument({doc:{...documentNow().doc,objects:[...documentNow().doc.objects,layer]}});setSelection({selected: layer.id});});if(committed){toast(`Imported ${f.name} as a ${format.toUpperCase()} stitch layer.`);compileNow();}}catch(err){toast(err.message);}e.target.value='';};
viewActions.choose=chosen=>{viewMode.set(chosen);if(chosen==='design'){if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;}playIndex=null;}if(chosen!=='design'&&!plan)compileNow();render();};
const MACHINE_FORMATS=['jef','vp3','dst','exp','pec','pes','pes6','sew','u01','xxx','tbf'];
function syncWorksheetRow(){$('#worksheetRow').hidden=!MACHINE_FORMATS.includes(exportFormatState.get().format);}
exportFormatState.subscribe(syncWorksheetRow);
$('#export').onclick=()=>{syncWorksheetRow();$('#exportDialog').showModal();};
$('#download').onclick=async e=>{e.preventDefault();await ensureDocFonts().catch(()=>{});if(exportFormatState.get().format==='dxf'){const r=exportDxf(documentNow().doc),skipped=Object.values(r.skipped).reduce((a,b)=>a+b,0);download(r.text,`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}.dxf`,'application/dxf');$('#exportDialog').close();toast(`DXF exported: ${r.count} path${r.count===1?'':'s'}${skipped?`; ${skipped} stitch layer${skipped===1?'':'s'} skipped (no outline)`:''}.`);return;}if(exportFormatState.get().format==='applique-print'){let svg;try{svg=exportAppliqueTemplates(documentNow().doc);}catch(err){toast(err.message);return;}download(svg,`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}-applique-templates.svg`,'image/svg+xml');$('#exportDialog').close();toast('Appliqué templates exported at 1:1. Print at 100% and check the 10 mm bar before cutting fabric.');return;}if(exportFormatState.get().format==='print'){download(exportPrintTemplate(documentNow().doc),`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}-template.svg`,'image/svg+xml');$('#exportDialog').close();toast('Print template exported at 1:1. Print it at 100% and check the 10 mm bar before placing fabric.');return;}if(exportFormatState.get().format==='svg'){download(exportSvg(documentNow().doc),`${safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'')}.svg`,'image/svg+xml');$('#exportDialog').close();toast('SVG exported (design only, not a stitch plan).');return;}try{const revision=documentNow().doc.revision,result=await request({type:'export',document:forWorker(documentNow().doc),format:exportFormatState.get().format,color:selectedObject()?.thread||'#527461'});if(result.plan.revision!==revision||revision!==documentNow().doc.revision)throw Error('The document changed during export. Export the current revision again.');plan=result.plan;const base=safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i,'');download(result.bytes,`${base}.${exportFormatState.get().format==='pes6'?'pes':exportFormatState.get().format}`, 'application/octet-stream');const withSheet=$('#worksheetRow').hidden===false&&$('#withWorksheet').checked,sheetFormat=$('#withWorksheetFormat').value;if(withSheet)download(sewingWorksheet(documentNow().doc,result.plan,sheetFormat),`${base}-worksheet.${sheetFormat==='svg'?'svg':'txt'}`,sheetFormat==='svg'?'image/svg+xml':'text/plain');render();$('#exportDialog').close();toast(t('{fmt} exported from revision {n}.',{fmt:exportFormatState.get().format.toUpperCase(),n:result.plan.revision})+(withSheet?t(' The sewing worksheet is downloaded with it.'):'')+jefWarnings(result.plan,exportFormatState.get().format).map(w=>' '+t(w)).join(''));}catch(err){if(err.name!=='AbortError')toast(err.message);}};
async function compileNow(manual=false){compiling=true;try{await ensureDocFonts();const revision=documentNow().doc.revision,result=await request({type:'compile',document:forWorker(documentNow().doc)});if(result.plan.revision!==revision||revision!==documentNow().doc.revision)return;plan=result.plan;lastPlan=plan;setSewingCounts(plan.objectCounts||{});compileError='';playIndex=null;compiling=false;render();}catch(err){if(err.name!=='AbortError'){compileError=err.message;compiling=false;render();if(manual===true||manual instanceof Event)toast(err.message);}}finally{if(!plan&&compileError)compiling=false;}}statusActions.compile=()=>compileNow(true);
let issueAt=0;
statusActions.issues=()=>{const list=[...(plan?.issues||[]),...sewingTips()];if(!list.length)return;const issue=list[issueAt++%list.length];selectIds([...canvasView.withGroup(issue.id)],issue.id);canvasView.fitSelection();};
playbackActions.seek=index=>{if(!plan)return;if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;}if(viewMode.get()==='design')viewMode.set('stitches');playIndex=index;render();};
playbackActions.togglePlay=async()=>{if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;render();return;}if(!plan)await compileNow(true);if(!plan)return;if(viewMode.get()==='design')viewMode.set('stitches');if(playIndex===null||playIndex>=plan.stitches.length)playIndex=0;playbackTimer=setInterval(()=>{playIndex=Math.min(plan.stitches.length,playIndex+Math.max(1,Math.ceil(plan.stitches.length/180)));if(playIndex>=plan.stitches.length){clearInterval(playbackTimer);playbackTimer=null;}render();},50);render();};
playbackActions.restart=()=>{if(playbackTimer)clearInterval(playbackTimer);playbackTimer=null;if(viewMode.get()==='design')viewMode.set('stitches');playIndex=0;render();};
$('#art').onpointermove=e=>{const p=canvasView.coord(e);setStatus({cursor:`x ${p[0].toFixed(1)} mm · y ${p[1].toFixed(1)} mm`});}
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
const agent=createAgentBridge({getReference:o=>referenceForAgent(o),getDocument:()=>{const c=clone(documentNow().doc);if(c.reference)c.reference={...c.reference,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',pictureOmitted:true};return c;},applyRemote,addLayerRemote,onChange:state=>{setAgentLink({statusText:`${t(agentTexts[state.status]||'')}${state.status==='active'?` ${t(state.agentCalls===1?'1 request so far.':`${state.agentCalls} requests so far.`)}`:''} ${state.message||''}`.trim(),url:state.mcpUrl||'',ready:Boolean(state.mcpUrl),waiting:state.status==='waiting'||state.status==='active',active:state.status==='active'});}});
async function openAgentDialog(){setSettingsOpen(false);$('#agentDialog').showModal();if(!agent.hasSession())await agent.start();}
$('#copyEndpoint').onclick=openAgentDialog;
agentLinkActions.open=openAgentDialog;
if(document.querySelector('meta[name="welcome-static"]'))setStitchRow('copyEndpoint',true);
$('#agentCopy').onclick=async()=>{const url=$('#agentUrl').value;try{await navigator.clipboard.writeText(url);toast('Copied the private MCP link.');}catch{$('#agentUrl').select();toast('Select and copy the link.');}};
$('#agentRevoke').onclick=async()=>{if(confirm(t('Revoke this link? Agents using it lose access immediately.')))await agent.revoke();};
$('#agentUrl').onfocus=e=>e.target.select();
agent.resume();
// ---- canvas: viewport, selection handles, marquee, context menu -------------------------------------------------
canvasView=createCanvas({svg:$('#art'),container:$('.canvas'),overlay:$('#overlay'),doc:()=>documentNow().doc,ids:orderedIds,tool:()=>toolMode.get(),pivot:()=>pivotState.get().pivot,knife:()=>knifeState.get(),measure:()=>measureState.get(),pickPivot:p=>{if(!pivotState.get().picking)return false;pivotState.set({pivot:[Math.round(p[0]*10)/10,Math.round(p[1]*10)/10],picking:false});render();canvasView.refresh();return true;},snapPt:p=>canvasView.snapPt(p),snapOn:()=>gridSnapState.get(),gridSize:()=>Number(gridState.get().value),isEditing:editModeNow,setEditing:setEditMode,selectedObject,textFont:letteringTextFont,ensureFontLoaded,fitHeight,
 select:selectIds,commit:(ops,after)=>edit(ops,after),render,toast,selectNodesIn:(r,add)=>{const o=selectedObject();if(o?.kind!=='path')return;const inside=o.points.map((p,i)=>[p,i]).filter(([p])=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3]).map(([,i])=>i);setSelection({selNodes: new Set(add?[...selState().selNodes,...inside]:inside)});setSelection({selNode: inside.at(-1)??null});render();},dblclick:(o,p)=>{canvasView.markObjectDblclick();if(o.kind==='path'&&editModeNow()&&selState().selected===o.id)canvasView.insertNodeAt(o,p);else enterEdit(o);},menuItems,
 onViewport:()=>{canvasView?.drawControls();setZoomPercent(`${canvasView?canvasView.percent():100}%`);},
 zoomUi:configureZoom});
canvasView.fitHoop();
configureContextMenu({edit,copyStyle,pasteStyle,fitHoop:()=>canvasView.fitHoop(),fitAll:()=>canvasView.fitAll(),fitSelection:()=>canvasView.fitSelection()});
configureCanvasText({edit,render,selectIds,setEditing:setEditMode,toScreen:(x,y)=>canvasView.toScreen(x,y)});
configureReference({edit,toast,coord:e=>canvasView.coord(e)});
configureStitchPanel({edit,orderedIds,toast});
// ---- keyboard ---------------------------------------------------------------------------------------------------
document.addEventListener('keydown',e=>{
 if(canvasView.inField(e))return;const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(mod&&key==='z'){e.preventDefault();(e.shiftKey?$('#redo'):$('#undo')).click();return;}if(mod&&key==='y'){e.preventDefault();$('#redo').click();return;}
 if(e.shiftKey&&!mod&&(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit0')){e.preventDefault();e.code==='Digit1'?canvasView.fitAll():e.code==='Digit2'?canvasView.fitSelection():canvasView.zoomTo100();return;}
 if(!mod&&(e.key==='+'||e.key==='=')){e.preventDefault();canvasView.zoomAt(1.25);return;}if(!mod&&(e.key==='-'||e.key==='_')&&!pathDraftNow().pathMode){e.preventDefault();canvasView.zoomAt(1/1.25);return;}
 if((!pathDraftNow().pathMode||pathDraftNow().pathPoints.length===0)&&!mod&&!e.altKey&&!e.shiftKey){const map={v:'#select',r:'#rect',o:'#ellipse',l:'#line',g:'#polygon',s:'#star',p:'#pen',n:'#path',t:'#letter',m:'#measure',k:'#knife'};if(map[key]){e.preventDefault();$(map[key]).click();return;}}
 if(toolMode.get()==='knife'&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();if(e.key==='Escape'){canvasView.setTool('select');return;}if(knifeState.get().length<2){toast(t('Click at least two points along the cut, then Enter.'));return;}const o=selectedObject(),points=knifeState.get();knifeState.set([]);canvasView.setTool('select');if(o)edit([{op:'knife',id:o.id,points}]);return;}
if(pathDraftNow().pathMode){if(e.key==='Enter'){e.preventDefault();canvasView.endPath();}else if(e.key==='Escape')canvasView.endPath(false,true);else if(e.key==='Backspace'&&pathDraftNow().pathPoints.length){e.preventDefault();setPathDraft({pathPoints:pathDraftNow().pathPoints.slice(0,-1)});canvasView.drawPathPreview();}return;}
 if(mod&&key==='a'){e.preventDefault();selectAll();return;}
 if(mod&&!e.altKey&&key==='c'&&!e.shiftKey){e.preventDefault();copySelection();return;}if(mod&&!e.altKey&&key==='x'){e.preventDefault();if(copySelection())removeSelected();return;}if(mod&&!e.altKey&&key==='v'){e.preventDefault();pasteClipboard();return;}
 if(mod&&key==='d'){e.preventDefault();$('#duplicate').click();return;}if(mod&&key==='g'){e.preventDefault();(e.shiftKey?$('#ungroup'):$('#group')).click();return;}
 if(mod&&e.shiftKey&&key==='c'){e.preventDefault();const ids=orderedIds().filter(id=>{const o=documentNow().doc.objects.find(v=>v.id===id);return o.kind!=='path'&&o.kind!=='stitch_layer';});if(ids.length)edit([{op:'to_path',ids}]);return;}
 if(e.key==='Enter'&&selState().multi.size===1){e.preventDefault();enterEdit(selectedObject());return;}
 if(e.key==='[')return moveSelection('backward');
 if(e.key===']')return moveSelection('forward');
 if(e.key==='Home'&&selState().multi.size){e.preventDefault();return moveSelection('back');}if(e.key==='End'&&selState().multi.size){e.preventDefault();return moveSelection('front');}
 if(e.key.startsWith('Arrow')&&selState().multi.size&&mod&&!editModeNow()){e.preventDefault();const ids=orderedIds(),bs=documentNow().doc.objects.filter(o=>ids.includes(o.id)).map(objectBounds),x0=Math.min(...bs.map(b=>b[0])),y0=Math.min(...bs.map(b=>b[1])),W=Math.max(...bs.map(b=>b[2]))-x0,H=Math.max(...bs.map(b=>b[3]))-y0,step=e.shiftKey?5:1;
  if(e.altKey){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const a=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?15:1);edit([{op:'rotate',ids,angle:a,cx:x0+W/2,cy:y0+H/2}]);}}
  else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const sx=Math.max(.02,(W+(e.key==='ArrowRight'?step:-step))/W);edit([{op:'scale',ids,sx,sy:1,ox:x0,oy:y0}]);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){const sy=Math.max(.02,(H+(e.key==='ArrowDown'?step:-step))/H);edit([{op:'scale',ids,sx:1,sy,ox:x0,oy:y0}]);}return;
  }
 if(e.key.startsWith('Arrow')&&selState().multi.size&&!mod){e.preventDefault();const step=e.altKey?.1:e.shiftKey?5:gridSnapState.get()?Number(gridState.get().value):1;nudge(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);return;}
 if((e.key==='Delete'||e.key==='Backspace')&&selState().selected){e.preventDefault();if(editModeNow()&&selState().selNode!==null)canvasView.deleteNode();else removeSelected();return;}
 if(e.key==='Escape'){if(toolMode.get()!=='select')canvasView.setTool('select');else if(editModeNow()){setEditMode(false);setSelection({selNode: null});render();}else{setSelection({selected: null});setSelection({multi: new Set()});setSelection({selNode: null});render();}}
});
render();
const openId=new URL(location.href).searchParams.get('open');if(openId)openArtifact(openId).catch(error=>toast(error.message));

// Start / end points: arm a button, then click the canvas. The point is stored as a fraction of the object's bounding box so it follows the object.
pinActions.press=key=>{pinState.set(pinState.get()===key?null:key);$('#art').classList.toggle('art-pin',!!pinState.get());if(pinState.get())toast(key==='startAt'?'Click the canvas to place the start point.':key==='endAt'?'Click the canvas to place the end point.':'Click the canvas to place the ripple centre.');};
pinClearActions.clear=()=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,startAt:null,endAt:null,rippleCenter:null}]);};
$('#art').addEventListener('pointerdown',e=>{if(!pinState.get()||e.button!==0)return;const o=selectedObject();if(!o){pinState.set(null);return;}e.preventDefault();e.stopImmediatePropagation();const p=canvasView.coord(e),b=objectBounds(o),w=b[2]-b[0]||1,h=b[3]-b[1]||1,key=pinState.get();pinState.set(null);$('#art').classList.remove('art-pin');edit([{op:'set_object',id:o.id,[key]:[Math.max(0,Math.min(1,+((p[0]-b[0])/w).toFixed(4))),Math.max(0,Math.min(1,+((p[1]-b[1])/h).toFixed(4)))]}]);},true);
scheduleCompile(100);

// Guided fill: Draw guide collects canvas clicks, the second press of the button commits them as the line the rows follow.
$('#guideDraw').onclick=()=>{const o=selectedObject();if(!o)return;if(interactionNow().guideDraft){const g=interactionNow().guideDraft;setInteraction({guideDraft: null});$('#art').classList.remove('art-pin');if(g.length>=2)edit([{op:'set_object',id:o.id,guide:g}]);else render();return;}setInteraction({guideDraft: []});pinState.set(null);$('#art').classList.add('art-pin');toast('Click points for the guide, then press Finish guide.');render();};
$('#guideClear').onclick=()=>{if(selState().selected)edit([{op:'set_object',id:selState().selected,guide:null}]);};
$('#art').addEventListener('pointerdown',e=>{if(!interactionNow().guideDraft||e.button!==0)return;const o=selectedObject();if(!o){setInteraction({guideDraft: null});return;}e.preventDefault();e.stopImmediatePropagation();const p=canvasView.coord(e),b=objectBounds(o),w=b[2]-b[0]||1,h=b[3]-b[1]||1;if(interactionNow().guideDraft.length<50)setInteraction({guideDraft:[...interactionNow().guideDraft,[+((p[0]-b[0])/w).toFixed(4),+((p[1]-b[1])/h).toFixed(4)]]});canvasView.drawControls();},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&interactionNow().guideDraft){setInteraction({guideDraft: null});$('#art').classList.remove('art-pin');render();}});

segReady=true;
for(const d of $$('details.sec-fold')){try{d.open=localStorage.getItem('welcome.fold.'+d.id)==='1';}catch{}d.addEventListener('toggle',()=>{try{localStorage.setItem('welcome.fold.'+d.id,d.open?'1':'0');}catch{}});}

// vector-editing extras: corner radius, taper, border width, follow path, round corners
// Each corner radius: the rectangle's four radii, with the one corner changed (top-left, top-right, bottom-right, bottom-left).














// Line ends and corners, per-node widths, colour blend, clipping masks




// Embroidery options: cross stitch size, run style, length variation, appliqué, per-object compensation





// Photo stitch: a picture becomes a rectangle with grey samples; the zigzag rows are planned at compile time.
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
photoRowsActions.commit=(field,text)=>setPhoto({[field]:field==='spacing'?Math.max(.3,Math.min(2,Number(text)||.7)):Math.max(.4,Math.min(3,Number(text)||1.4))});
photoRowsActions.choose=(field,checked)=>setPhoto({invert:checked});
$('#selectMask').onclick=()=>{const o=selectedObject();if(o?.clipId&&documentNow().doc.objects.some(v=>v.id===o.clipId))selectIds([o.clipId],o.clipId);};
const photoThreadKeys=['thread2','thread3','thread4'];
photoRowsActions.pickThread=(key,hex)=>{const o=selectedObject();if(!o?.photo)return;const ph={...o.photo};
  if(hex)ph[key]=hex;else for(const k of photoThreadKeys.slice(photoThreadKeys.indexOf(key)))delete ph[k];
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

// Thread colours: a swatch button per colour select opens a palette (plus recent and custom colours); the select stays as the value holder.
const threadSelects=['#thread','#blendThread','#blendPalette0','#blendPalette1','#blendPalette2','#blendPalette3'].map(id=>$(id)).filter(Boolean);
// The thread selects app.js still builds open the picker that ThreadPopover draws; a colour picked there is applied to the select.
function pickDomThread(sel,hex){if(hex&&![...sel.options].some(o=>o.value.toLowerCase()===hex.toLowerCase()))sel.append(new Option(threadName(hex),hex));sel.value=hex;sel.dispatchEvent(new Event('change',{bubbles:true}));syncThreads();}
for(const sel of threadSelects){sel.classList.add('sr-only');sel.tabIndex=-1;const b=document.createElement('button');b.type='button';b.className='thread-btn';b.setAttribute('aria-haspopup','dialog');b.innerHTML='<span class="sw"></span><span class="nm"></span>';b.onclick=e=>{e.preventDefault();if(threadPopoverState.get().owner?.id===sel.id)closeThreadPopover();else openThreadPopover({id:sel.id,value:sel.value,onPick:hex=>pickDomThread(sel,hex)},b.getBoundingClientRect());};sel.after(b);}
function syncThreads(){for(const sel of threadSelects){const b=sel.nextElementSibling;if(!b?.classList.contains('thread-btn'))continue;const v=sel.value,sw=b.querySelector('.sw');sw.className=v?'sw':'sw none';sw.style.background=v||'';b.querySelector('.nm').textContent=v?threadName(v):t('None');b.disabled=sel.disabled;b.setAttribute('aria-label',(sel.closest('label')?.firstChild?.textContent||'').trim()+': '+(v?threadName(v):t('None')));}}
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
setThreadStock({text:(()=>{try{return localStorage.getItem(STOCK_KEY)||'';}catch{return '';}})()});
threadStockActions.commit=text=>{setThreadStock({text});try{localStorage.setItem(STOCK_KEY,text);}catch{}renderPlan();};
function renderPlan(){const list=$('#planList');if(!list)return;list.replaceChildren();
setStitchRow('planEmpty',Boolean(plan));const stock=threadStock();
setThreadStock({info:stock.invalid||stock.colours.length?t('{n} threads, {m} lines ignored',{n:stock.colours.length,m:stock.invalid}):''});
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
// A tip is ignored for its object while its message is the same: the message carries the dimensions, so a changed object shows it again.
// Function declarations and var: render can run before this part of the module is reached, so these must already exist.
// Keyed on the document object: undo can give a document the same revision as an earlier state, so the revision is not a safe key.
function sewingTips(){const doc=documentNow().doc;if(!tipsCache||tipsCache.doc!==doc){let list=[];try{list=designWarnings(doc);}catch{}tipsCache={doc,list};}const ignored=ignoredTips();return visibleTips(tipsCache.list,hiddenTips()).filter(w=>!ignored.has(tipKey(w)));}
function buildTipsList(){const box=$('#tipsList');if(!box)return;const hidden=new Set(hiddenTips());box.replaceChildren();for(const c of TIP_CATEGORIES){const label=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=!hidden.has(c.id);cb.onchange=()=>{const off=new Set(hiddenTips());if(cb.checked)off.delete(c.id);else off.add(c.id);try{localStorage.setItem(TIPS_KEY,JSON.stringify([...off]));}catch{}render();};label.append(cb,' ',t(c.label));box.append(label);}}
buildTipsList();
// The card shows the selected objects' tips (at most four). Its buttons come back here by key.
var shownTips=new Map();
function renderSewTips(tips){const mine=tips.filter(w=>selState().multi.has(w.id)).slice(0,4);shownTips=new Map(mine.map(w=>[tipKey(w),w]));setSewTips(mine.map(w=>({key:tipKey(w),message:w.message,canFix:Boolean(w.fix)})));}
sewTipActions.fix=key=>{const w=shownTips.get(key);if(w?.fix)edit(w.fix);};
sewTipActions.ignore=key=>{
 const set=ignoredTips();set.add(key);
 try{localStorage.setItem(ignoredTipsKey(),JSON.stringify([...set].slice(-200)));}catch{}
 render();
};
