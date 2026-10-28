import {createStore} from './store.js';

/**
 * The thread stock box: the colours the user owns, as typed, and the line under it that says how many were read.
 * app.js loads the saved text and recomputes the line; the box changes the text through threadStockActions.
 */
export interface ThreadStock {
  text: string;
  info: string;
}

export const threadStockState = createStore<ThreadStock>({
  text: '',
  info: '',
});

/** Changes some of the thread stock values. */
export function setThreadStock(patch: Partial<ThreadStock>) {
  threadStockState.set({...threadStockState.get(), ...patch});
}

/** The box calls commit(text) on each change. app.js saves the text and redraws the plan. */
export const threadStockActions: {commit: (text: string) => void} = {
  commit() {},
};
