import {createStore} from './store.js';

/**
 * @typedef {Object} PivotState
 * @property {[number, number] | null} pivot the rotation pivot in mm, or null for each object's own centre
 * @property {boolean} picking true while the next canvas click sets the pivot
 */

/** The rotation pivot. The transform panel reads it; app.js changes it. */
export const pivotState = createStore(/** @type {PivotState} */ ({pivot: null, picking: false}));

/**
 * The transform panel's pivot buttons call these. app.js sets them at start-up, because choosing
 * the pivot also redraws the canvas.
 * @type {{togglePick: () => void, reset: () => void}}
 */
export const pivotActions = {
  togglePick() {},
  reset() {},
};
