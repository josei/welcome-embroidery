import {useSyncExternalStore} from 'react';
import {TABLET_PORTRAIT_QUERY} from './inspectorOpenState.js';

function subscribeTablet(onChange: () => void) {
  const query = window.matchMedia(TABLET_PORTRAIT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether the window is a portrait tablet right now (601-1024 px wide, taller than wide). The layout changes with it. */
export function useTabletPortrait(): boolean {
  return useSyncExternalStore(subscribeTablet, () => window.matchMedia(TABLET_PORTRAIT_QUERY).matches);
}
