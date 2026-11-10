// @ts-check
// Moves keyboard focus to the Stitch type control of the selected object: its checked radio, or the first enabled one.
// Used by the I shortcut and by a keyboard add of a shape, so the next key works on the new object. Returns false when
// the control is hidden or every choice is disabled, and leaves focus where it is.
export function focusStitchType() {
  const group = document.querySelector('#type ~ .icon-seg');
  if (!group) return false;
  const target = group.querySelector('button[aria-checked="true"]:not(:disabled)') || group.querySelector('button:not(:disabled)');
  if (!(target instanceof HTMLElement) || target.offsetParent === null) return false;
  target.focus();
  return true;
}
