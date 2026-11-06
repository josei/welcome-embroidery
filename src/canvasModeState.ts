import {createStore} from './store.js';

/** Whether the hand tool is on: a drag pans the view instead of selecting. */
export const handModeState = createStore(false);

/** Whether the canvas is panning right now: the hand tool, a middle-button drag, space held or two fingers. */
export const panningState = createStore(false);

/** Whether a guide is being dragged off a ruler far enough that letting go deletes it. */
export const deletingGuideState = createStore(false);
