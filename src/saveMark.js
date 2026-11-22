// @ts-check
// The mark the header shows while the open design has changes. "Unsaved" only means a project file exists and is out of date.
// With no file yet, the work is kept by autosave in this browser: that is not a loss, so it gets a neutral label. Kept apart
// from the header component so the wording can be tested without a browser. `t` is the UI translator (see i18n.js).

/**
 * @param {string|null|undefined} savedFileName the file the design was last saved to, or none
 * @param {(text: string) => string} t
 * @returns {{text: string, unsaved: boolean}} `unsaved` is true only when a file exists that the design has moved past
 */
export function dirtyMark(savedFileName, t) {
  return savedFileName ? {text: t('Unsaved'), unsaved: true} : {text: t('Autosaved in this browser'), unsaved: false};
}

/**
 * The glyph the phone and tablet status icon shows for each save state. The three differ in shape, not only colour: a
 * browser window means the design is only kept in this browser, a file with a check means it matches the file it was saved
 * to, and a file with an alert means that file is out of date.
 * @param {boolean} dirty whether the design has changes since the last save
 * @param {number|null} savedAt the time of the last save in this tab, or null before one
 * @param {string|null|undefined} savedFileName the file that save wrote to, or none
 * @returns {'i-status-autosaved'|'i-status-saved'|'i-status-unsaved'} the symbol id in EditorIcons
 */
export function saveStatusIcon(dirty, savedAt, savedFileName) {
  if (dirty) return savedFileName ? 'i-status-unsaved' : 'i-status-autosaved';
  return savedAt === null ? 'i-status-autosaved' : 'i-status-saved';
}

/**
 * The save status in words: the text the header shows at desktop widths. A dirty design
 * gets the dirtyMark words; a clean one shows when it was last saved in this tab, and the file it went to. The desktop header
 * shows these words, and the phone and tablet Menu shows them as a status line at the top of its File group.
 * @param {boolean} dirty whether the design has changes since the last save
 * @param {number|null} savedAt the time of the last save in this tab, or null before one
 * @param {string|null|undefined} savedFileName the file that save wrote to, or none
 * @param {(text: string, vars?: object) => string} t
 * @returns {string}
 */
export function saveStatusWords(dirty, savedAt, savedFileName, t) {
  if (dirty) return dirtyMark(savedFileName, t).text;
  if (savedAt === null) return t('Autosaved in this browser');
  const when = new Date(savedAt);
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  return savedFileName ? t('Saved {time} to {file}', {time, file: savedFileName}) : t('Saved {time}', {time});
}
