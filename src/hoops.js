// @ts-check
// Hoop sizes: the presets and the size and label of a document's hoop. The engine re-exports them, so callers keep importing them from engine.js.

// Hoop presets. The inch presets are the exact conversions of their labels (1 in = 25.4 mm): 4 x 4 in is 101.6 mm square, 5 x 7 in is 177.8 x 127 mm
// and 6 x 10 in is 254 x 152.4 mm, so each label is true. The long side is the width. The 110 x 110 mm default is Welcome's own.
// Keys are the labels, so a key never names a size it does not have.
/** @type {Array<{key: string, w: number, h: number}>} */
export const HOOP_PRESETS=[{key:'110x110',w:110,h:110},{key:'4x4in',w:101.6,h:101.6},{key:'5x7in',w:177.8,h:127},{key:'6x10in',w:254,h:152.4}];

/**
 * @param {{hoop?: unknown, hoopH?: unknown}} d
 * @returns {{w: number, h: number}}
 */
export function hoopSize(d){const w=Number(d.hoop);return {w,h:Number(d.hoopH??w)};}

/** @type {(size: {w: number, h: number}) => string} */
export const hoopLabel=({w,h})=>w===h?`${w} mm`:`${w} × ${h} mm`;
