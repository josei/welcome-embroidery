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
