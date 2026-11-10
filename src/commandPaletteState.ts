import {createStore} from './store.js';

/**
 * The palette's open state, its search text and the selected row. Opening resets the text and selection in the same
 * store update, so a key typed right after the palette opens never lands in the last session's text.
 */
export interface PaletteState {
  open: boolean;
  query: string;
  active: number;
}

export const paletteState = createStore<PaletteState>({open: false, query: '', active: 0});

/** Opens or closes the command palette. Either way the search text and the selection start over. */
export function setPaletteOpen(open: boolean) {
  paletteState.set({open, query: '', active: 0});
}

/** Sets the search text; the first matching row becomes the selection. */
export function setPaletteQuery(query: string) {
  paletteState.set({...paletteState.get(), query, active: 0});
}

/** Moves the selection to a row index. */
export function setPaletteActive(active: number) {
  paletteState.set({...paletteState.get(), active});
}
