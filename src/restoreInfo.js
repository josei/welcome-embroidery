// @ts-check
// The line under the restore prompt's heading: what the autosave copy holds, and whether it is the saved file. Kept apart
// from autosave.js so the wording can be tested without a browser. `t` is the UI translator (see i18n.js).

/**
 * @param {{name: string, objects: number, clean: boolean, minutes: number, savedFileName?: string|null}} copy
 * `clean` means the copy matches the last saved file; otherwise it holds unsaved changes, `minutes` old.
 * @param {(text: string, values?: Record<string, string|number>) => string} t
 * @returns {string}
 */
export function restorePromptInfo(copy, t) {
  const objects = copy.objects === 1 ? t('1 object') : t('{n} objects', {n: copy.objects});
  const file = copy.savedFileName || '';
  if (copy.clean) {
    return file
      ? t('"{name}", {objects}. Matches saved file "{file}".', {name: copy.name, objects, file})
      : t('"{name}", {objects}. Matches saved file.', {name: copy.name, objects});
  }
  return file
    ? t('"{name}", {objects}. Unsaved changes, {m} min ago. Saved file: "{file}".', {name: copy.name, objects, m: copy.minutes, file})
    : t('"{name}", {objects}. Autosaved in this browser, {m} min ago.', {name: copy.name, objects, m: copy.minutes});
}
