import {createStore} from './store.js';

/** The batch export fields: the names, one per line, the machine format, and the fit message shown under them. */
export interface BatchFields {
  names: string;
  format: string;
  info: string;
}

export const batchState = createStore<BatchFields>({names: '', format: 'jef', info: ''});

/** Changes some of the batch fields. */
export function setBatchFields(patch: Partial<BatchFields>) {
  batchState.set({...batchState.get(), ...patch});
}

/** The names in the box, one per line, trimmed; blank lines are dropped. */
export function batchNames(): string[] {
  return batchState.get().names.split('\n').map(v => v.trim()).filter(Boolean);
}
