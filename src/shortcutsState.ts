import {createStore} from './store.js';
import {SHORTCUT_TABLE, shortcutSections} from './shortcutTable.js';

// The keyboard shortcuts, in the order the dialog lists them, built from SHORTCUT_TABLE (the handler's own key table).
// Titles and keys are translated when the dialog renders. Labels come from shortcutLabel, so Apple platforms read ⌘ ⌥ ⇧.
export const SHORTCUTS: Array<[string, Array<[string, string]>]> = shortcutSections(SHORTCUT_TABLE);

/** Whether the keyboard shortcuts dialog is open. The dialog opens from the help button and the ? key. */
export const shortcutsState = createStore(false);

/** Opens or closes the keyboard shortcuts dialog. */
export function setShortcutsOpen(open: boolean) {
  shortcutsState.set(open);
}
