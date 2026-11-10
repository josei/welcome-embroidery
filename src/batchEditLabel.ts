import {t} from './i18n.js';

/** The fields a multi-selection batch edit can change, with the name the undo label shows for each. */
const BATCH_FIELD_NAMES = {spacing: 'row spacing', angle: 'angle', stitchLength: 'stitch length'} as const;

/**
 * The undo label for one batch field commit across several objects, e.g. "batch: row spacing on 2 objects"
 * (Undo shows it as "Undo batch: row spacing on 2 objects"). Returns undefined for a single object or another field,
 * so those keep the default label.
 */
export function batchEditLabel(field: string, count: number): string | undefined {
  if (count < 2 || !(field in BATCH_FIELD_NAMES)) return undefined;
  return t('batch: {field} on {n} objects', {field: t(BATCH_FIELD_NAMES[field as keyof typeof BATCH_FIELD_NAMES]), n: count});
}

/**
 * The undo label for a document setting changed with nothing selected, e.g. "row spacing" (Undo shows it as
 * "Undo row spacing"). Returns undefined for a field without a name, so it keeps the default label.
 */
export function settingEditLabel(field: string): string | undefined {
  return field in BATCH_FIELD_NAMES ? t(BATCH_FIELD_NAMES[field as keyof typeof BATCH_FIELD_NAMES]) : undefined;
}
