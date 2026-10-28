import {createStore} from './store.js';

/**
 * The cap rows' values for the selected object: the appliqué flag and its cover width, the pull compensation override,
 * and the width at the selected node. app.js sets them; the rows commit them through capRowsActions.
 */
export interface CapRows {
  applique: boolean;
  appliqueWidth: string;
  compensation: string;
  nodeWidth: string;
}

export const capRowsState = createStore<CapRows>({
  applique: false,
  appliqueWidth: '2.5',
  compensation: '',
  nodeWidth: '',
});

/** Changes some of the cap row values. */
export function setCapRows(patch: Partial<CapRows>) {
  capRowsState.set({...capRowsState.get(), ...patch});
}

/** The cap rows call commit(field, text) for a committed number, and choose('applique', checked) for the checkbox. app.js runs them. */
export const capRowsActions: {
  commit: (field: 'appliqueWidth' | 'compensation' | 'nodeWidth', text: string) => void;
  choose: (field: 'applique', checked: boolean) => void;
} = {
  commit() {},
  choose() {},
};
