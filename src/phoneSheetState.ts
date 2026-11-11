import {useSyncExternalStore} from 'react';
import {createStore} from './store.js';

/**
 * Which bottom sheet is open at phone widths (600 px and narrower): Layers, Properties, or neither. Only one sheet is open at a
 * time, so opening one closes the other. The sheets are hidden by CSS at every other width, so this value has no effect there.
 */
export type PhoneSheet = 'none' | 'layers' | 'properties';
export const phoneSheetState = createStore<PhoneSheet>('none');

/** Opens a sheet, or closes it when it is already the open one. */
export function togglePhoneSheet(sheet: Exclude<PhoneSheet, 'none'>) {
  phoneSheetState.set(phoneSheetState.get() === sheet ? 'none' : sheet);
}

/** Closes any open sheet. */
export function closePhoneSheet() {
  phoneSheetState.set('none');
}

/** The phone width at which Layers and Properties are bottom sheets (the same breakpoint as the CSS). */
export function isPhoneWidth(): boolean {
  return window.matchMedia(PHONE_QUERY).matches;
}

const PHONE_QUERY = '(max-width: 600px)';
function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether the window is at phone width right now. Components use it to choose a layout, not just to hide one. */
export function usePhoneWidth(): boolean {
  return useSyncExternalStore(subscribePhone, isPhoneWidth);
}
