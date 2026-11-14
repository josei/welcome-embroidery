// @ts-check
// Where the floating toolbar and an open phone sheet cover the canvas, so the view can keep content clear of them.

/**
 * The canvas pixels covered at each edge: the floating toolbar at the top or on the right, and an open phone sheet (Layers or
 * Properties) at the bottom (portrait) or the right (landscape).
 * @param {HTMLElement} container the canvas element
 * @returns {{top: number, right: number, bottom: number}}
 */
export function toolbarInset(container) {
  const inset = {top: 0, right: 0, bottom: 0};
  const c = container.getBoundingClientRect();
  const bar = document.querySelector('.canvas .floating');
  const r = bar?.getBoundingClientRect();
  if (r && r.width && r.height) {
    if (r.height >= r.width && r.right >= c.right - r.width * 2) inset.right = Math.max(0, c.right - r.left);
    else if (r.top <= c.top + c.height / 2) inset.top = Math.max(0, r.bottom - c.top);
  }
  // A phone sheet is a fixed panel over the canvas. A bottom sheet covers the canvas's lower part, a side sheet its right part.
  const sheet = document.querySelector('.layout>aside.panel.sheet-open')?.getBoundingClientRect();
  if (sheet && sheet.width && sheet.height) {
    if (sheet.width >= c.width * 0.9) inset.bottom = Math.max(0, c.bottom - sheet.top);
    else inset.right = Math.max(inset.right, c.right - sheet.left);
  }
  return inset;
}
