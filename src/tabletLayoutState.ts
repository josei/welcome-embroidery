import {useSyncExternalStore} from 'react';
import {createStore} from './store.js';
import {inspectorOpenState, TABLET_DRAWER_QUERY, toggleInspectorOpen} from './inspectorOpenState.js';

/** The tab shown at the top of the portrait-tablet inspector: the object list, or Properties. */
export type InspectorTab = 'layers' | 'properties';
export const inspectorTabState = createStore<InspectorTab>('layers');

/** Picks a tab and opens the inspector if it is folded, so the chosen tab is visible. */
export function selectInspectorTab(tab: InspectorTab) {
  inspectorTabState.set(tab);
  if (!inspectorOpenState.get()) toggleInspectorOpen();
}

function subscribeTablet(onChange: () => void) {
  const query = window.matchMedia(TABLET_DRAWER_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether the window is a portrait tablet right now (601-1024 px wide, taller than wide). The layout changes with it, not just the hiding. */
export function useTabletPortrait(): boolean {
  return useSyncExternalStore(subscribeTablet, () => window.matchMedia(TABLET_DRAWER_QUERY).matches);
}
