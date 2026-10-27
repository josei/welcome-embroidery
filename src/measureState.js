import {createStore} from './store.js';

/**
 * @typedef {Object} MeasurePoints
 * @property {[number, number]} a the first point in mm
 * @property {[number, number] | null} b the second point in mm, or null until it is clicked
 */

/** The measure tool's points, or null before the first click. The readout reads it; app.js changes it. */
export const measureState = createStore(/** @type {MeasurePoints | null} */ (null));
