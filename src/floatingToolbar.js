// @ts-check
// Where the floating toolbar and an open phone sheet cover the canvas, so the view can keep content clear of them.

/**
 * The canvas pixels the tool rail covers on the left, on a tablet in landscape. The rail docks on the canvas's left edge, just
 * inside the ruler, so Fit hoop and Fit all fit the hoop into the space beside it and a new shape is never drawn under it.
 * Other sizes keep the rail over the margin, so this is 0 there. Mirrors the media query in styles.css.
 * @param {HTMLElement} container the canvas element
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function railInset(container) {
  const inset = {top: 0, right: 0, bottom: 0, left: 0};
  if (!globalThis.matchMedia?.('(min-width: 601px) and (max-width: 1100px) and (orientation: landscape) and (min-height: 501px)').matches) return inset;
  const c = container.getBoundingClientRect();
  const r = document.querySelector('.canvas .tool-rail')?.getBoundingClientRect();
  if (r && r.width && r.height && r.left - c.left < 40) inset.left = Math.max(0, r.right - c.left + 8 - RULER_PX);
  return inset;
}

// The canvas ruler's width, which the rail sits beside.
const RULER_PX = 18;

/**
 * The canvas pixels covered at each edge: the floating toolbar at the top or on the right, and an open phone sheet (Layers or
 * Properties) at the bottom (portrait) or the right (landscape).
 * @param {HTMLElement} container the canvas element
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function toolbarInset(container) {
  const inset = {top: 0, right: 0, bottom: 0, left: 0};
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
