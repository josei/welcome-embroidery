import {createStore} from './store.js';

/** Whether the Organize fonts dialog is open. Its list is worked out each time it opens, when the bundled fonts' names are loaded. */
export const fontsDialogState = createStore<boolean>(false);

/** Sets whether the Organize fonts dialog is open. */
export function setFontsDialogOpen(open: boolean) {
 fontsDialogState.set(open);
}
