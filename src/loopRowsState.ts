import {createStore} from './store.js';

/**
 * The motif loop values of the selected object: the loop shape, the loop size warp, and whether the object is a motif
 * path (which switches the warp options that need one). app.js sets them; the rows change them through loopRowsActions.
 */
export interface LoopRows {
  motifShape: string;
  motifWarp: string;
  motifAlong: boolean;
}

export const loopRowsState = createStore<LoopRows>({
  motifShape: 'circle',
  motifWarp: 'none',
  motifAlong: false,
});

/** Changes some of the motif loop values. */
export function setLoopRows(patch: Partial<LoopRows>) {
  loopRowsState.set({...loopRowsState.get(), ...patch});
}

/** The rows call choose(field, value) when a select changes. app.js runs the edit on the selected object. */
export const loopRowsActions: {choose: (field: 'motifShape' | 'motifWarp', value: string) => void} = {
  choose() {},
};
