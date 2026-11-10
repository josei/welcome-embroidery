import {createStore} from './store.js';

/**
 * Save feedback and the Save As name prompt. savedAt is the time of the last successful save in this tab (null until
 * one happens), and savedFileName the file that save wrote to. saveAsOpen opens the name prompt used by the download
 * fallback, which starts with saveAsName.
 */
export interface SaveState {
  savedAt: number | null;
  savedFileName: string | null;
  saveAsOpen: boolean;
  saveAsName: string;
}

export const saveState = createStore<SaveState>({savedAt: null, savedFileName: null, saveAsOpen: false, saveAsName: ''});

/** Changes some of the save fields. */
export function setSave(patch: Partial<SaveState>) {
  saveState.set({...saveState.get(), ...patch});
}
