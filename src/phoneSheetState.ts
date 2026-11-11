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
  return window.matchMedia('(max-width: 600px)').matches;
}
