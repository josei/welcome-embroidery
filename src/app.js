import {documentNow,setDocument} from './documentState.js';
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
import {setAgentLink} from './agentLinkState.js';
import {THREAD_PALETTE,threadName} from './threadPalette.js';
import {openThreadPopover,closeThreadPopover,threadPopoverState} from './threadPopoverState.js';
import {pathRowsActions} from './pathRowsState.js';
import {loopRowsActions} from './loopRowsState.js';
import {setThreadStock,threadStockActions} from './threadStockState.js';
import {radiusActions} from './radiusState.js';
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
import {viewMode} from './viewMode.js';
import {t} from './i18n.js';
import {createAgentBridge} from './agent.js';
import {createThreadPreview} from './preview3d.js';
import {previewState,setPreviewState,previewActions} from './previewState.js';
import {playbackActions,setPlayback} from './playbackState.js';
import {setSewingCounts} from './sewingCountsState.js';
import {sewTipActions,setSewTips} from './sewTipsState.js';
import {configureGrid,gridState} from './gridState.js';
import {createCanvas} from './canvas.js';
import {configureCanvasText, enterEdit} from './canvasText.js';
import {configureReference, referenceForAgent} from './referencePicture.js';
import {distortionGrid,blockSeconds,blockTimeLabel,bundledFontUsage,cornerRadii,parseThreadStock,nearestStockThread,customFontUsage,designWarnings,TIP_CATEGORIES,visibleTips,measureBetween,initialDocument,geometry,applyOperations,validateDocument,objectBounds,hoopSize,threadPlan,threadSpans,sewingSeconds,sewingSecondsUpTo,sewingWorksheet} from './engine.js';
import {clone,download,safeProjectFilename,sewTime,tipKey,forWorker} from './appHelpers.js';
import {configureProjectIO,openArtifact,restoreProject} from './projectIO.js';
import {configureExportCommands} from './exportCommands.js';
import {configureViewCommands} from './viewCommands.js';
import {configurePhotoCommands} from './photoCommands.js';
import {configureTraceCommands} from './traceCommands.js';
import {configureFontsDialog} from './fontsDialogCommands.js';
import {configureAgentDialog} from './agentDialog.js';
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
configureFontsDialog({edit, toast});
configureProjectIO({
 clearComputed, render, toast, edit, transact, request,
 compileNow:()=>compileNow(),
 fitAll:()=>canvasView?.fitAll(),
 fitHoop:()=>canvasView?.fitHoop(),
});
configureExportCommands({request, ensureFonts: ensureDocFonts, toast, render, setPlan:next=>{plan=next;}});
configureViewCommands({
 hasPlan:()=>Boolean(plan),
 stopPlayback:()=>{if(playbackTimer){clearInterval(playbackTimer);playbackTimer=null;}playIndex=null;},
 compile:()=>compileNow(),
 render,
});
configurePhotoCommands({edit, toast});
configureTraceCommands({edit, toast});
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
configureAgentDialog({bridge: agent, toast});
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
   if(!saved.clean&&saved.doc.revision>0&&saved.doc.objects.length>0){const ago=Math.max(1,Math.round((Date.now()-saved.savedAt)/60000));setRestore({info:t('"{name}", {n} objects, edited {m} min ago.',{name:saved.doc.name,n:saved.doc.objects.length,m:ago})});restoreActions.yes=()=>{restoreProject(saved.doc);setRestore({open:false});};restoreActions.no=()=>{try{localStorage.removeItem('welcome.autosave');}catch{}setRestore({open:false});};queueMicrotask(()=>setRestore({open:true}));}}catch{try{localStorage.removeItem('welcome.autosave');}catch{}}}
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
