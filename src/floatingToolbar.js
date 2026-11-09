// @ts-check
// Where the floating toolbar covers the canvas, so the view can keep content clear of it.

/**
 * The canvas pixels the floating toolbar covers at the top or on the right: a right-hand column or a top strip.
 * @param {HTMLElement} container the canvas element
 * @returns {{top: number, right: number}}
 */
export function toolbarInset(container) {
  const none = {top: 0, right: 0};
  const bar = document.querySelector('.canvas .floating');
  const r = bar?.getBoundingClientRect(), c = container.getBoundingClientRect();
  if (!r || !r.width || !r.height) return none;
  if (r.height >= r.width && r.right >= c.right - r.width * 2) return {top: 0, right: Math.max(0, c.right - r.left)};
  if (r.top <= c.top + c.height / 2) return {top: Math.max(0, r.bottom - c.top), right: 0};
  return none;
}
