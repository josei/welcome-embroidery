// @ts-check
// The smallest a resized side may get, in the object's own units. A drag past the opposite edge, or a
// keyboard nudge through it, stops here: the object keeps its orientation (it is never flipped) and stays
// large enough to see and grab. Shrinking to a line would leave nothing to select or resize back.
export const MIN_RESIZE_SIZE = 8;

/**
 * Clamps a resize scale so that a side of `size` never shrinks below MIN_RESIZE_SIZE.
 * A negative scale (the pointer dragged past the opposite edge) is raised to the floor too, so it never flips.
 * A side already under the minimum is held at its current size (scale 1): it may not shrink further, and it
 * is not enlarged to the minimum either, since that would change an object the user did not resize.
 * A size of zero or less has no proportion to keep, so the scale is returned unchanged.
 * @param {number} scale the requested scale for that side (1 keeps it the same size)
 * @param {number} size the side's current length
 * @returns {number} the scale to apply
 */
export function clampResizeScale(scale, size) {
  if (!(size > 0)) return scale;
  return Math.max(scale, Math.min(1, MIN_RESIZE_SIZE / size));
}
