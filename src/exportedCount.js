// @ts-check
// The stitch count the export of one format decodes to. An imported layer's plan count is the DST list, which splits long moves, so it can
// differ from what a PES, U01 or passed-through PES file holds. The canvas shows the count of the format the export dialog has picked.

import {encode} from './encoders.js';
import {decodeEmbroidery} from './readers.js';

/** Formats whose export is a stitch file the reader can count. Print and vector outputs have no stitch count. */
const STITCH_FORMATS = new Set(['jef', 'vp3', 'dst', 'exp', 'pec', 'pes', 'pes6', 'sew', 'u01', 'xxx', 'tbf']);

/** @type {WeakMap<object, Map<string, number|null>>} */
const cache = new WeakMap();

/**
 * The stitches the export of `format` decodes to, or null when the format has no stitch file or the export fails.
 * Cached per compiled plan, since the plan object changes on every edit.
 * @param {any} plan compiled plan
 * @param {string} format export format id
 * @param {{hoop?: any}} doc document the plan was compiled from
 * @returns {number|null}
 */
export function exportedStitchCount(plan, format, doc) {
  if (!plan || !STITCH_FORMATS.has(format) || plan.errors?.length) return null;
  let byFormat = cache.get(plan);
  if (!byFormat) {
    byFormat = new Map();
    cache.set(plan, byFormat);
  }
  if (byFormat.has(format)) return /** @type {number|null} */ (byFormat.get(format));
  let count = null;
  try {
    const bytes = encode(plan, format, '#527461', doc.hoop, /** @type {any} */ (doc));
    // The reader knows PES v6 files as 'pes' (the file name is .pes too), so decode them with that id.
    count = decodeEmbroidery(bytes, format === 'pes6' ? 'pes' : format).stitches.filter(s => s.cmd === 'stitch').length;
  } catch {
    count = null;
  }
  byFormat.set(format, count);
  return count;
}

/**
 * The per-object counts the object list shows, with an imported layer's share follows the picked format's export. The export's
 * total minus the plan's total is the difference the imports make, and it goes to the imported layers in proportion to their
 * planned counts (all to the one layer when there is only one). Other objects keep their planned counts.
 * @param {any} plan compiled plan
 * @param {string} format export format id
 * @param {{objects?: Array<{id: string, kind: string}>, hoop?: any}} doc document the plan was compiled from
 * @returns {Record<string, number>}
 */
export function exportedObjectCounts(plan, format, doc) {
  const counts = plan?.objectCounts || {};
  if (!plan?.planned) return counts;
  const exported = exportedStitchCount(plan, format, /** @type {any} */ (doc));
  if (exported === null) return counts;
  const layerIds = (doc.objects || []).filter(o => o.kind === 'stitch_layer' && counts[o.id] !== undefined).map(o => o.id);
  const planned = layerIds.reduce((sum, id) => sum + counts[id], 0);
  if (!layerIds.length) return counts;
  const delta = exported - plan.count;
  const adjusted = {...counts};
  // Share the difference by planned count; a layer with no planned stitches takes an equal share.
  for (const id of layerIds) {
    const share = planned > 0 ? counts[id] / planned : 1 / layerIds.length;
    adjusted[id] = Math.max(0, Math.round(counts[id] + delta * share));
  }
  return adjusted;
}

/**
 * The export format the dialog should pick after a machine file is imported. A PES file imported unchanged is passed through as its
 * own bytes, so the canvas count matches the file only when PES is the picked format; the default DST would show the planned count.
 * Other imports keep the picked format (null).
 * @param {string} importedFormat the format the file was read as
 * @returns {string|null}
 */
export function exportFormatAfterImport(importedFormat) {
  return importedFormat === 'pes' ? 'pes' : null;
}
