import {createStore} from './store.js';

/** The labels that depend on whether objects are selected: the hint shown when nothing is, and the stitch panel heading. app.js sets them. */
export interface SelectionLabels {
  hintHidden: boolean;
  stitchTitle: string;
}

export const selectionLabelsState = createStore<SelectionLabels>({
  hintHidden: false,
  stitchTitle: 'Stitching',
});

/** Changes some of the selection labels. */
export function setSelectionLabels(patch: Partial<SelectionLabels>) {
  selectionLabelsState.set({...selectionLabelsState.get(), ...patch});
}
