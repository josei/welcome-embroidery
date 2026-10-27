import {createStore} from './store.js';

/**
 * Whether drags and drawing snap to other objects' nodes, midpoints, edges and centres.
 * It is on by default and remembered in the browser.
 */
function readSaved() {
  try {
    return localStorage.getItem('welcome.snapObj') !== '0';
  } catch {
    return true;
  }
}

/** The snap-to-objects setting. The toolbar button reads it; app.js changes it. */
export const snapObjState = createStore(readSaved());

/**
 * The toolbar button calls toggle(). app.js sets it at start-up, because turning snapping on or off
 * also saves the choice, clears the snap marker and shows a message.
 * @type {{toggle: () => void}}
 */
export const snapObjActions = {
  toggle() {},
};
