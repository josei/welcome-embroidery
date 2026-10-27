import {createStore} from './store.js';

/** The copied objects (with a paste count, so repeated pastes offset) and the copied style. app.js changes it with setClipboard. */
export interface Clipboard {
  clipboard: {objects: Array<Record<string, unknown>>; pastes: number} | null;
  styleClip: {stitch: unknown; kind: unknown; values: Record<string, unknown>} | null;
}

export const clipboardState = createStore<Clipboard>({
  clipboard: null,
  styleClip: null,
});

/** The current clipboard and style clip. Read it when needed; it is replaced on each change. */
export function clipboardNow(): Clipboard {
  return clipboardState.get();
}

/** Changes some of the clipboard fields. */
export function setClipboard(patch: Partial<Clipboard>) {
  clipboardState.set({...clipboardState.get(), ...patch});
}
