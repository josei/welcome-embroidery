import {createStore} from './store.js';

/** The guide buttons' state: whether Clear guide is disabled (the selection has no guide). app.js sets it from the selection. */
export interface GuideButtons {
  clearDisabled: boolean;
}

export const guideButtonState = createStore<GuideButtons>({
  clearDisabled: true,
});

/** Changes the guide button state. */
export function setGuideButtons(patch: Partial<GuideButtons>) {
  guideButtonState.set({...guideButtonState.get(), ...patch});
}
