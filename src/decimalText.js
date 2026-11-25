// @ts-check
// The decimal separator of numeric fields. Values are stored as dot-form strings ("-12.0"); the field shows the
// separator of the UI language (a comma in Spanish, a dot in English), and typed text is read with either separator.

/**
 * The text a numeric field shows for a stored dot-form value.
 * @param {string} stored  e.g. "-12.0" or "0.4"
 * @param {string} language  'en' or 'es'
 * @returns {string}  e.g. "-12,0" in Spanish, "-12.0" in English
 */
export function decimalText(stored, language) {
 return language === 'es' ? stored.replace(/\./g, ',') : stored;
}

/**
 * The stored dot-form value for text typed in a numeric field. Accepts "." or "," as the decimal separator.
 * Text that is not a number gives '' (as a type="number" field did), which the commit reads as 0.
 * @param {string} text
 * @returns {string}  e.g. "0.4" for "0,4", '' for "abc" or blank text
 */
export function parseDecimal(text) {
 const normal = String(text).trim().replace(',', '.');
 return normal !== '' && Number.isFinite(Number(normal)) ? normal : '';
}

/**
 * The text a numeric field or readout shows for a stored dot-form value, in the UI language's separator, with the decimal
 * places one rule gives its unit. An mm value always shows one decimal place, so 3 reads "3.0" beside 0.4 and 0.05 keeps
 * its digits (the rule pads, it never rounds). Other units keep the stored form. Display only: the stored value is unchanged.
 * @param {string} stored  e.g. "3", "0.4" or "-12.0"
 * @param {string} language  'en' or 'es'
 * @param {string} [unit]  'mm' for lengths; '' or any other unit for values shown as stored
 * @returns {string}  e.g. "3.0" and "0.4" in English, "3,0" and "0,4" in Spanish
 */
export function fieldText(stored, language, unit = 'mm') {
 const text = unit === 'mm' && /^-?\d+$/.test(stored) ? `${stored}.0` : stored;
 return decimalText(text, language);
}

/**
 * A hoop size as "width×height", with the decimal separator of the UI language: "267,4×200" in Spanish, "267.4×200" in English.
 * @param {number[]} hoop  [width, height] in mm
 * @param {string} language  'en' or 'es'
 * @returns {string}
 */
export function hoopSizeText(hoop, language) {
 return `${decimalText(String(hoop[0]), language)}×${decimalText(String(hoop[1]), language)}`;
}

/**
 * A number with a fixed number of decimal places and thousands grouping in the UI language's style: "1,234.5" in English,
 * "1.234,5" in Spanish. The grouping is always applied, so a four-digit count groups the same way in both languages.
 * It never follows the browser's locale: the interface language decides the separators.
 * @param {number} n
 * @param {string} language  'en' or 'es'
 * @param {number} [digits=0]  decimal places to show; the value is rounded to them
 * @returns {string}
 */
export function formatNumber(n, language, digits = 0) {
 // useGrouping 'always' keeps the separator on four-digit numbers, which Spanish otherwise leaves ungrouped.
 const options = /** @type {any} */ ({minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always'});
 return n.toLocaleString(language === 'es' ? 'es-ES' : 'en-US', options);
}

/**
 * A whole count with thousands grouping in the UI language's style, e.g. "1,234" in English and "1.234" in Spanish.
 * @param {number} n
 * @param {string} language  'en' or 'es'
 * @returns {string}
 */
export function formatCount(n, language) {
 return formatNumber(n, language, 0);
}

/**
 * A decimal captured for an {n} placeholder of an English sentence, shown with the UI language's separator: "120.2" becomes
 * "120,2" in Spanish. Text that is not a plain decimal number, and every value in English, is returned as it is.
 * @param {string} v
 * @param {string} language  'en' or 'es'
 * @returns {string}
 */
export function countText(v, language) {
 return language === 'es' && /^-?\d+\.\d+$/.test(v) ? decimalText(v, 'es') : v;
}
