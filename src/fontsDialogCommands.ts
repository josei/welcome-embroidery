import {documentNow} from './documentState.js';
import {t} from './i18n.js';

/** What the fonts dialog's buttons need from the editor, supplied by app.js. */
export interface FontsDialogApi {
  /** Runs one undoable command through the document store. */
  edit(operations: Record<string, unknown>[]): boolean;
  toast(message: string, kind?: 'status' | 'error'): void;
}

let api: FontsDialogApi | null = null;

/** The wired editor commands. app.js calls configureFontsDialog before the button can edit anything. */
function wired(): FontsDialogApi {
  if (!api) throw Error('The fonts dialog is not wired.');
  return api;
}

/** Wires the organize fonts dialog, once. */
export function configureFontsDialog(next: FontsDialogApi) {
  api = next;
}

/** Removes the document's custom fonts that no lettering uses, and says how many went. */
export function removeUnusedFonts() {
  const before = Object.keys(documentNow().doc.customFonts || {}).length;
  wired().edit([{op: 'remove_unused_fonts'}]);
  const removed = before - Object.keys(documentNow().doc.customFonts || {}).length;
  wired().toast(!removed ? t('No unused fonts to remove.') : removed === 1 ? t('Removed 1 unused font.') : t('Removed {n} unused fonts.', {n: removed}));
}
