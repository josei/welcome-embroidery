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
