import {createStore} from './store.js';

/**
 * Whether the inspector is open at the stacked widths (1100 px and narrower, and short touch screens), where it sits
 * below the canvas and the Properties button in the object list folds it away. Desktop always shows it as a column,
 * so this flag has no effect there.
 */
export const inspectorOpenState = createStore<boolean>(true);

/** Opens or folds the inspector. */
export function toggleInspectorOpen() {
  inspectorOpenState.set(!inspectorOpenState.get());
}
