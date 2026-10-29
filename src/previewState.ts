import {createStore} from './store.js';

/**
 * The 3D preview's own state: whether the 3D view is on, its view (front, close-up or turntable), whether the loupe is on,
 * whether the pull estimate is shown, and the line under the checkbox that gives the estimate's peak. app.js sets threeD and
 * note and passes view and loupe to the 3D canvas; the controls change them through previewActions.
 */
export type PreviewView = 'front' | 'close' | 'turntable';
export interface PreviewState {
  threeD: boolean;
  view: PreviewView;
  loupe: boolean;
  pull: boolean;
  note: string;
}

export const previewState = createStore<PreviewState>({threeD: false, view: 'front', loupe: false, pull: false, note: ''});

/** Changes some of the preview values. */
export function setPreviewState(patch: Partial<PreviewState>) {
  previewState.set({...previewState.get(), ...patch});
}

/** The controls call these. app.js runs them. */
export const previewActions: {
  choosePull: (checked: boolean) => void;
  chooseView: (view: PreviewView) => void;
  chooseLoupe: (on: boolean) => void;
} = {
  choosePull() {},
  chooseView() {},
  chooseLoupe() {},
};
