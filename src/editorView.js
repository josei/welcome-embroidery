// @ts-check
// The editor view: creates the canvas, draws the document and its controls, and keeps the stores the React inspector
// and simulation read in step with the document. app.js calls render after every change.
import {documentNow} from './documentState.js';
import {selState, setSelection} from './selectionState.js';
import {selectedObject, orderedIds, selectIds} from './selectionCommands.js';
import {syncInspector} from './inspector.js';
import {syncStitchPanel} from './stitchPanel.js';
import {syncBatchInfo} from './batchExport.js';
import {kickFontLoads, letteringTextFont, ensureFontLoaded, fitHeight} from './letteringFonts.js';
import {sewingTips, renderSewTips} from './sewingTips.js';
import {setStatus, statusActions} from './statusState.js';
import {setZoomPercent, configureZoom} from './zoomState.js';
import {createCanvas} from './canvas.js';
import {menuItems, configureContextMenu} from './contextMenu.js';
import {configureCanvasText, enterEdit} from './canvasText.js';
import {configureStitchPanel} from './stitchPanel.js';
import {configureReference} from './referencePicture.js';
import {toolMode} from './toolMode.js';
import {pivotState} from './pivotState.js';
import {knifeState} from './knifeState.js';
import {measureState} from './measureState.js';
import {editModeNow, setEditMode} from './editModeState.js';
import {gridSnapState} from './gridSnapState.js';
import {gridState} from './gridState.js';
import {getPlan, getCompileError, compileNow} from './compileService.js';
import {renderSimulation} from './simulation.js';
import {copyStyle, pasteStyle} from './styleClipboard.js';
import {edit} from './documentCommands.js';
import {editor} from './editorContext.js';

/** Draws everything that depends on the document or the plan. */
export function render() {
  syncBatchInfo();
  kickFontLoads();
  const selected = selState().selected;
  if (selected && !documentNow().doc.objects.some((/** @type {any} */ object) => object.id === selected)) setSelection({selected: null});
  setSelection(
    {multi:
    new Set([...selState().multi].filter((/** @type {string} */ id) => documentNow().doc.objects.some((/** @type {any} */ object) => object.id === id)))});
  const primary = selState().selected;
  if (primary && !selState().multi.has(primary)) setSelection({multi: new Set([primary])});
  else if (!primary && selState().multi.size) setSelection({selected: [...selState().multi][0]});
  const selNode = selState().selNode;
  if (selNode !== null && !(/** @type {any} */ (selectedObject())?.points?.[selNode])) setSelection({selNode: null});
  {
    const points = /** @type {any} */ (selectedObject())?.points;
    const nodes = selState().selNodes;
    setSelection({selNodes: new Set([...nodes].filter((/** @type {number} */ i) => points?.[i]))});
  }
  const canvas = editor.canvas;
  canvas?.drawScene();
  canvas?.drawControls();
  const tips = sewingTips();
  syncInspector({plan: getPlan(), compileError: getCompileError(), tips});
  renderSewTips(tips);
  syncStitchPanel();
  renderSimulation();
  canvas?.refresh();
}

/** Creates the canvas and wires its tools, context menu, text editor, reference layer and stitch panel. */
export function mountCanvas() {
  const canvas = createCanvas({
    svg: document.getElementById('art'),
    container: document.querySelector('.canvas'),
    overlay: document.getElementById('overlay'),
    doc: () => documentNow().doc,
    ids: orderedIds,
    tool: () => toolMode.get(),
    pivot: () => pivotState.get().pivot,
    knife: () => knifeState.get(),
    measure: () => measureState.get(),
    pickPivot: (/** @type {any} */ point) => {
      if (!pivotState.get().picking) return false;
      pivotState.set({pivot: [Math.round(point[0] * 10) / 10, Math.round(point[1] * 10) / 10], picking: false});
      render();
      canvas.refresh();
      return true;
    },
    snapPt: (/** @type {any} */ point) => canvas.snapPt(point),
    snapOn: () => gridSnapState.get(),
    gridSize: () => Number(gridState.get().value),
    isEditing: editModeNow,
    setEditing: setEditMode,
    selectedObject,
    textFont: letteringTextFont,
    ensureFontLoaded,
    fitHeight,
    select: selectIds,
    commit: (/** @type {any[]} */ operations, /** @type {any} */ after, /** @type {string} */ label) => edit(operations, after, undefined, label),
    render,
    toast: editor.toast,
    selectNodesIn: (/** @type {any} */ rect, /** @type {any} */ add) => {
      const object = /** @type {any} */ (selectedObject());
      if (object?.kind !== 'path') return;
      const inside = /** @type {number[]} */ (object.points.map((/** @type {any} */ point, /** @type {number} */ i) => [point, i])
        .filter((/** @type {any} */ [point]) => point[0] >= rect[0] && point[0] <= rect[2] && point[1] >= rect[1] && point[1] <= rect[3])
        .map((/** @type {any} */ [, i]) => i));
      setSelection({selNodes: new Set(add ? [...selState().selNodes, ...inside] : inside)});
      setSelection({selNode: inside.at(-1) ?? null});
      render();
    },
    dblclick: (/** @type {any} */ object, /** @type {any} */ point) => {
      if (object.kind === 'path' && editModeNow() && selState().selected === object.id) canvas.insertNodeAt(object, point);
      else enterEdit(object);
    },
    menuItems,
    onViewport: () => {
      canvas?.drawControls();
      setZoomPercent(`${canvas ? canvas.percent() : 100}%`);
    },
    zoomUi: configureZoom,
  });
  editor.canvas = canvas;
  canvas.fitHoop();
  configureContextMenu(
    {edit, copyStyle, pasteStyle, fitHoop: () => canvas.fitHoop(), fitAll: () => canvas.fitAll(), fitSelection: () => canvas.fitSelection()});
  configureCanvasText({edit, render, selectIds, setEditing: setEditMode, toScreen: (x, y) => /** @type {[number, number]} */ (canvas.toScreen(x, y))});
  configureReference({edit, toast: editor.toast, coord: event => canvas.coord(event)});
  configureStitchPanel({edit, orderedIds, toast: editor.toast});

  const art = /** @type {HTMLElement} */ (document.getElementById('art'));
  art.addEventListener('pointermove', event => {
    const point = canvas.coord(event);
    setStatus({cursor: `x ${point[0].toFixed(1)} mm · y ${point[1].toFixed(1)} mm`});
  });

  statusActions.compile = () => compileNow(true);
  let issueAt = 0;
  statusActions.issues = () => {
    const list = [...(getPlan()?.issues || []), ...sewingTips()];
    if (!list.length) return;
    const issue = list[issueAt++ % list.length];
    selectIds([...canvas.withGroup(issue.id)], issue.id);
    canvas.fitSelection();
  };
  editor.render = render;
}
