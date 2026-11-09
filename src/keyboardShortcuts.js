// @ts-check
// Global keyboard shortcuts: undo/redo, view fitting and zoom, tool keys, knife and pen commits, clipboard, grouping,
// ordering, nudging and transforms, node deletion and Escape, plus the shortcuts dialog and style paste.
import {documentNow} from './documentState.js';
import {selState, setSelection} from './selectionState.js';
import {selectAll, copySelection, pasteClipboard, removeSelected, nudge, orderedIds, selectedObject} from './selectionCommands.js';
import {moveSelection} from './sewingOrder.js';
import {knifeState} from './knifeState.js';
import {pathDraftNow, setPathDraft} from './pathDraftState.js';
import {toolMode} from './toolMode.js';
import {editModeNow, setEditMode} from './editModeState.js';
import {gridSnapState} from './gridSnapState.js';
import {gridState} from './gridState.js';
import {shortcutsState, setShortcutsOpen} from './shortcutsState.js';
import {objectBounds} from './engine.js';
import {t} from './i18n.js';
import {enterEdit} from './canvasText.js';
import {copyStyle, pasteStyle} from './styleClipboard.js';
import {editor} from './editorContext.js';
import {projectSaveAs} from './projectIO.js';
import {TOOL_KEYS} from './shortcutTable.js';
import {focusStitchType} from './focusStitchType.js';

/** @param {string} id */
function press(id) {
  /** @type {HTMLElement | null} */ (document.getElementById(id))?.click();
}

