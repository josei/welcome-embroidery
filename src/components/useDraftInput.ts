import {useRef, useState} from 'react';
import type {ChangeEvent, FocusEvent, KeyboardEvent} from 'react';

/**
 * A text input that shows the stored value. While it has focus it shows what the user types, and the typed text is
 * committed on Enter or on blur, but only if it differs from the text the field had when it got focus.
 * commit() returns false to show the stored value again, for example when the text is not allowed.
 */
export function useDraftInput(stored: string, commit: (text: string) => boolean | void) {
  const [draft, setDraft] = useState<string | null>(null);
  const atFocus = useRef('');
  const finish = (text: string) => {
    if (text === atFocus.current) return;
    atFocus.current = text;
    if (commit(text) === false) setDraft(null);
  };
  return {
    value: draft ?? stored,
    onFocus: () => {
      atFocus.current = stored;
      setDraft(stored);
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') finish(e.currentTarget.value);
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      finish(e.currentTarget.value);
      setDraft(null);
    },
  };
}
