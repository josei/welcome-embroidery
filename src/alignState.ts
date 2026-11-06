import {createStore} from './store.js';

/** Whether the align and distribute buttons are disabled (true means disabled). toolbarSync sets it from the selection. */
export interface AlignFlags {
  align: boolean;
  distribute: boolean;
}

export const alignState = createStore<AlignFlags>({align: true, distribute: true});

/** The buttons call press() with their value: an edge (left, hcenter, right, top, vcenter, bottom) or an axis (horizontal, vertical).
 * configureToolbarCommands runs the align and distribute edit. */
export const alignActions: {press: (name: string) => void} = {
  press() {},
};
