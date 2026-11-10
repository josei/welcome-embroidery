// @ts-check
// The accessible name of the design canvas: "Design canvas, 1 object, 573 stitches", or "Design canvas, empty". It is built
// from the same document objects and per-object stitch counts the object list shows, so the two cannot disagree. Stitches
// are the sum of the counts that exist; they are left out until a compile has counted at least one object.
import {t} from './i18n.js';

/**
 * @param {{id: string}[]} objects the document's objects, in sewing order
 * @param {Record<string, number>} counts stitches per object id from the last compiled plan
 */
export function designName(objects, counts) {
  const base = t('Design canvas');
  if (objects.length === 0) return `${base}, ${t('empty')}`;
  const known = objects.map(o => counts[o.id]).filter(n => n !== undefined);
  const objectsText = objects.length === 1 ? t('1 object') : t('{n} objects', {n: objects.length});
  if (!known.length) return `${base}, ${objectsText}`;
  const stitches = known.reduce((sum, n) => sum + n, 0);
  const stitchesText = stitches === 1 ? t('1 stitch') : t('{n} stitches', {n: stitches.toLocaleString()});
  return `${base}, ${objectsText}, ${stitchesText}`;
}
