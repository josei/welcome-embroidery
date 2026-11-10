import {useDraftInput} from './useDraftInput';
import {useNumberInput} from './useNumberInput';
import type {FieldRange} from '../numberField.js';
import {fieldText, parseDecimal} from '../decimalText.js';
import {lang} from '../i18n.js';

// The object inspector's numeric fields are type="text" inputMode="decimal": they show the stored dot form in the UI
// language's separator (a comma in Spanish), and read typed text with either separator. These wrappers do that around the
// two draft hooks; the commit still receives the dot form. Text that is not a number passes through unchanged, so blank and
// incomplete text keep the meaning those hooks already give it.
function dotted(text: string): string {
  const n = parseDecimal(text);
  return n === '' ? text : n;
}

/** useNumberInput for a decimal field: the stored value is shown in the UI language's separator and its unit's places. */
export function useDecimalNumber(
  stored: string,
  commit: (text: string) => void,
  range?: FieldRange,
  options: {allowEmpty?: boolean; unit?: string} = {},
) {
  const unit = options.unit ?? 'mm';
  const field = useNumberInput(fieldText(stored, lang, unit), commit, range, options);
  // The unit rides on the input so the stepping and scrub paths (numericFields.js) format with the same rule.
  return {...field, inputProps: {...field.inputProps, 'data-unit': unit}};
}

/** useDraftInput for a decimal field: the stored value is shown in the UI language's separator. */
export function useDecimalDraft(
  stored: string,
  commit: (text: string) => boolean | void,
  settle: 'typed' | 'store' = 'typed',
  commitOnEnter = true,
  valid?: (text: string) => boolean,
) {
  return useDraftInput(
    fieldText(stored, lang),
    text => commit(dotted(text)),
    settle,
    commitOnEnter,
    valid && (text => valid(dotted(text))),
  );
}
