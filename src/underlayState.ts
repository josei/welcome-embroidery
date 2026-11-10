import {createStore} from './store.js';

/**
 * The underlay choice the stitch rows show: the options for the selected object (fills and satin columns have their own),
 * and the value that is chosen. app.js sets it; the underlay select calls underlayActions.choose.
 */
export interface UnderlayChoice {
  types: {value: string; label: string; hint?: string}[];
  value: string;
}

export const underlayState = createStore<UnderlayChoice>({types: [], value: 'auto'});

/** The underlay select calls choose(value). app.js writes the value to the selected objects, or to the document when none is selected. */
export const underlayActions: {choose: (value: string) => void} = {
  choose() {},
};
