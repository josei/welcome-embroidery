import {createStore} from './store.js';

/**
 * The raised, buttonhole and edge options of the selected object: the raised-fill and raised-satin flags, the buttonhole
 * and edge-closing flags, and the raised underlay's spacing and angle as text. app.js sets them; the rows change them
 * through raisedRowsActions.
 */
export interface RaisedRows {
  fillRaised: boolean;
  satinRaised: boolean;
  satinButtonhole: boolean;
  edgeClose: boolean;
  raisedSpacing: string;
  raisedAngle: string;
}

export const raisedRowsState = createStore<RaisedRows>({
  fillRaised: false,
  satinRaised: false,
  satinButtonhole: false,
  edgeClose: false,
  raisedSpacing: '',
  raisedAngle: '',
});

/** Changes some of the raised option values. */
export function setRaisedRows(patch: Partial<RaisedRows>) {
  raisedRowsState.set({...raisedRowsState.get(), ...patch});
}

/** The rows call choose(field, checked) for a flag and commit(field, text) for a number. app.js runs the edits. */
export const raisedRowsActions: {
  choose: (field: 'fillRaised' | 'satinRaised' | 'satinButtonhole' | 'edgeClose', checked: boolean) => void;
  commit: (field: 'raisedSpacing' | 'raisedAngle', text: string) => void;
} = {
  choose() {},
  commit() {},
};
