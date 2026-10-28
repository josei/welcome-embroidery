import {createStore} from './store.js';

/**
 * The path options of the selected object: whether it is closed and smooth, and whether the two boxes are disabled
 * (the selection is not a path). app.js sets them; the rows change them through pathRowsActions.
 */
export interface PathRows {
  closed: boolean;
  smooth: boolean;
  disabled: boolean;
}

export const pathRowsState = createStore<PathRows>({
  closed: false,
  smooth: false,
  disabled: false,
});

/** Changes some of the path values. */
export function setPathRows(patch: Partial<PathRows>) {
  pathRowsState.set({...pathRowsState.get(), ...patch});
}

/** The rows call choose(field, checked) when a box changes. app.js runs the edit on the selected object. */
export const pathRowsActions: {choose: (field: 'closed' | 'smooth', checked: boolean) => void} = {
  choose() {},
};
