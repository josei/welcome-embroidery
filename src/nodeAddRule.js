// @ts-check
/**
 * Whether "Add node" is disabled. It adds a node to the path being edited, so it is only meaningful while node editing is on;
 * with the whole path selected and editing off, Edit nodes is the one route in.
 * @param {string | undefined} primaryKind the kind of the selected object, if any
 * @param {boolean} editing whether node editing is on
 * @returns {boolean}
 */
export function nodeAddDisabled(primaryKind, editing) {
  return primaryKind !== 'path' || !editing;
}
