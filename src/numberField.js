// @ts-check
// The one rule for committed numeric fields. A value outside the field's range is clamped to the nearest bound and a short
// note says so. Empty or incomplete text is not a value: the field restores the last committed value, so nothing writes 0 by
// accident. Nothing outside the range reaches the document. The React field is in components/useNumberInput.ts.
import {t} from './i18n.js';

/**
 * @typedef {{min: number, max: number}} FieldRange  The bounds a field accepts. max may be Infinity when the field has no
 * upper bound (the validator sets none for that field).
 */

/**
 * The number the text holds, or null when the text is empty, incomplete ("-", "1e", "abc") or not finite. A comma reads as
 * the decimal point ("0,5" is 0.5), as decimal fields show it in Spanish.
 * @param {string} text
 * @returns {number | null}
 */
export function parseNumberText(text) {
  const s = String(text).trim().replace(',', '.');
  if (s === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/**
 * The value clamped to the range: the nearest bound when it is outside.
 * @param {number} v
 * @param {FieldRange} range
 * @returns {number}
 */
export function clampToRange(v, range) {
  return Math.min(range.max, Math.max(range.min, v));
}

/**
 * Whether the text is a number inside the range. Text that is not a number is never inside.
 * @param {string} text
 * @param {FieldRange} range
 * @returns {boolean}
 */
export function inRange(text, range) {
  const v = parseNumberText(text);
  return v !== null && v >= range.min && v <= range.max;
}

/**
 * The range as a hint, e.g. "0.5–7 mm"; or "Min 0.5 mm" when the field has no upper bound.
 * @param {FieldRange} range
 * @param {string} [unit]
 * @returns {string}
 */
export function rangeText(range, unit = 'mm') {
  if (range.max === Infinity) return t('Min {n}', {n: `${range.min}${unitSuffix(unit)}`});
  return `${range.min}–${range.max}${unitSuffix(unit)}`;
}

/**
 * The unit with its leading space, or '' for a field without one (a multiplier).
 * @param {string} unit
 * @returns {string}
 */
function unitSuffix(unit) {
  return unit ? ` ${t(unit)}` : '';
}

/**
 * The note shown after a clamp: "Max 16 mm" when the value was cut to the top bound, "Min 0.5 mm" for the bottom.
 * @param {number} kept the clamped value that was committed
 * @param {FieldRange} range
 * @param {string} [unit]
 * @returns {string}
 */
export function rangeNote(kept, range, unit = 'mm') {
  if (kept >= range.max) return t('Max {n}', {n: `${range.max}${unitSuffix(unit)}`});
  return t('Min {n}', {n: `${range.min}${unitSuffix(unit)}`});
}
