import {createStore} from './store.js';

/**
 * Transient editing state: the guide being drawn, a reference-picture move in progress, the text being edited on the canvas,
 * and the object-list row being dragged. app.js changes it with setInteraction.
 */
export interface Interaction {
  guideDraft: Array<[number, number]> | null;
  refMoving: boolean;
  canvasText: {id: string; original: string; ta: HTMLTextAreaElement} | null;
  dragLayer: string | null;
}

export const interactionState = createStore<Interaction>({
  guideDraft: null,
  refMoving: false,
  canvasText: null,
  dragLayer: null,
});

/** The current transient editing state. Read it when needed; it is replaced on each change. */
export function interactionNow(): Interaction {
  return interactionState.get();
}

/** Changes some of the transient editing fields. */
export function setInteraction(patch: Partial<Interaction>) {
  interactionState.set({...interactionState.get(), ...patch});
}
