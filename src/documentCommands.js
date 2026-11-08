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
 * Applies a change as one undo step. A rejected document restores the document and selection, then reports why.
 * @param {() => void} fn
 * @returns {boolean}
 */
export function transact(fn) {
  const before = clone(documentNow().doc), beforeSelected = selState().selected;
  try {
    fn();
    validateDocument(documentNow().doc);
  } catch (error) {
    setDocument({doc: before});
    setSelection({selected: beforeSelected});
    editor.render();
    editor.toast(/** @type {any} */ (error).message);
    return false;
  }
  const current = documentNow(), nextHistory = [...current.history, before];
  if (nextHistory.length > 80) nextHistory.shift();
  setDocument({doc: {...current.doc, revision: before.revision + 1}, history: nextHistory, future: [], dirty: true});
  clearComputed();
  editor.render();
  if (viewMode.get() === 'preview' && documentNow().doc.objects.length) compileNow();
  return true;
}

/**
 * Applies engine operations as one undo step, then runs an optional follow-up inside the same step.
 * @param {any[]} operations
 * @param {() => void} [after]
 * @returns {boolean}
 */
export function edit(operations, after = () => {}) {
  return transact(() => {
    applyOperations(/** @type {any} */ (documentNow().doc), operations);
    after();
  });
}

/**
 * Creates the first document, restored to the hoop this browser last saved. The sample is a template, not the user's
 * work: it starts clean, so New and Open do not ask to discard it until the first edit makes the document dirty.
 */
export function initializeDocument() {
  setDocument({doc: withSavedHoop(initialDocument()), history: [], future: [], dirty: false});
}
