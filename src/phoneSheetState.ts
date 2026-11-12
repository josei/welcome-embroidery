import {useSyncExternalStore} from 'react';
import {createStore} from './store.js';

/**
 * Which sheet is open at phone size: Layers, Properties, or neither. Only one sheet is open at a time, so opening one closes the
 * other. The sheets are hidden by CSS everywhere else, so this value has no effect there (issue #473).
 */
export type PhoneSheet = 'none' | 'layers' | 'properties' | 'tools';
export const phoneSheetState = createStore<PhoneSheet>('none');

/**
 * The detent of a bottom sheet in portrait: peek (about 120 px, the title row and a little more), half (50% of the screen), or full
 * (below the top bar). A sheet opened from the dock starts at half. Landscape sheets are side sheets and ignore the detent.
 */
export type SheetDetent = 'peek' | 'half' | 'full';
export const phoneSheetDetent = createStore<SheetDetent>('half');

// The phone layouts in which Layers and Properties are sheets: a portrait phone (bottom sheets), or a landscape phone (side sheets).
// styles.css uses the same two conditions.
const PHONE_SHEET_QUERY = '(max-width: 600px) and (orientation: portrait), (max-height: 500px) and (pointer: coarse)';
const PORTRAIT_SHEET_QUERY = '(max-width: 600px) and (orientation: portrait)';

/** Whether Layers and Properties are sheets right now (a phone in either orientation). */
export function isPhoneSheetLayout(): boolean {
  return window.matchMedia(PHONE_SHEET_QUERY).matches;
}

/** Whether the sheets are bottom sheets with detents (a portrait phone). */
export function isPortraitSheetLayout(): boolean {
  return window.matchMedia(PORTRAIT_SHEET_QUERY).matches;
}

/** The phone width at which the Header picks its phone layout (the same breakpoint as the CSS). */
export function isPhoneWidth(): boolean {
  return window.matchMedia(PHONE_WIDTH_QUERY).matches;
}

const PHONE_WIDTH_QUERY = '(max-width: 600px)';
function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_WIDTH_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Issue #474: the phone Menu shows at phone widths and on a landscape phone (height 500 px or less, up to 900 px wide, such as
 * 844x390). Layers and Properties keep the 600 px breakpoint above. */
const PHONE_MENU_QUERY = '(max-width: 600px), (max-height: 500px) and (max-width: 900px)';
function subscribePhoneMenu(onChange: () => void) {
  const query = window.matchMedia(PHONE_MENU_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
export function usePhoneMenu(): boolean {
  return useSyncExternalStore(subscribePhoneMenu, () => window.matchMedia(PHONE_MENU_QUERY).matches);
}

/** Whether the window is at phone width right now. Components use it to choose a layout, not just to hide one. */
export function usePhoneWidth(): boolean {
  return useSyncExternalStore(subscribePhone, isPhoneWidth);
}

// The control that opened the open sheet. Focus goes back to it when the sheet closes, however it closes.
let opener: HTMLElement | null = null;
// Each sheet pushes one history entry, so the system back action closes it. A close made here goes back over that entry; the
// popstate it causes is ignored, once per entry.
let ignoredPops = 0;

/** Opens a sheet (from the dock: at half height). Opening the other sheet swaps it. */
export function openPhoneSheet(sheet: Exclude<PhoneSheet, 'none'>) {
  if (phoneSheetState.get() === sheet) return;
  if (phoneSheetState.get() === 'none') {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.history.pushState({phoneSheet: true}, '');
  }
  phoneSheetDetent.set('half');
  phoneSheetState.set(sheet);
}

/** Opens a sheet, or closes it when it is already the open one. */
export function togglePhoneSheet(sheet: Exclude<PhoneSheet, 'none'>) {
  if (phoneSheetState.get() === sheet) closePhoneSheet();
  else openPhoneSheet(sheet);
}

// Focus goes back to the opener. A sheet opened from the Menu is opened by a Menu row, which is gone once the Menu closes, so focus
// falls back to the Menu button (the phone Menu, in portrait).
function restoreFocus(back: HTMLElement | null) {
  if (back?.isConnected) back.focus();
  else document.getElementById('phoneMenu')?.focus();
}

/** Closes any open sheet, puts focus back on the control that opened it, and removes the sheet's history entry. */
export function closePhoneSheet() {
  if (phoneSheetState.get() === 'none') return;
  const back = opener;
  opener = null;
  phoneSheetState.set('none');
  if (window.history.state?.phoneSheet) {
    ignoredPops++;
    window.history.back();
  }
  restoreFocus(back);
}

// The system back action: it closes the open sheet first, and only then goes back in the app.
window.addEventListener('popstate', () => {
  if (ignoredPops > 0) {
    ignoredPops--;
    return;
  }
  if (phoneSheetState.get() === 'none') return;
  const back = opener;
  opener = null;
  phoneSheetState.set('none');
  restoreFocus(back);
});

/** Moves a sheet to the detent above it (peek, half, full). Full stays full. */
export function raisePhoneSheet() {
  const next: Record<SheetDetent, SheetDetent> = {peek: 'half', half: 'full', full: 'full'};
  phoneSheetDetent.set(next[phoneSheetDetent.get()]);
}

/** Moves a sheet to the detent below it. From peek, the sheet closes. */
export function lowerPhoneSheet() {
  const detent = phoneSheetDetent.get();
  if (detent === 'peek') closePhoneSheet();
  else phoneSheetDetent.set(detent === 'full' ? 'half' : 'peek');
}

const PHONE_PORTRAIT_QUERY = '(max-width: 600px) and (orientation: portrait)';
function subscribePhonePortrait(onChange: () => void) {
  const query = window.matchMedia(PHONE_PORTRAIT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
function isPhonePortrait(): boolean {
  return window.matchMedia(PHONE_PORTRAIT_QUERY).matches;
}

/** Whether the window is a phone held upright (600 px wide and narrower, taller than wide). Only this screen has the fixed phone
 * layout (styles.css, the phone portrait block); landscape phones keep the canvas with their tool strip inside it. */
export function usePhonePortrait(): boolean {
  return useSyncExternalStore(subscribePhonePortrait, isPhonePortrait);
}
