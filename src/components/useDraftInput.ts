import {useRef, useState} from 'react';
import type {ChangeEvent, FocusEvent, KeyboardEvent} from 'react';

type Field = HTMLInputElement | HTMLTextAreaElement;

/**
 * A text input that shows the stored value. While it has focus it shows what the user types, and the typed text is
 * committed on Enter or on blur, but only if it differs from the text the field had when it got focus.
 * commit() returns false to show the stored value again, for example when the text is not allowed.
 * After a commit the field keeps the typed text, unless settle is 'store', which shows the stored value (its normalised form).
 * Enter commits too, unless commitOnEnter is false (a multi-line field keeps Enter for a new line).
 * valid, when given, marks the typed text: while it is not valid the field gets aria-invalid="true" (styled as an error).
 * It does not stop the commit; commit() decides what to do with the text.
 */
export function useDraftInput(
  stored: string,
  commit: (text: string) => boolean | void,
  settle: 'typed' | 'store' = 'typed',
  commitOnEnter = true,
  valid?: (text: string) => boolean,
) {
  const [draft, setDraft] = useState<string | null>(null);
  const atFocus = useRef('');
  const finish = (text: string) => {
    if (text === atFocus.current) return;
    atFocus.current = text;
    const result = commit(text);
    // A refused text reverts to the stored value, which is what the blur that follows must compare against.
    if (result === false) atFocus.current = stored;
    if (result === false || settle === 'store') setDraft(null);
  };
  const invalid = valid !== undefined && draft !== null && !valid(draft);
  return {
    ...(valid ? {'aria-invalid': invalid ? ('true' as const) : undefined} : {}),
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
