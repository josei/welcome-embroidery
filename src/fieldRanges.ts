// Range checks for the numeric fields that revert on an out-of-range value. The field shows the range, the commit
// refuses the value and says what was kept, and the document is never edited with a value the engine would reject.
import {t} from './i18n.js';
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';

export interface FieldRange {
  min: number;
  max: number;
}

/** The same bounds validate.js enforces on the document. */
export const STITCH_LENGTH_RANGE: FieldRange = {min: 0.5, max: 7};
export const ROW_SPACING_RANGE: FieldRange = {min: 0.25, max: 1.2};
export const BORDER_WIDTH_RANGE: FieldRange = {min: 0, max: 12};

/** Whether the text is a number inside the range. Empty text counts as 0, as the field's number parse does. */
export function inFieldRange(text: string, range: FieldRange): boolean {
  const v = Number(text);
  return Number.isFinite(v) && v >= range.min && v <= range.max;
}

/** The range as the field shows it, e.g. "0.5–7 mm". */
export function rangeText(range: FieldRange): string {
  return `${range.min}–${range.max} mm`;
}

/** The label of what the edit applies to: the selected object's name, the count of a multi-selection, or the document. */
export function selectionLabel(): string {
  const selection = selState();
  if (selection.multi.size > 1) return t('{n} objects', {n: selection.multi.size});
  const selected = selection.selected;
  const object = (documentNow().doc.objects as {id: string; name?: string}[]).find(o => o.id === selected);
  return object?.name || t('The document');
}

/** "Stitch length must be 0.5–7 mm. Rectangle keeps 3 mm." The kept value is the last valid one, in mm. */
export function outOfRangeMessage(field: string, range: FieldRange, kept: string): string {
  return t('{field} must be {range}. {object} keeps {kept} mm.', {
    field: t(field),
    range: rangeText(range),
    object: selectionLabel(),
    kept,
  });
}
