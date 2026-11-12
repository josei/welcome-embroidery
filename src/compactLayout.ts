import {useSyncExternalStore} from 'react';

// Phone and tablet widths, landscape phones included (a 932x430 phone is wider than the phone-menu breakpoint). At these widths the
// grid and snap controls leave the canvas and live in the View menu (spec #468 sections 2 and 6).
const COMPACT_QUERY = '(max-width: 1100px)';

function subscribe(onChange: () => void) {
 const query = window.matchMedia(COMPACT_QUERY);
 query.addEventListener('change', onChange);
 return () => query.removeEventListener('change', onChange);
}

/** Whether the editor is at a phone or tablet width right now. */
export function useCompactLayout(): boolean {
 return useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT_QUERY).matches);
}
