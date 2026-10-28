import {createStore} from './store.js';

/**
 * The bling, bead, sequin and motif options of the selected object. app.js sets them; the rows commit them through
 * blingRowsActions. Defaults are what the rows show with nothing selected.
 */
export interface BlingRows {
  beadShape: string;
  beadTwin: boolean;
  blingRings: string;
  blingShape: string;
  motifPair: boolean;
  sequinTwin: boolean;
  stoneTurn: boolean;
}

export const blingRowsState = createStore<BlingRows>({
  beadShape: 'dash',
  beadTwin: false,
  blingRings: '2',
  blingShape: 'round',
  motifPair: false,
  sequinTwin: false,
  stoneTurn: true,
});

/** Changes some of the bling row values. */
export function setBlingRows(patch: Partial<BlingRows>) {
  blingRowsState.set({...blingRowsState.get(), ...patch});
}

/** The rows call choose(field, value) when a choice or a checkbox changes. app.js runs the edit on the selected object. */
export const blingRowsActions: {choose: (field: keyof BlingRows, value: boolean | string) => void} = {
  choose() {},
};
