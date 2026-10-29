import {createStore} from './store.js';

/**
 * The stitches each object makes in the last compiled plan, by object id (the engine's objectCounts). Empty until the
 * design compiles, and after the plan is dropped. app.js sets it when a plan arrives. The object list shows it.
 */
export const sewingCountsState = createStore<Record<string, number>>({});

/** Replaces the per-object counts. */
export function setSewingCounts(counts: Record<string, number>) {
  sewingCountsState.set(counts);
}
