import {createStore} from './store.js';

/**
 * The row spacing and angle the fill rows show: the selected object's values, or the document's when nothing is
 * selected or the object has none. As text. app.js sets them; the rows commit them through fillValuesActions.
 */
export interface FillValues {
  spacing: string;
  angle: string;
}

export const fillValuesState = createStore<FillValues>({
  spacing: '0.4',
  angle: '32',
});

/** Changes some of the fill values. */
export function setFillValues(patch: Partial<FillValues>) {
  fillValuesState.set({...fillValuesState.get(), ...patch});
}

/** The fill rows call commit(field, text) when a value is committed. app.js edits the selected object, or the document. */
export const fillValuesActions: {commit: (field: keyof FillValues, text: string) => void} = {
  commit() {},
};
