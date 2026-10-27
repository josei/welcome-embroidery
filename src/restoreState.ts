import {createStore} from './store.js';

/** The restore dialog: whether it is open, and the line that says what it would restore. app.js sets both at start-up. */
export interface RestoreDialogState {
  open: boolean;
  info: string;
}

export const restoreState = createStore<RestoreDialogState>({open: false, info: ''});

/** Changes some of the restore dialog fields. */
export function setRestore(patch: Partial<RestoreDialogState>) {
  restoreState.set({...restoreState.get(), ...patch});
}

/** The restore buttons call these. app.js runs them, because each one uses the saved document it read at start-up. */
export const restoreActions: {yes: () => void; no: () => void} = {
  yes() {},
  no() {},
};
