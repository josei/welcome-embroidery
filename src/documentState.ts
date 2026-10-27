import {createStore} from './store.js';

/** The project document as engine.js builds it. Its fields are typed with the engine in a later step. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>;

/**
 * The open project: the current document, the snapshots that undo returns to, the snapshots that redo returns to,
 * and whether the document has changes not yet saved. app.js changes it with setDocument.
 */
export interface DocumentState {
  doc: Doc;
  history: Doc[];
  future: Doc[];
  dirty: boolean;
}

export const documentState = createStore<DocumentState>({
  doc: {},
  history: [],
  future: [],
  dirty: false,
});

/** The current document state. Read it when needed; it is replaced on each change. */
export function documentNow(): DocumentState {
  return documentState.get();
}

/** Changes some of the document state fields. */
export function setDocument(patch: Partial<DocumentState>) {
  documentState.set({...documentState.get(), ...patch});
}
