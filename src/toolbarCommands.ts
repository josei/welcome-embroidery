// The canvas toolbar's buttons: add a shape, group, ungroup, duplicate, delete, undo, redo, edit nodes and align or
import {t} from './i18n.js';
// distribute. Each runs the same edit, selection and history change as the id-wired handlers it replaces.
import {documentNow, setDocument} from './documentState.js';
import {selState, setSelection} from './selectionState.js';
import {alignActions} from './alignState.js';
import {snapObjState, snapObjActions} from './snapObjState.js';
import {enterEdit} from './canvasText.js';
import {clone} from './appHelpers.js';
import {removeSelected, selectedObject} from './selectionCommands.js';
import type {SelectionObject} from './selectionCommands.js';

/** What the toolbar needs from the editor. app.js calls configureToolbarCommands before the buttons can act. */
export interface ToolbarApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
  render(): void;
  toast(message: string, kind?: 'status' | 'error'): void;
  /** Drops the compiled plan and the playback position after a history change. */
  clearComputed(): void;
  /** Adds a new rectangle, ellipse or lettering object to the canvas. */
  addShape(kind: 'rect' | 'ellipse' | 'text'): void;
  /** Clears the object-snap marker. */
  clearSnapMarker(): void;
}

let api: ToolbarApi | null = null;

function wired(): ToolbarApi {
  if (!api) throw Error('The canvas toolbar is not wired.');
  return api;
}

function objects(): SelectionObject[] {
  return documentNow().doc.objects as SelectionObject[];
}

/** Groups the selection; needs two or more objects. */
export function groupSelection() {
  const ids = [...selState().multi];
  if (ids.length >= 2) wired().edit([{op: 'group', ids}]);
}

/** Ungroups the selection; keeps groups that only have one member. */
export function ungroupSelection() {
  const ids = [...selState().multi];
  if (ids.length) wired().edit([{op: 'ungroup', ids}]);
}

/** Duplicates the selection 3 mm down and right, regrouping the copies when every original was in one group. */
export function duplicateSelection() {
  const ids = [...selState().multi];
  if (!ids.length) return;
  const copies = ids.map(id => [id, crypto.randomUUID()] as const);
  const regroup = ids.length > 1
    && new Set(ids.map(id => objects().find(o => o.id === id)?.groupId)).size === 1
    && objects().find(o => o.id === ids[0])?.groupId;
  wired().edit([
    ...copies.map(([id, newId]) => ({op: 'duplicate', id, newId, dx: 3, dy: 3})),
    ...(regroup ? [{op: 'group', ids: copies.map(c => c[1])}] : []),
  ], () => {
    setSelection({multi: new Set(copies.map(c => c[1]))});
    setSelection({selected: copies.at(-1)?.[1] ?? null});
  });
}

/** Steps one snapshot back through the 80-step history. */
export function undoDocument() {
  const d = documentNow();
  if (!d.history.length) return;
  const prev = d.history.at(-1) ?? {};
  setDocument({doc: {...prev, revision: prev.revision + 1}, history: d.history.slice(0, -1), future: [...d.future, clone(d.doc)], dirty: true});
  wired().clearComputed();
  wired().render();
}

/** Steps one snapshot forward through the redo history. */
export function redoDocument() {
  const d = documentNow();
  if (!d.future.length) return;
  const next = d.future.at(-1) ?? {};
  setDocument({doc: {...next, revision: next.revision + 1}, history: [...d.history, clone(d.doc)], future: d.future.slice(0, -1), dirty: true});
  wired().clearComputed();
  wired().render();
}

/** Turns the node editor on for the single selected object, or says why it cannot. */
export function editSelectedNodes() {
  const o = selectedObject();
  if (o && selState().multi.size === 1) enterEdit(o);
  else wired().toast(t('Select one shape, path or lettering first.'));
}

/** The toolbar buttons and the context menu call these; the ids stay because keyboard shortcuts and tests address them. */
export const toolbarActions: {
  addShape: (kind: 'rect' | 'ellipse' | 'text') => void;
  group: () => void;
  ungroup: () => void;
  duplicate: () => void;
  remove: () => void;
  undo: () => void;
  redo: () => void;
  editNodes: () => void;
} = {
  addShape(kind) {
    wired().addShape(kind);
  },
  group: groupSelection,
  ungroup: ungroupSelection,
  duplicate: duplicateSelection,
  remove: removeSelected,
  undo: undoDocument,
  redo: redoDocument,
  editNodes: editSelectedNodes,
};

/** Wires the toolbar buttons, the align buttons and the snap-to-objects toggle, once. */
export function configureToolbarCommands(next: ToolbarApi) {
  api = next;
  alignActions.press = name => {
    const ids = [...selState().multi];
    if (name === 'horizontal' || name === 'vertical') {
      if (ids.length >= 3) wired().edit([{op: 'distribute', ids, axis: name}]);
      return;
    }
    if (!ids.length) return;
    wired().edit([{op: 'align', ids, edge: name, ...(ids.length === 1 ? {to: 'hoop'} : {})}]);
  };
  snapObjActions.toggle = () => {
    const on = !snapObjState.get();
    snapObjState.set(on);
    try {
      localStorage.setItem('welcome.snapObj', on ? '1' : '0');
    } catch {
      // The setting simply is not remembered when the browser refuses storage.
    }
    wired().clearSnapMarker();
    wired().toast(t(on ? 'Snapping to other objects on.' : 'Snapping to other objects off.'));
  };
}
