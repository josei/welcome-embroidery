import {documentNow} from './documentState.js';

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
  wired().toast(removed ? `Removed ${removed} unused font${removed === 1 ? '' : 's'}.` : 'No unused fonts to remove.');
}
