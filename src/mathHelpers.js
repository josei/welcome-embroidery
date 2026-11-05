// @ts-check
// Numeric helpers the engine uses to round and clamp document values.

/**
 * Rounds to one decimal place.
 * @param {number} n
 * @returns {number}
 */
export const round = n => Math.round(n * 10) / 10;

/**
 * Keeps v between a and b.
 * @param {number} v
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
