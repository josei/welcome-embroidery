// @ts-check
/**
 * The sewing-order list's selection rules, without the React parts so they can be tested. A plain click replaces the
 * selection with the clicked row (or its group). Shift selects every row from the anchor to the clicked row, in the
 * order the list shows them. Ctrl or Cmd adds the clicked row when it is not selected, and removes it when it is.
 *
 * `rows` is the list as shown: one entry per visible row, each the object ids that row selects (a group row, or a row
 * inside a group, lists all its members). `anchor` is the id of the row last clicked with a plain or Ctrl/Cmd click.
 */

/** @typedef {'plain' | 'toggle' | 'range'} Click */

/**
 * @param {string[][]} rows the ids each visible row selects, in sewing order
 * @param {ReadonlySet<string>} selected the currently selected object ids
 * @param {string | null} anchor the anchor's object id, or null before any click
 * @param {number} at the index in `rows` of the clicked row
 * @param {Click} click how it was clicked
 * @returns {{ids: string[], primary: string, anchor: string | null} | null} the new selection, or null when nothing changes
 */
export function selectionChange(rows, selected, anchor, at, click) {
 const unit = rows[at];
 if (!unit?.length) return null;
 const last = /** @param {string[]} xs */ xs => xs[xs.length - 1];
 const anchorAt = anchor === null ? -1 : rows.findIndex(r => r.includes(anchor));
 if (click === 'range' && anchorAt >= 0) {
  const lo = Math.min(anchorAt, at), hi = Math.max(anchorAt, at);
  return {ids: [...new Set(rows.slice(lo, hi + 1).flat())], primary: last(unit), anchor};
 }
 if (click === 'toggle') {
  const on = unit.every(id => selected.has(id));
  const next = new Set(selected);
  if (on) unit.forEach(id => next.delete(id));
  else unit.forEach(id => next.add(id));
  // Ctrl-click never empties the selection: the last selected row stays, as it did before this rule existed.
  if (next.size === 0) return null;
  const ids = [...next];
  return {ids, primary: on ? last(ids) : last(unit), anchor: unit[0]};
 }
 return {ids: [...unit], primary: last(unit), anchor: unit[0]};
}
