import type {KeyboardEvent} from 'react';

/**
 * Ctrl+A (Command+A on macOS) inside a text field selects that field's text. The browser's own select-all is not
 * relied on here: in the lettering fields it did not run, so typing put the new text before the old. This handles the
 * plain shortcut only; Shift or Alt combinations keep their normal meaning.
 */
export function selectAllInField(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    e.currentTarget.select();
  }
}
