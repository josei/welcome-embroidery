import {createStore} from './store.js';

/** Portrait tablets (601-1024 px wide, taller than wide): Layers and Properties share one right-hand column. */
export const TABLET_PORTRAIT_QUERY = '(min-width: 601px) and (max-width: 1024px) and (orientation: portrait)';

/**
 * Whether the inspector is open at the stacked widths (1100 px and narrower, and short touch screens), where it sits
 * below the canvas and the Properties button in the object list folds it away. Desktop and portrait tablets always show
 * it, so this flag has no effect there.
 */
export const inspectorOpenState = createStore<boolean>(true);

/** Opens or folds the inspector. */
export function toggleInspectorOpen() {
  inspectorOpenState.set(!inspectorOpenState.get());
}
