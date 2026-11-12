import {createStore} from './store.js';

/** Portrait tablets (601-1024 px wide): Properties is a drawer in its own column on the right, and a tap on the canvas closes it (issue #455). */
export const TABLET_DRAWER_QUERY = '(min-width: 601px) and (max-width: 1024px) and (orientation: portrait)';

/** Whether the window is a portrait tablet right now. The drawer starts closed there, so the object list is what a tablet shows first. */
export function isTabletDrawerWidth(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(TABLET_DRAWER_QUERY).matches;
}

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
