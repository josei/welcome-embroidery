import {createStore} from './store.js';

/** The grid spacings the snap uses, in mm, in the order the chip cycles through them. */
export const GRID_SPACINGS = ['0.1', '0.25', '0.5', '1', '2', '5'];

/** The chosen grid spacing, as the select's value. app.js changes the snap grid when it changes. */
export const gridState = createStore<{value: string}>({value: '1'});

/** Sets the chosen spacing. */
export function setGridValue(value: string) {
  gridState.set({value});
}

/** The select and the chip call choose(value). app.js sets the snap grid to it and redraws. */
export const gridActions: {choose: (value: string) => void} = {
  choose() {},
};
