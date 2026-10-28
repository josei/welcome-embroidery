import {createStore} from './store.js';

/**
 * The 3D preview's own state: whether the 3D view is on, whether the pull estimate is shown, and the line under the
 * checkbox that gives the estimate's peak. app.js sets threeD and note; the checkbox changes pull through previewActions.
 */
export interface PreviewState {
  threeD: boolean;
  pull: boolean;
  note: string;
}

export const previewState = createStore<PreviewState>({threeD: false, pull: false, note: ''});

/** Changes some of the preview values. */
export function setPreviewState(patch: Partial<PreviewState>) {
  previewState.set({...previewState.get(), ...patch});
}

/** The checkbox calls choosePull(checked). app.js runs it. */
export const previewActions: {choosePull: (checked: boolean) => void} = {
  choosePull() {},
};
