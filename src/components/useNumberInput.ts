import {useEffect, useRef, useState} from 'react';
import type {ChangeEvent, FocusEvent, KeyboardEvent} from 'react';
import {clampToRange, inRange, parseNumberText, rangeNote, rangeText} from '../numberField.js';
import type {FieldRange} from '../numberField.js';

type Field = HTMLInputElement;

const NOTE_MS = 4000;

/**
 * A committed number field under the one numeric rule (see numberField.js). It shows the stored value; typing edits a draft;
 * Enter or blur commits the draft.
 * - A value outside range is clamped to the nearest bound, committed as that bound, and note shows "Max 16 mm" beside the
 *   field until the next edit or for a few seconds.
 * - Empty or incomplete text restores the stored value and commits nothing, so 0 is never written by accident. With
 *   allowEmpty, a blank field commits '' instead: that is the field's "use the default" (its placeholder), not a value.
 * - commit receives the number as plain text, already clamped; it is called once per change, not again on the blur after Enter.
 * The returned inputProps go on the <input>; render note, when set, beside it.
 */
export function useNumberInput(
  stored: string,
  commit: (text: string) => void,
  range?: FieldRange,
  options: {allowEmpty?: boolean; unit?: string} = {},
) {
  const {allowEmpty = false, unit = 'mm'} = options;
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const atFocus = useRef('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const clearNote = () => {
    window.clearTimeout(timer.current);
    setNote(null);
  };
  // The committed form of the text: the number, clamped to the range; '' for a blank that means the default; null when the
  // text is no value (a lone "-", a cleared field). Two texts that commit the same value are the same, so "-8.0" and "-8" match.
  const committed = (text: string) => {
    const v = parseNumberText(text);
    if (v === null) return allowEmpty && text.trim() === '' ? {value: '', kept: null} : null;
    const kept = range ? clampToRange(v, range) : v;
    return {value: String(kept), kept: kept !== v ? kept : null};
  };
  const finish = (text: string) => {
    setDraft(null);
    const next = committed(text);
    if (!next) return; // blank or incomplete: the stored value comes back and nothing is written
    if (next.kept !== null && range) {
      setNote(rangeNote(next.kept, range, unit));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setNote(null), NOTE_MS);
    }
    if (next.value === atFocus.current) return;
    atFocus.current = next.value;
    commit(next.value);
  };
  const valid = (text: string) => {
    if (range) return inRange(text, range);
    return parseNumberText(text) !== null || (allowEmpty && text.trim() === '');
  };
  const invalid = draft !== null && !valid(draft);
  return {
    note,
    inputProps: {
      // The allowed range as a tooltip, so every clamped field says what it accepts. An explicit title on the element wins.
      title: range ? rangeText(range, unit) : undefined,
      'aria-invalid': invalid ? ('true' as const) : undefined,
      value: draft ?? stored,
      onFocus: () => {
        atFocus.current = committed(stored)?.value ?? stored;
        setDraft(stored);
      },
      onChange: (e: ChangeEvent<Field>) => {
        clearNote();
        setDraft(e.target.value);
      },
      onKeyDown: (e: KeyboardEvent<Field>) => {
        if (e.key === 'Enter') finish(e.currentTarget.value);
      },
      onBlur: (e: FocusEvent<Field>) => finish(e.currentTarget.value),
    },
  };
}
