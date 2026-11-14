// @ts-check
// The margin Fit hoop leaves around the hoop. A phone is fitted edge to edge (a small margin, against the ruler's 18 px), so the
// hoop fills the canvas. A touch tablet keeps the full margin so the whole hoop shows with room on each side.
//
// Mouse windows keep the rule they always had: a canvas whose smaller side is under 600 px gets the small margin. Only a touch
// device is judged by its layout, because a portrait tablet's canvas is narrow without being a phone.

export const PHONE_FIT_MARGIN = 4;
export const EDITOR_FIT_MARGIN = 56;

// Canvas size below which a mouse window has always been fitted with the small margin.
const SMALL_CANVAS_PX = 600;

// The phone breakpoints the stylesheet uses: a phone width (600 px and narrower), or a landscape phone's short height.
const PHONE_LAYOUT_QUERY = '(max-width: 600px), (max-height: 500px)';
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * Picks the Fit margin for the current window.
 * @param {{smallSide: number, touch: boolean, phoneLayout: boolean}} layout
 *   smallSide: the smaller side of the canvas, in px; touch: whether the primary pointer is coarse (a finger);
 *   phoneLayout: whether the window is laid out as a phone.
 * @returns {number} the margin, in px, Fit hoop leaves on each side
 */
export function hoopFitMargin({smallSide, touch, phoneLayout}) {
  if (!touch) return smallSide < SMALL_CANVAS_PX ? PHONE_FIT_MARGIN : EDITOR_FIT_MARGIN;
  return phoneLayout ? PHONE_FIT_MARGIN : EDITOR_FIT_MARGIN;
}

/** Whether the window is laid out as a phone right now. */
export function isPhoneFitLayout() {
  return !!globalThis.matchMedia?.(PHONE_LAYOUT_QUERY).matches;
}

/** Whether the primary pointer is coarse, such as a finger. */
export function isTouchFitPointer() {
  return !!globalThis.matchMedia?.(COARSE_POINTER_QUERY).matches;
}

/**
 * The Fit margin for the window as it is now.
 * @param {number} smallSide the smaller side of the canvas, in px
 * @returns {number}
 */
export function currentFitMargin(smallSide) {
  return hoopFitMargin({smallSide, touch: isTouchFitPointer(), phoneLayout: isPhoneFitLayout()});
}
