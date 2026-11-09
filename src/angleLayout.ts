import {t} from './i18n.js';
import type {Layout} from './layoutState.js';

/**
 * The angle field's state, from the selection. Nothing selected: shown and enabled. One object: shown when its fill
 * uses rows. A multi-selection: shown when any selected object is fillable, enabled only when every fillable one uses
 * rows, and otherwise disabled with the count of the others as the reason. Angle is stored per object, so the disabled
 * field edits nothing.
 *
 * @param n how many objects are selected
 * @param fillMethods the fill method of each selected fillable object (undefined or 'rows' both mean rows)
 * @param singleRows whether the one selected object is a fillable that uses rows
 */
export function angleLayout(n: number, fillMethods: (string | null | undefined)[], singleRows: boolean): Partial<Layout> {
  if (n === 0) return {angleHidden: false, angleDisabled: false, angleNote: ''};
  if (n === 1) return {angleHidden: !singleRows, angleDisabled: false, angleNote: ''};
  if (!fillMethods.length) return {angleHidden: true, angleDisabled: false, angleNote: ''};
  const others = fillMethods.filter(m => m && m !== 'rows');
  if (!others.length) return {angleHidden: false, angleDisabled: false, angleNote: ''};
  const kind = others.every(m => m === 'contour') ? 'contours' : 'other fill methods';
  const count = others.length === fillMethods.length ? `all ${fillMethods.length} use` :
    `${others.length} of ${fillMethods.length} ${others.length === 1 ? 'uses' : 'use'}`;
  return {
    angleHidden: false,
    angleDisabled: true,
    angleNote: t('Angle applies to row-fill objects; {count} {kind}', {count, kind}),
  };
}
