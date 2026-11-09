// @ts-check
// The editor bootstrap: it creates the document, wires the stores and command callbacks, mounts the modules that own
// the DOM and starts the first render and compile. Nothing here looks up, writes to or listens on the DOM.
import {editor} from './editorContext.js';
import {initializeDocument, edit, transact} from './documentCommands.js';
import {compile, configureCompile, compileNow, scheduleCompile} from './compileService.js';
import {resetPlayback, resetPlaybackIndex, stopPlayback, mountSimulation} from './simulation.js';
import {mountCanvas, render} from './editorView.js';
import {toast, mountEditorChrome} from './editorChrome.js';
import {mountKeyboard} from './keyboardShortcuts.js';
import {mountFileDrop} from './fileDrop.js';
import {mountPinGuide} from './pinGuideCommands.js';
import {mountThreadControls} from './threadControls.js';
import {mountAutosave} from './autosave.js';
import {mountSewingTips} from './sewingTips.js';
import {mountRowActions} from './stitchRowActions.js';
import {mountAgentBridge} from './agentBridge.js';
import {configureInspector} from './inspector.js';
import {configureLettering, ensureDocFonts, initFontPicker} from './letteringFonts.js';
import {configureArray} from './arrayState.js';
import {configureBatchExport} from './batchExport.js';
import {configureSewingOrder} from './sewingOrder.js';
import {configureShapePathActions} from './shapePathCommands.js';
import {configureSelectionToolbarActions} from './selectionToolbarCommands.js';
import {configureSelectionCommands} from './selectionCommands.js';
import {configureLayersCommands} from './layersCommands.js';
import {configureToolbarCommands, undoDocument} from './toolbarCommands.js';
import {configureHoopCommands} from './hoopCommands.js';
import {configureGrid} from './gridState.js';
import {configureGridSnap} from './gridSnapState.js';
import './toolbarSync.js';
import {configureProjectIO, openArtifact} from './projectIO.js';
import {configureExportCommands} from './exportCommands.js';
import {configureViewCommands} from './viewCommands.js';
import {configurePhotoCommands} from './photoCommands.js';
import {configureTraceCommands} from './traceCommands.js';
import {configureFontsDialog} from './fontsDialogCommands.js';

editor.toast = toast;
editor.edit = edit;
editor.render = render;

initializeDocument();
configureCompile({ensureFonts: ensureDocFonts, onClear: resetPlayback, onCompiled: resetPlaybackIndex});

configureSelectionCommands({edit, transact, render, toast, undo: undoDocument});
configureLayersCommands({edit});
configureToolbarCommands({
  edit,
  render,
  toast,
  clearComputed: compile.clearComputed,
  addShape: kind => editor.canvas.add(kind),
  clearSnapMarker: () => editor.canvas.showSnap(null),
});
configureHoopCommands({edit, fitHoop: () => editor.canvas?.fitHoop()});
configureGrid({render});
configureGridSnap({render, toast});
configureArray({edit, toast});
configureShapePathActions({edit, toast, render});
configureSelectionToolbarActions({edit});
configureSewingOrder({edit});
configureLettering({edit, transact, toast, render, reveal: () => editor.canvas?.revealSelection()});
configureFontsDialog({edit, toast});
configureProjectIO({
  clearComputed: compile.clearComputed,
  render,
  toast,
  edit,
  transact,
  request: compile.request,
  compileNow: () => compileNow(),
  fitAll: () => editor.canvas?.fitAll(),
  fitHoop: () => editor.canvas?.fitHoop(),
});
configureExportCommands({request: compile.request, ensureFonts: ensureDocFonts, toast, render, setPlan: next => compile.setPlan(next)});
configureViewCommands({
  hasPlan: () => Boolean(compile.getPlan()),
  stopPlayback,
  compile: () => compileNow(),
  render,
});
configurePhotoCommands({edit, toast});
configureTraceCommands({edit, toast});
configureInspector({edit, render, refreshCanvas: () => editor.canvas.refresh()});
configureBatchExport({request: compile.request, ensureFonts: ensureDocFonts, toast});

mountAgentBridge();
mountSimulation();
mountCanvas();
mountKeyboard();
mountFileDrop();
render();
const openId = new URL(location.href).searchParams.get('open');
if (openId) openArtifact(openId).catch(error => toast(error.message, 'error'));
mountPinGuide();
scheduleCompile(100);
mountEditorChrome();
mountThreadControls();
mountAutosave();
mountSewingTips();
mountRowActions();
initFontPicker();
