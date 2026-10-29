import {createStore} from './store.js';

/**
 * The photo settings of the selected picture: the row spacing and contrast as text, and whether the picture is inverted.
 * app.js sets them from the picture; the rows change them through photoRowsActions.
 */
export interface PhotoRows {
  spacing: string;
  contrast: string;
  invert: boolean;
}

export const photoRowsState = createStore<PhotoRows>({
  spacing: '0.7',
  contrast: '1.4',
  invert: false,
});

/** Changes some of the photo values. */
export function setPhotoRows(patch: Partial<PhotoRows>) {
  photoRowsState.set({...photoRowsState.get(), ...patch});
}

/** The rows call commit(field, text) for a number and choose('invert', checked) for the checkbox. app.js runs them. */
export const photoRowsActions: {
  commit: (field: 'spacing' | 'contrast', text: string) => void;
  choose: (field: 'invert', checked: boolean) => void;
} = {
  commit() {},
  choose() {},
};
