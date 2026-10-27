import {createStore} from './store.js';

/**
 * Transient editing state: the guide being drawn, a reference-picture move in progress, the text being edited on the canvas,
 * the object-list row being dragged, and the path node or reference picture being dragged. app.js changes it with setInteraction.
 */
/** A path node or handle being dragged: where the pointer went down, and the position as it moves. */
export interface PathNodeDrag {
  id: string;
  index: number;
  pointerId: number;
  element: Element;
  line?: Element | null;
  handle?: string;
  mirror?: boolean;
  start?: [number, number];
  group?: number[] | null;
  originals?: Array<[number, number]>;
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
}

/** A reference picture being moved: its start position and the pointer's start, with the new position as it moves. */
export interface RefDrag {
  start: [number, number];
  x: number;
  y: number;
  pointerId: number;
  nx?: number;
  ny?: number;
}

export interface Interaction {
  guideDraft: Array<[number, number]> | null;
  refMoving: boolean;
  canvasText: {id: string; original: string; ta: HTMLTextAreaElement} | null;
  dragLayer: string | null;
  nodeDrag: PathNodeDrag | null;
  refDrag: RefDrag | null;
}

export const interactionState = createStore<Interaction>({
  guideDraft: null,
  refMoving: false,
  canvasText: null,
  dragLayer: null,
  nodeDrag: null,
  refDrag: null,
});

/** The current transient editing state. Read it when needed; it is replaced on each change. */
export function interactionNow(): Interaction {
  return interactionState.get();
}

/** Changes some of the transient editing fields. */
export function setInteraction(patch: Partial<Interaction>) {
  interactionState.set({...interactionState.get(), ...patch});
}
