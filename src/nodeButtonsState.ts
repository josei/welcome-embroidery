import {createStore} from './store.js';

/** Which path-node buttons are disabled (true means disabled). app.js works it out from the selection and sets it; the buttons read it. */
export interface NodeButtons {
  add: boolean;
  del: boolean;
  smooth: boolean;
  corner: boolean;
}

export const nodeButtonsState = createStore<NodeButtons>({add: true, del: true, smooth: true, corner: true});

/** The node buttons call these. app.js sets them, because each one edits the selected path. */
export const nodeActions: {add: () => void; del: () => void; smooth: () => void; corner: () => void} = {
  add() {},
  del() {},
  smooth() {},
  corner() {},
};
