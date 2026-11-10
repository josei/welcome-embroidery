import {t} from './i18n.js';

/**
 * The thread select's value when the selected objects use different threads: an empty value that matches only the disabled
 * "Mixed" option, so no colour is shown and nothing can be picked. (A disabled option that is the selected value broke
 * canvas drawing in the e2e run, so the value is empty rather than a sentinel string.)
 */
export const MIXED_THREAD = '';

/**
 * Whether the selected objects differ in stitch type. Stitch layers have no type the panel can change, so they are left out;
 * an object without a stitch value counts as fill, as the panel shows it.
 */
export function mixedStitchTypes(objects: Array<{kind?: string; stitch?: string | null}>): boolean {
  const types = new Set(objects.filter(v => v.kind !== 'stitch_layer').map(v => v.stitch || 'fill'));
  return types.size > 1;
}

/** Whether the selected objects differ in thread, compared the way the thread select compares them (case-insensitive). */
export function mixedThreads(objects: Array<{thread?: string | null}>): boolean {
  return new Set(objects.map(v => (v.thread || '').toLowerCase())).size > 1;
}

/**
 * The line under the stitch type buttons when they differ. The type buttons apply to the last-clicked object only, so the
 * line says that, instead of letting a click on one button look like it changes them all.
 */
export function mixedTypeNote(): string {
  return t('Mixed: these objects have different stitch types. Changing type applies to the last-clicked object only.');
}
