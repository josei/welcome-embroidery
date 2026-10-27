import {createStore} from './store.js';

/** The knife tool's cut points in mm, in the order they were clicked. The canvas draws them; app.js changes them. */
export const knifeState = createStore(/** @type {Array<[number, number]>} */ ([]));
