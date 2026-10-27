import {createStore} from './store.js';

/** The hoop row: the preset key, and the width and height as text. app.js sets them from the document. */
export interface HoopFields {
  preset: string;
  hoopW: string;
  hoopH: string;
}

export const hoopState = createStore<HoopFields>({
  preset: 'custom',
  hoopW: '',
  hoopH: '',
});

/** Changes some of the hoop fields. */
export function setHoopFields(patch: Partial<HoopFields>) {
  hoopState.set({...hoopState.get(), ...patch});
}

/**
 * The hoop row calls these: preset(key) when a preset is chosen, commit(field, text) when the width or height is committed,
 * and rotate() for the rotate button. app.js runs the edits.
 */
export const hoopActions: {
  preset: (key: string) => void;
  commit: (field: 'hoopW' | 'hoopH', text: string) => void;
  rotate: () => void;
} = {
  preset() {},
  commit() {},
  rotate() {},
};
