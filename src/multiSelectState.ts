import {createStore} from './store.js';

/** The Select toggle on the selection bar (spec section 7). On, a plain tap on an object adds it to the selection, or removes it when
 * it is already selected, as Shift+click does. canvas.js reads it when a pointer goes down on an object. */
export const multiSelectState = createStore<boolean>(false);
