import {createStore} from './store.js';

/** Which selection-toolbar buttons are disabled (true means disabled). app.js works it out from the selection and sets it. */
export interface SelectionToolbar {
  subtract: boolean;
  union: boolean;
  intersect: boolean;
  flip: boolean;
}

export type ToolbarName = 'subtract' | 'union' | 'intersect' | 'flipH' | 'flipV';

export const selectionToolbarState = createStore<SelectionToolbar>({
  subtract: true,
  union: true,
  intersect: true,
  flip: true,
});

/**
 * The buttons call press() with their name, and clip()/unclip()/textOnPath()/textOffPath() for the mask and text-on-path
 * buttons. app.js sets them, because each one edits the selected objects.
 */
export const selectionToolbarActions: {
  press: (name: ToolbarName) => void;
  clip: () => void;
  unclip: () => void;
  textOnPath: () => void;
  textOffPath: () => void;
} = {
  press() {},
  clip() {},
  unclip() {},
  textOnPath() {},
  textOffPath() {},
};
