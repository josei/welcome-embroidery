// @ts-check
// The undo step for adding an object. It names the object as its layer row does (its name, or its kind when it has none),
// so Undo reads "Undo add Rectangle" in the same words the object list shows.
import {t} from './i18n.js';

/**
 * The name as it reads inside the sentence "add {name}". A translated name is lower-cased at its first letter, because
 * Spanish puts a common noun after "añadir" in lower case ("añadir rectángulo"); an untranslated name keeps its case.
 * @param {string} name the name the object is given in English
 * @param {string} shown the same name after translation
 * @returns {string}
 */
export function stepNoun(name, shown) {
  if (shown === name) return shown;
  return shown.charAt(0).toLowerCase() + shown.slice(1);
}

/**
 * The step label for adding an object, already translated, e.g. "add Rectangle" (Spanish: "añadir rectángulo").
 * @param {{name?: string, kind?: string}} o the object being added, with the name or kind it is created with
 * @returns {string}
 */
export function addLabel(o) {
  const name = o.name?.trim() || o.kind || 'Object';
  return t('add {name}', {name: stepNoun(name, t(name))});
}
