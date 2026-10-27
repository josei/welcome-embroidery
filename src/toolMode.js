import {createStore} from './store.js';

/** @typedef {'select' | 'path' | 'pen' | 'line' | 'polygon' | 'star' | 'measure' | 'knife'} ToolName */

/** The drawing tool in use. The tool buttons in the sidebar read it; app.js reacts to changes. */
export const toolMode = createStore(/** @type {ToolName} */ ('select'));

/**
 * The tool buttons call press() when the user clicks one. app.js sets it at start-up,
 * because choosing a tool also finishes or cancels the one in use and redraws the hint.
 * @type {{press: (tool: ToolName) => void}}
 */
export const toolActions = {
  press() {},
};
