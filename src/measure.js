// @ts-check
// Measure tool geometry: the distance between two points and the signed offset from the first to the second.
// The engine re-exports the name the readout uses.

/** @typedef {import('./geom.js').Pt} Pt */

// Measure tool: the straight-line distance between two points in mm, with its x and y parts (b minus a, so the signs say which way the second point lies).
/**
 * @param {Pt} a
 * @param {Pt} b
 * @returns {{distance: number, dx: number, dy: number}}
 */
export function measureBetween(a,b){const dx=b[0]-a[0],dy=b[1]-a[1];return {distance:Math.hypot(dx,dy),dx,dy};}
