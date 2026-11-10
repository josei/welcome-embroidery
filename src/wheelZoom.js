// @ts-check
// Zoom factor for a wheel or trackpad event over the canvas.
// A discrete mouse-wheel notch (deltaMode lines, or a whole-number deltaY of 100+ with no
// horizontal delta) zooms about 1.17x per notch, with or without Ctrl/⌘. A trackpad pinch
// (Ctrl/⌘ with small fractional deltas) keeps its smooth, slower curve.

/**
 * @param {{deltaY:number,deltaX?:number,deltaMode?:number,ctrlKey?:boolean,metaKey?:boolean}} e
 * @returns {boolean}
 */
export function isWheelNotch(e){
  return e.deltaMode===1||(Math.abs(e.deltaY)>=100&&(e.deltaX||0)===0&&Number.isInteger(e.deltaY));
}

/**
 * @param {{deltaY:number,deltaX?:number,deltaMode?:number,ctrlKey?:boolean,metaKey?:boolean}} e
 * @returns {number} multiplicative zoom factor (>1 zooms in)
 */
export function wheelZoomFactor(e){
  // Line-mode deltas (Firefox) count lines, roughly 33px each, so a notch matches the pixel case.
  const dy=e.deltaMode===1?e.deltaY*33:e.deltaY;
  if(!isWheelNotch(e)&&(e.ctrlKey||e.metaKey))return Math.exp(-dy*.01);
  return Math.exp(-dy*.0016);
}

/**
 * Whether this event should zoom rather than pan.
 * @param {{deltaY:number,deltaX?:number,deltaMode?:number,ctrlKey?:boolean,metaKey?:boolean}} e
 */
export function wheelZooms(e){
  return !!(e.ctrlKey||e.metaKey||isWheelNotch(e));
}
