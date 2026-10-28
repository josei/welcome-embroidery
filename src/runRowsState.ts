import {createStore} from './store.js';

/**
 * The run values of the selected object: the laydown spacing, the stem width and the stitch length variation as text
 * (empty when unset), underpath travel, the needle stagger, and the border outline with whether its box is disabled. app.js sets them; the rows commit them through runRowsActions.
 */
export interface RunRows {
  laydownSpacing: string;
  stemWidth: string;
  lengthVariance: string;
  underpath: boolean;
  stagger: string;
  border: boolean;
  borderDisabled: boolean;
  borderWidth: string;
}

export const runRowsState = createStore<RunRows>({
  laydownSpacing: '',
  stemWidth: '',
  lengthVariance: '0',
  underpath: false,
  stagger: '4',
  border: false,
  borderDisabled: false,
  borderWidth: '0',
});

/** Changes some of the run values. */
export function setRunRows(patch: Partial<RunRows>) {
  runRowsState.set({...runRowsState.get(), ...patch});
}

/** The rows call commit(field, text) for a committed number, and choose(field, value) for a checkbox or the stagger choice. app.js runs them. */
export const runRowsActions: {
  commit: (field: 'laydownSpacing' | 'stemWidth' | 'lengthVariance' | 'borderWidth', text: string) => void;
  choose: (field: 'underpath' | 'border' | 'stagger', value: boolean | string) => void;
} = {
  commit() {},
  choose() {},
};
