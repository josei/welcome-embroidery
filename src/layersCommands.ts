// The object list's actions: selecting, showing and hiding, locking, reordering and renaming. The list (ObjectList.tsx)
// calls them; they change the selection or the document through the same paths as the canvas.
import {documentNow} from './documentState.js';
import {layersActions} from './layersState.js';
import {selectIds} from './selectionCommands.js';
import type {SelectionObject} from './selectionCommands.js';

/** What the object list needs from the editor. */
export interface LayersApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
}

let api: LayersApi | null = null;

function wired(): LayersApi {
  if (!api) throw Error('The object list is not wired.');
  return api;
}

/** Wires the object list's actions, once. */
export function configureLayersCommands(next: LayersApi) {
  api = next;
  layersActions.select = (ids, primary) => selectIds(ids, primary);
  layersActions.setVisible = (ids, visible) => wired().edit(ids.map(id => ({op: 'set_object', id, visible})));
  layersActions.setLocked = (ids, locked) => wired().edit(ids.map(id => ({op: 'set_object', id, locked})));
  layersActions.reorder = (id, index) => wired().edit([{op: 'reorder', id, index}]);
  layersActions.rename = (id, text) => {
    const o = (documentNow().doc.objects as SelectionObject[]).find(v => v.id === id);
    const name = text?.trim();
    if (o && name && name !== o.name) wired().edit([{op: 'set_object', id, name}]);
  };
}
