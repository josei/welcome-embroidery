import {createStore} from './store.js';

/**
 * The guide buttons' state: whether Clear guide is disabled (the selection has no guide), and the label and armed
 * state of the Draw guide button. stitchPanel.ts sets it from the selection; the accordion rows read it.
 */
export interface GuideButtons {
  clearDisabled: boolean;
  label: string;
  armed: boolean;
}

export const guideButtonState = createStore<GuideButtons>({
  clearDisabled: true,
  label: 'Draw guide',
  armed: false,
});

/** Changes the guide button state. */
export function setGuideButtons(patch: Partial<GuideButtons>) {
  guideButtonState.set({...guideButtonState.get(), ...patch});
}
