import {createStore} from './store.js';

/**
 * The run values of the selected object: the laydown spacing, the stem width and the stitch length variation as text
 * (empty when unset), and whether underpath travel is on. app.js sets them; the rows commit them through runRowsActions.
 */
export interface RunRows {
  laydownSpacing: string;
  stemWidth: string;
  lengthVariance: string;
  underpath: boolean;
}

export const runRowsState = createStore<RunRows>({
  laydownSpacing: '',
  stemWidth: '',
  lengthVariance: '0',
  underpath: false,
});

/** Changes some of the run values. */
export function setRunRows(patch: Partial<RunRows>) {
  runRowsState.set({...runRowsState.get(), ...patch});
}

/** The rows call commit(field, text) for a committed number, and choose('underpath', checked) for the checkbox. app.js runs them. */
export const runRowsActions: {
  commit: (field: 'laydownSpacing' | 'stemWidth' | 'lengthVariance', text: string) => void;
  choose: (field: 'underpath', checked: boolean) => void;
} = {
  commit() {},
  choose() {},
};
