import {createStore} from './store.js';

/**
 * The satin end values of the selected object: the end inset at each end, the pull on each rail and the end width, as
 * text (empty when unset). app.js sets them; the rows commit them through satinEndRowsActions.
 */
export interface SatinEndRows {
  endInsetStart: string;
  endInsetEnd: string;
  pullRight: string;
  pullLeft: string;
  satinWidthEnd: string;
}

export const satinEndRowsState = createStore<SatinEndRows>({
  endInsetStart: '',
  endInsetEnd: '',
  pullRight: '',
  pullLeft: '',
  satinWidthEnd: '',
});

/** Changes some of the satin end values. */
export function setSatinEndRows(patch: Partial<SatinEndRows>) {
  satinEndRowsState.set({...satinEndRowsState.get(), ...patch});
}

/** The rows call commit(field, text) when a value is committed. app.js runs the edit on the selected object. */
export const satinEndRowsActions: {commit: (field: keyof SatinEndRows, text: string) => void} = {
  commit() {},
};
