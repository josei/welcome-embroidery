import {createStore} from './store.js';

/** Whether the Trace a picture dialog is open. Its button opens it; closing it, by Cancel or by a finished trace, clears it. */
export const traceDialogState = createStore<boolean>(false);

/** Sets whether the Trace a picture dialog is open. */
export function setTraceDialogOpen(open: boolean) {
  traceDialogState.set(open);
}
