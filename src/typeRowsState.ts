import {createStore} from './store.js';

/**
 * The satin width and motif values of the selected object: the satin width, the motif spacing and the motif size, as text.
 * app.js sets them; the rows commit them through typeRowsActions.
 */
export interface TypeRows {
  satinWidth: string;
  motifSpacing: string;
  motifSize: string;
}

export const typeRowsState = createStore<TypeRows>({
  satinWidth: '3',
  motifSpacing: '4',
  motifSize: '1.6',
});

/** Changes some of the type row values. */
export function setTypeRows(patch: Partial<TypeRows>) {
  typeRowsState.set({...typeRowsState.get(), ...patch});
}

/** The rows call commit(field, text) when a value is committed. app.js runs the edit on the selected object. */
export const typeRowsActions: {commit: (field: keyof TypeRows, text: string) => void} = {
  commit() {},
};
