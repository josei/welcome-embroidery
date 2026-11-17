import {createStore} from './store.js';

/**
 * The thread totals of the last compiled plan: the colours sewn, the colour changes between them, and the thread length.
 * Null until the design compiles, and after a project is opened or a new design starts. The Layers heading reads it.
 */
export interface ThreadTotals {
  colours: number;
  changes: number;
  lengthMm: number;
}

export const threadTotalsState = createStore<ThreadTotals | null>(null);

/** Replaces the totals. */
export function setThreadTotals(totals: ThreadTotals | null) {
  threadTotalsState.set(totals);
}
