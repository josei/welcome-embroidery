// @ts-check
// Keeps a dragged object on the part of the canvas a finger can see. On a phone the tool dock (portrait) or the tool rail
// (landscape) sits over the canvas's edge, and the canvas does not scroll, so an object dragged under it is lost. These
// helpers take client-pixel rects and return the largest part of the canvas left uncovered, and the move delta limited to it.

/**
 * The largest rectangle of `area` that no obstruction covers. Each obstruction removes one side of `area`, and the side
 * with the most room left is kept.
 * @param {{left:number,top:number,right:number,bottom:number}} area
 * @param {{left:number,top:number,right:number,bottom:number}[]} obstructions
 */
export function visibleCanvasRect(area, obstructions) {
  // Copy the four edges by name. A DOMRect keeps its edges on prototype getters, which a spread would drop.
  let rect = {left: area.left, top: area.top, right: area.right, bottom: area.bottom};
  for (const b of obstructions) {
    if (b.right <= rect.left || b.left >= rect.right || b.bottom <= rect.top || b.top >= rect.bottom) continue;
    const sides = [
      {...rect, left: Math.max(rect.left, b.right)},
      {...rect, right: Math.min(rect.right, b.left)},
      {...rect, top: Math.max(rect.top, b.bottom)},
      {...rect, bottom: Math.min(rect.bottom, b.top)},
    ];
    rect = sides.reduce((best, s) => (area2(s) > area2(best) ? s : best));
  }
  return rect;
}

const area2 = (/** @type {{left:number,top:number,right:number,bottom:number}} */ r) =>
  Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

/**
 * Limits a move so the object's bounding box stays inside `visible`. The canvas maps world x to client
 * `svgRect.left + (x - center[0]) * scale + svgRect.width / 2` (and likewise for y). An object larger than the visible
 * area keeps its leading edge (left or top) in view.
 * @param {{box:number[], delta:number[], scale:number, center:number[], svgRect:{left:number,top:number,width:number,height:number}, visible:{left:number,top:number,right:number,bottom:number}}} p
 * @returns {number[]} the clamped [dx, dy] in world units
 */
export function clampMoveDelta({ box, delta, scale, center, svgRect, visible }) {
  const sx = (/** @type {number} */ x) => svgRect.left + (x - center[0]) * scale + svgRect.width / 2;
  const sy = (/** @type {number} */ y) => svgRect.top + (y - center[1]) * scale + svgRect.height / 2;
  let [dx, dy] = delta;
  const [x0, y0, x1, y1] = box;
  const left = sx(x0 + dx), right = sx(x1 + dx);
  if (left < visible.left) dx += (visible.left - left) / scale;
  else if (right > visible.right) dx -= (right - visible.right) / scale;
  const top = sy(y0 + dy), bottom = sy(y1 + dy);
  if (top < visible.top) dy += (visible.top - top) / scale;
  else if (bottom > visible.bottom) dy -= (bottom - visible.bottom) / scale;
  return [dx, dy];
}
