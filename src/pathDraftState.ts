import {createStore} from './store.js';

/**
 * The path being drawn with the path or pen tool: its points and handles, the path it continues, the point under the
 * pointer, and the shape being dragged out. app.js changes it with setPathDraft.
 */
export interface PathDraft {
  pathMode: boolean;
  pathPoints: Array<[number, number]>;
  pathHandles: Array<{i: [number, number]; o: [number, number]} | null>;
  continueId: string | null;
  continueStitch: string | null;
  penDown: {index: number; pointerId: number} | null;
  shapeDrag: {start: [number, number]; end: [number, number]; pointerId: number} | null;
}

export const pathDraftState = createStore<PathDraft>({
  pathMode: false,
  pathPoints: [],
  pathHandles: [],
  continueId: null,
  continueStitch: null,
  penDown: null,
  shapeDrag: null,
});

/** The current path draft. Read it when needed; it is replaced on each change. */
export function pathDraftNow(): PathDraft {
  return pathDraftState.get();
}

/** Changes some of the path draft fields. */
export function setPathDraft(patch: Partial<PathDraft>) {
  pathDraftState.set({...pathDraftState.get(), ...patch});
}

/** The list with one entry replaced. The list passed in is not changed. */
export function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((item, i) => (i === index ? value : item));
}
