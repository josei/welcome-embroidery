// @ts-check
// Hoop presets, and the size and label of a document's hoop.

/** @typedef {{key: string, w: number, h: number}} HoopPreset */

// Hoop presets. 100 x 100 mm is Brother's 4x4 hoop (SA443) and 180 x 130 mm its 5x7 hoop (SA444, listed as 180mm x 130mm); 260 x 160 mm is the 6x10 hoop, listed as 160 x 260 mm by one retailer guide. The long side is the width. The 110 x 110 mm default is Welcome's own.
/** @type {HoopPreset[]} */
export const HOOP_PRESETS=[{key:'110x110',w:110,h:110},{key:'100x100',w:100,h:100},{key:'180x130',w:180,h:130},{key:'260x160',w:260,h:160}];
/**
 * @param {{hoop?: unknown, hoopH?: unknown}} d
 * @returns {{w: number, h: number}}
 */
export function hoopSize(d){const w=Number(d.hoop);return {w,h:Number(d.hoopH??w)};}
/** @param {{w: number, h: number}} size @returns {string} */
export const hoopLabel=({w,h})=>w===h?`${w} mm`:`${w} × ${h} mm`;