/** Mounts the editor's keyboard handling. */
export function mountKeyboard() {
  // A toolbar button clicked with the mouse keeps focus, so a later Enter would go to it instead of starting node edit.
  // Release focus after mouse clicks only (detail > 0); keyboard activation keeps focus for keyboard users.
  document.addEventListener('click', e => {
    const button = /** @type {any} */ (e.target)?.closest?.('button');
    if (button && e.detail > 0 && !button.closest('.file-menu, .thread-btn')) button.blur();
  });
  // File shortcuts run the header buttons. Save also works while a text field has focus, as browsers' Save does;
  // Open and New wait until focus is outside fields so they never fire while typing. Ctrl+Shift+S is Save As.
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 's') { e.preventDefault(); if (e.shiftKey) void projectSaveAs(); else press('save'); return; }
    // Ctrl+Shift+E opens the export dialog (the same button as the Export button), not while a field has focus.
    if (key === 'e' && e.shiftKey && !editor.canvas.inField(e)) { e.preventDefault(); press('export'); return; }
    if (e.shiftKey || editor.canvas.inField(e)) return;
    if (key === 'o') { e.preventDefault(); press('open'); }
    else if (key === 'n') { e.preventDefault(); press('new'); }
  });

  document.addEventListener('keydown', e => {
    const canvas = editor.canvas;
    if (canvas.inField(e)) return;
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); press(e.shiftKey ? 'redo' : 'undo'); return; }
    if (mod && key === 'y') { e.preventDefault(); press('redo'); return; }
    if (e.shiftKey && !mod && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit0')) {
      e.preventDefault();
      e.code === 'Digit1' ? canvas.fitAll() : e.code === 'Digit2' ? canvas.fitSelection() : canvas.zoomTo100();
      return;
    }
    if (!mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); canvas.zoomAt(1.25); return; }
    if (!mod && (e.key === '-' || e.key === '_') && !pathDraftNow().pathMode) { e.preventDefault(); canvas.zoomAt(1 / 1.25); return; }
    if ((!pathDraftNow().pathMode || pathDraftNow().pathPoints.length === 0) && !mod && !e.altKey && !e.shiftKey) {
      if (TOOL_KEYS[key]) { e.preventDefault(); press(TOOL_KEYS[key]); return; }
    }
    if (toolMode.get() === 'knife' && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      if (e.key === 'Escape') { canvas.setTool('select'); return; }
      if (knifeState.get().length < 2) { editor.toast(t('Click at least two points along the cut, then Enter.')); return; }
      const object = selectedObject(), points = knifeState.get();
      knifeState.set([]);
      canvas.setTool('select');
      if (object) editor.edit([{op: 'knife', id: object.id, points}]);
      return;
    }
    if (pathDraftNow().pathMode) {
      if (e.key === 'Enter') { e.preventDefault(); canvas.endPath(); }
      else if (e.key === 'Escape') canvas.endPath(false, true);
      else if (e.key === 'Backspace' && pathDraftNow().pathPoints.length) {
        e.preventDefault();
        setPathDraft({pathPoints: pathDraftNow().pathPoints.slice(0, -1)});
        canvas.drawPathPreview();
      }
      return;
    }
    if (mod && key === 'a') { e.preventDefault(); selectAll(); return; }
    if (mod && !e.altKey && key === 'c' && !e.shiftKey) { e.preventDefault(); copySelection(); return; }
    if (mod && !e.altKey && key === 'x') { e.preventDefault(); if (copySelection()) removeSelected(); return; }
    if (mod && !e.altKey && key === 'v') { e.preventDefault(); pasteClipboard(); return; }
    if (mod && key === 'd') { e.preventDefault(); press('duplicate'); return; }
    if (mod && key === 'g') { e.preventDefault(); press(e.shiftKey ? 'ungroup' : 'group'); return; }
    if (mod && e.shiftKey && key === 'c') {
      e.preventDefault();
      const ids = orderedIds().filter(id => {
        const object = documentNow().doc.objects.find((/** @type {any} */ v) => v.id === id);
        return object?.kind !== 'path' && object?.kind !== 'stitch_layer';
      });
      if (ids.length) editor.edit([{op: 'to_path', ids}]);
      return;
    }
    // Enter on a focused button (menu bar, Thread button, toolbar) is left to that button's native activation;
    // only elsewhere does it start editing the selected object's nodes.
    if (e.key === 'Enter' && selState().multi.size === 1 && !(/** @type {any} */ (e.target))?.closest?.('button, .file-menu')) { e.preventDefault(); enterEdit(selectedObject()); return; }
    // I moves focus to the selected object's Stitch type control: the keyboard path to its settings, without Tabbing the tool row.
    if (key === 'i' && !mod && !e.altKey && !e.shiftKey && selState().selected && focusStitchType()) { e.preventDefault(); return; }
    if (e.key === '[') return moveSelection('backward');
    if (e.key === ']') return moveSelection('forward');
    if (e.key === 'Home' && selState().multi.size) { e.preventDefault(); return moveSelection('back'); }
    if (e.key === 'End' && selState().multi.size) { e.preventDefault(); return moveSelection('front'); }
    if (e.key.startsWith('Arrow') && selState().multi.size && mod && !editModeNow()) {
      e.preventDefault();
      const ids = orderedIds();
      const boxes = documentNow().doc.objects.filter((/** @type {any} */ object) => ids.includes(object.id)).map(objectBounds);
      const x0 = Math.min(...boxes.map((/** @type {any} */ b) => b[0])), y0 = Math.min(...boxes.map((/** @type {any} */ b) => b[1]));
      const width = Math.max(...boxes.map((/** @type {any} */ b) => b[2])) - x0, height = Math.max(...boxes.map((/** @type {any} */ b) => b[3])) - y0;
      const step = e.shiftKey ? 5 : 1;
      if (e.altKey) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const angle = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 15 : 1);
          editor.edit([{op: 'rotate', ids, angle, cx: x0 + width / 2, cy: y0 + height / 2}]);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const sx = Math.max(.02, (width + (e.key === 'ArrowRight' ? step : -step)) / width);
        editor.edit([{op: 'scale', ids, sx, sy: 1, ox: x0, oy: y0}]);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const sy = Math.max(.02, (height + (e.key === 'ArrowDown' ? step : -step)) / height);
        editor.edit([{op: 'scale', ids, sx: 1, sy, ox: x0, oy: y0}]);
      }
      return;
    }
    if (e.key.startsWith('Arrow') && selState().multi.size && !mod) {
      e.preventDefault();
      const step = e.altKey ? .1 : e.shiftKey ? 5 : gridSnapState.get() ? Number(gridState.get().value) : 1;
      nudge(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selState().selected) {
      e.preventDefault();
      if (editModeNow() && selState().selNode !== null) canvas.deleteNode(); else removeSelected();
      return;
    }
    if (e.key === 'Escape') {
      if (toolMode.get() !== 'select') canvas.setTool('select');
      else if (editModeNow()) { setEditMode(false); setSelection({selNode: null}); editor.render(); }
      else { setSelection({selected: null}); setSelection({multi: new Set()}); setSelection({selNode: null}); editor.render(); }
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !editor.canvas.inField(e) && !shortcutsState.get()) {
      e.preventDefault();
      setShortcutsOpen(true);
    }
  });

  document.addEventListener('keydown', e => {
    if (editor.canvas.inField(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyStyle(); }
    else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteStyle(); }
  });
}
