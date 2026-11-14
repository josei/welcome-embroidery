// @ts-check
// The undo step for adding an object. It names the object as its layer row does (its name, or its kind when it has none),
// so Undo reads "Undo add Rectangle" in the same words the object list shows.
import {t} from './i18n.js';

/**
 * The step label for adding an object, already translated, e.g. "add Rectangle" (Spanish: "añadir Rectángulo").
 * @param {{name?: string, kind?: string}} o the object being added, with the name or kind it is created with
 * @returns {string}
 */
export function addLabel(o) {
  const name = o.name?.trim() || o.kind || 'Object';
  return t('add {name}', {name: t(name)});
}
