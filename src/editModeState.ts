import {createStore} from './store.js';

/** Whether the node editor is on: the canvas shows path nodes and their handles instead of object handles. */
export const editModeState = createStore(false);

/** The node-editor state. The canvas, the toolbar and the keyboard shortcuts read it. */
export function editModeNow(): boolean {
  return editModeState.get();
}

/** Turns the node editor on or off. */
export function setEditMode(on: boolean) {
  editModeState.set(on);
}
