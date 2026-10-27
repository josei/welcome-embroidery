import {createStore} from './store.js';

/** @typedef {'design' | 'stitches' | 'preview'} ViewMode */

/** The view the editor shows. The header switch reads and writes it; app.js reacts to changes. */
export const viewMode = createStore(/** @type {ViewMode} */ ('design'));

/**
 * The header switch calls choose() when the user picks a view. app.js sets it at start-up,
 * because a view change also stops playback, compiles when needed and redraws the canvas.
 * @type {{choose: (view: ViewMode) => void}}
 */
export const viewActions = {
  choose() {},
};
