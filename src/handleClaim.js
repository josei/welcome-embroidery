// @ts-check
// Decides whether a press on a selected object's frame belongs to a resize handle or to the object's body.
// A handle's touch target is a square of HANDLE_HIT_PX screen pixels, so on a small object it can cover the
// middle of the object. The rule below keeps the whole square as the target for handles that sit outside the
// frame, and for handles on the frame it claims only a small disc around the handle's centre, so a press in
// the body moves the object. Used by both the touch and the mouse press path in canvas.js.

export const HANDLE_HIT_PX=44;

/**
 * Radius, in screen pixels, of the disc around a frame handle that claims a press. It is 22 px (half the touch
 * target) on objects 73 px or larger, and shrinks to 30 % of the shorter side on smaller ones, so the body of a
 * small object stays free of handles.
 * @param {number} W object width in world units
 * @param {number} H object height in world units
 * @param {number} scale screen px per world unit
 * @returns {number}
 */
export function handleClaimPx(W,H,scale){
  return Math.min(HANDLE_HIT_PX/2,.3*Math.min(W,H)*scale);
}

/**
 * True when the press at distance `distWorld` (world units) from the handle's centre should resize it.
 * @param {number} distWorld
 * @param {number} W
 * @param {number} H
 * @param {number} scale
 * @returns {boolean}
 */
export function pressClaimedByHandle(distWorld,W,H,scale){
  return distWorld*scale<=handleClaimPx(W,H,scale);
}
