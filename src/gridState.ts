import {createStore} from './store.js';

/** The grid spacings the snap uses, in mm, in the order the chip cycles through them. */
export const GRID_SPACINGS = ['0.1', '0.25', '0.5', '1', '2', '5'];

/** The chosen grid spacing, as the select's value. The canvas reads it for snapping. */
export const gridState = createStore<{value: string}>({value: '1'});

/** Sets the chosen spacing. */
export function setGridValue(value: string) {
  gridState.set({value});
}

/** The select and the chip call choose(value). configureGrid sets the snap grid to it and redraws. */
export const gridActions: {choose: (value: string) => void} = {
  choose() {},
};

/** What choosing a spacing needs from the editor. */
export interface GridApi {
  render(): void;
}

let api: GridApi | null = null;

/** Wires the select and the chip, once. */
export function configureGrid(next: GridApi) {
  api = next;
  gridActions.choose = value => {
    setGridValue(value);
    api?.render();
  };
}
