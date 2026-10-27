import {createStore} from './store.js';

/**
 * The stitch choices that are picked from a select drawn with icon segments: fill method, cap, join, stitch type and run style,
 * plus the disabled state of the type select and of its satin and fill options. app.js sets them as the selection changes.
 */
export interface StitchChoices {
  fillMethod: string;
  cap: string;
  join: string;
  type: string;
  runStyle: string;
  typeDisabled: boolean;
  satinOff: boolean;
  fillOff: boolean;
}

export const stitchChoicesState = createStore<StitchChoices>({
  fillMethod: 'rows',
  cap: 'butt',
  join: 'round',
  type: 'fill',
  runStyle: 'single',
  typeDisabled: false,
  satinOff: false,
  fillOff: false,
});

/** Changes some of the stitch choices. */
export function setStitchChoices(patch: Partial<StitchChoices>) {
  stitchChoicesState.set({...stitchChoicesState.get(), ...patch});
}

/** The icon selects call choose(id, value) when the user picks a value. app.js runs the edit. */
export const stitchChoiceActions: {choose: (id: 'fillMethod' | 'cap' | 'join' | 'type' | 'runStyle', value: string) => void} = {
  choose() {},
};
