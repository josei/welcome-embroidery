// @ts-check
// The editor bootstrap: it creates the document, wires the stores and command callbacks, mounts the modules that own
// the DOM and starts the first render and compile. Nothing here looks up, writes to or listens on the DOM.
import {editor} from './editorContext.js';
import {phoneSheetState} from './phoneSheetState.js';
import {inspectorOpenState} from './inspectorOpenState.js';
import {initializeDocument, edit, transact} from './documentCommands.js';
import {compile, configureCompile, compileNow, scheduleCompile, settleCompile} from './compileService.js';
import {resetPlayback, resetPlaybackIndex, stopPlayback, mountSimulation} from './simulation.js';
import {mountCanvas, render} from './editorView.js';
import {toast, mountEditorChrome} from './editorChrome.js';
import {mountKeyboard} from './keyboardShortcuts.js';
import {mountFileDrop} from './fileDrop.js';
import {mountPinGuide} from './pinGuideCommands.js';
import {mountThreadControls} from './threadControls.js';
import {mountAutosave} from './autosave.js';
import {mountDesktopClose} from './desktopClose.js';
import {documentState} from './documentState.js';
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
// Opening Layers or Properties on a phone covers the lower part of the canvas (a side sheet, the right part in landscape). The
// view pans, without zooming, so the selection sits clear of the sheet, and closing the sheet puts back the zoom and centre it
// had before. Switching from one sheet to the other starts again from that view. Waits a frame so the sheet is laid out before
// the canvas measures it.
/** @type {{cx: number, cy: number, s: number} | null} */
let viewBeforeSheet = null;
let lastSheet = 'none';
// The Properties button folds the right column on desktop and tablet landscape; the hoop is re-centred in the wider canvas
// when the column changes size. (Phone sheets do not use this path.)
inspectorOpenState.subscribe(() => editor.canvas?.recentreOnNextResize());
phoneSheetState.subscribe(() => {
  const sheet = phoneSheetState.get();
  if (sheet === lastSheet) return;
  if (lastSheet === 'none') viewBeforeSheet = editor.canvas?.viewport() ?? null;
  else if (viewBeforeSheet) editor.canvas?.setViewport(viewBeforeSheet);
  lastSheet = sheet;
  if (sheet === 'none') {
    viewBeforeSheet = null;
    return;
  }
  // Pan now, once the sheet is laid out, and again when its height transition ends, in case the sheet was still moving.
  // Layers on a portrait phone refits the design above the sheet; Properties, and Layers in landscape, only pan.
  const portrait = matchMedia('(orientation: portrait)').matches;
  // The first frame can run before the sheet is in the DOM, so the pan waits for it: measured without it, the view would
  // centre on the whole canvas and leave the design under the sheet.
  let frames = 0;
  const pan = () => {
    if (phoneSheetState.get() !== sheet) return;
    if (!document.querySelector('.layout>aside.panel.sheet-open') && frames++ < 30) {
      requestAnimationFrame(pan);
      return;
    }
    if (sheet === 'layers' && portrait) editor.canvas?.fitAboveSheet();
    else editor.canvas?.panToReveal();
  };
  requestAnimationFrame(pan);
  const sheetEl = document.querySelector('.layout>aside.panel.sheet-open');
  const onSettled = e => {
    if (e.target !== sheetEl) return;
    sheetEl.removeEventListener('transitionend', onSettled);
    pan();
  };
  sheetEl?.addEventListener('transitionend', onSettled);
  setTimeout(() => sheetEl?.removeEventListener('transitionend', onSettled), 400);
});
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
configureExportCommands({request: compile.request, ensureFonts: ensureDocFonts, toast, render, setPlan: next => compile.setPlan(next), settleCompile});
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
mountDesktopClose(() => editor.autosave?.flush(), documentState);
mountSewingTips();
mountRowActions();
initFontPicker();
