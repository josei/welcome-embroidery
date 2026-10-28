import {createStore} from './store.js';

/**
 * The satin end and pull values of the selected object: the end inset at each end and the pull on each rail, as text
 * (empty when unset). app.js sets them; the rows commit them through satinEndRowsActions.
 */
export interface SatinEndRows {
  endInsetStart: string;
  endInsetEnd: string;
  pullRight: string;
  pullLeft: string;
}

export const satinEndRowsState = createStore<SatinEndRows>({
  endInsetStart: '',
  endInsetEnd: '',
  pullRight: '',
  pullLeft: '',
});

/** Changes some of the satin end values. */
export function setSatinEndRows(patch: Partial<SatinEndRows>) {
  satinEndRowsState.set({...satinEndRowsState.get(), ...patch});
}

/** The rows call commit(field, text) when a value is committed. app.js runs the edit on the selected object. */
export const satinEndRowsActions: {commit: (field: keyof SatinEndRows, text: string) => void} = {
  commit() {},
};
