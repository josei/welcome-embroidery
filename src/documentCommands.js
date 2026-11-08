// @ts-check
// The document transaction layer: one undo step per committed change, with the selection validated and the plan dropped.
import {documentNow, setDocument} from './documentState.js';
import {selState, setSelection} from './selectionState.js';
import {clone} from './appHelpers.js';
import {applyOperations, validateDocument, initialDocument} from './engine.js';
import {withSavedHoop} from './storedPrefs.js';
import {viewMode} from './viewMode.js';
import {clearComputed, compileNow} from './compileService.js';
import {editor} from './editorContext.js';

/**
 * The last live edit (typing that updates the canvas on each keystroke) and the document it left behind. The next live
 * edit with the same key, made on that same document, folds into the same undo step instead of adding another.
 * @type {{key: string, doc: any} | null}
 */
let liveEdit = null;

/**
 * Applies a change as one undo step. A rejected document restores the document and selection, then reports why.
 * A coalesceKey marks a live edit: consecutive edits with the same key share one undo step.
 * @param {() => void} fn
 * @param {string} [coalesceKey]
 * @returns {boolean}
 */
export function transact(fn, coalesceKey) {
  const before = clone(documentNow().doc), beforeSelected = selState().selected;
  const continuing = coalesceKey !== undefined && liveEdit !== null && liveEdit.key === coalesceKey && liveEdit.doc === documentNow().doc;
  try {
    fn();
    validateDocument(documentNow().doc);
  } catch (error) {
    liveEdit = null;
    setDocument({doc: before});
    setSelection({selected: beforeSelected});
    editor.render();
    editor.toast(/** @type {any} */ (error).message);
    return false;
  }
  const current = documentNow(), nextHistory = continuing ? current.history : [...current.history, before];
  if (nextHistory.length > 80) nextHistory.shift();
  setDocument({doc: {...current.doc, revision: before.revision + 1}, history: nextHistory, future: [], dirty: true});
  liveEdit = coalesceKey === undefined ? null : {key: coalesceKey, doc: documentNow().doc};
  clearComputed();
  editor.render();
  if (viewMode.get() === 'preview' && documentNow().doc.objects.length) compileNow();
  return true;
}

/**
 * Applies engine operations as one undo step, then runs an optional follow-up inside the same step.
 * @param {any[]} operations
 * @param {() => void} [after]
 * @param {string} [coalesceKey] live edits with the same key share one undo step (see transact)
 * @returns {boolean}
 */
export function edit(operations, after = () => {}, coalesceKey) {
  return transact(() => {
    applyOperations(/** @type {any} */ (documentNow().doc), operations);
    after();
  }, coalesceKey);
}

/**
 * Creates the first document, restored to the hoop this browser last saved. The sample is a template, not the user's
 * work: it starts clean, so New and Open do not ask to discard it until the first edit makes the document dirty.
 */
export function initializeDocument() {
  setDocument({doc: withSavedHoop(initialDocument()), history: [], future: [], dirty: false});
}
