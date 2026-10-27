import {useRef, useState} from 'react';
import type {ChangeEvent, FocusEvent, KeyboardEvent} from 'react';

type Field = HTMLInputElement | HTMLTextAreaElement;

/**
 * A text input that shows the stored value. While it has focus it shows what the user types, and the typed text is
 * committed on Enter or on blur, but only if it differs from the text the field had when it got focus.
 * commit() returns false to show the stored value again, for example when the text is not allowed.
 * After a commit the field keeps the typed text, unless settle is 'store', which shows the stored value (its normalised form).
 * Enter commits too, unless commitOnEnter is false (a multi-line field keeps Enter for a new line).
 */
export function useDraftInput(stored: string, commit: (text: string) => boolean | void, settle: 'typed' | 'store' = 'typed', commitOnEnter = true) {
  const [draft, setDraft] = useState<string | null>(null);
  const atFocus = useRef('');
  const finish = (text: string) => {
    if (text === atFocus.current) return;
    atFocus.current = text;
    if (commit(text) === false || settle === 'store') setDraft(null);
  };
  return {
    value: draft ?? stored,
    onFocus: () => {
      atFocus.current = stored;
      setDraft(stored);
    },
    onChange: (e: ChangeEvent<Field>) => setDraft(e.target.value),
    onKeyDown: (e: KeyboardEvent<Field>) => {
      if (commitOnEnter && e.key === 'Enter') finish(e.currentTarget.value);
    },
    onBlur: (e: FocusEvent<Field>) => {
      finish(e.currentTarget.value);
      setDraft(null);
    },
  };
}
