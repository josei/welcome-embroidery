import {createStore} from './store.js';

/**
 * The underlay choice the stitch rows show: the options for the selected object (fills and satin columns have their own),
 * and the value that is chosen. app.js sets it; the pills call underlayActions.choose.
 */
export interface UnderlayChoice {
  types: {value: string; label: string}[];
  value: string;
}

export const underlayState = createStore<UnderlayChoice>({types: [], value: 'auto'});

/** The pills call choose(value). app.js writes the value to the selected objects, or to the document when none is selected. */
export const underlayActions: {choose: (value: string) => void} = {
  choose() {},
};
