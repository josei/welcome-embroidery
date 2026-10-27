import {createStore} from './store.js';

/** Which object and history actions are unavailable right now. app.js sets them as the selection and the history change. */
export interface ActionFlags {
  undo: boolean;
  redo: boolean;
  duplicate: boolean;
  group: boolean;
  ungroup: boolean;
  clip: boolean;
  unclip: boolean;
  textOnPath: boolean;
  textOffPath: boolean;
  editNodes: boolean;
}

export const actionState = createStore<ActionFlags>({
  undo: false,
  redo: false,
  duplicate: false,
  group: false,
  ungroup: false,
  clip: false,
  unclip: false,
  textOnPath: false,
  textOffPath: false,
  editNodes: false,
});

/** Changes some of the action flags. */
export function setActions(patch: Partial<ActionFlags>) {
  actionState.set({...actionState.get(), ...patch});
}
