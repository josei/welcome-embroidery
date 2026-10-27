import {createStore} from './store.js';

/** The selection: the primary object, every selected object, and the selected path node and nodes. app.js changes it with setSelection. */
export interface Selection {
  selected: string | null;
  multi: Set<string>;
  selNode: number | null;
  selNodes: Set<number>;
}

export const selectionState = createStore<Selection>({
  selected: null,
  multi: new Set(),
  selNode: null,
  selNodes: new Set(),
});

/** The current selection. Read it when needed; do not keep the result, since it is replaced on each change. */
export function selState(): Selection {
  return selectionState.get();
}

/** Changes some of the selection fields. Sets are replaced, not edited in place, so every change is seen. */
export function setSelection(patch: Partial<Selection>) {
  selectionState.set({...selectionState.get(), ...patch});
}
