import {createStore} from './store.js';

/** @typedef {'startAt' | 'endAt' | 'rippleCenter' | null} PinTool */

/** Which point the next canvas click places: the start, the end or the ripple centre. The pin buttons read it; app.js changes it. */
export const pinState = createStore(/** @type {PinTool} */ (null));

/**
 * The pin buttons call press() with the point they arm. app.js sets it at start-up, because arming
 * also changes the canvas cursor and shows the hint.
 * @type {{press: (key: 'startAt' | 'endAt' | 'rippleCenter') => void}}
 */
export const pinActions = {
  press() {},
};
