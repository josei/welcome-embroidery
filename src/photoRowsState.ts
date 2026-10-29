import {createStore} from './store.js';

/**
 * The photo settings of the selected picture: the row spacing and contrast as text, whether the picture is inverted, and the
 * second to fourth threads (empty when unset).
 * app.js sets them from the picture; the rows change them through photoRowsActions.
 */
export interface PhotoRows {
  spacing: string;
  contrast: string;
  invert: boolean;
  thread2: string;
  thread3: string;
  thread4: string;
}

export const photoRowsState = createStore<PhotoRows>({
  spacing: '0.7',
  contrast: '1.4',
  invert: false,
  thread2: '',
  thread3: '',
  thread4: '',
});

/** Changes some of the photo values. */
export function setPhotoRows(patch: Partial<PhotoRows>) {
  photoRowsState.set({...photoRowsState.get(), ...patch});
}

/** The rows call commit(field, text) for a number, choose('invert', checked) for the checkbox, and pickThread for a thread. app.js runs them. */
export const photoRowsActions: {
  commit: (field: 'spacing' | 'contrast', text: string) => void;
  choose: (field: 'invert', checked: boolean) => void;
  pickThread: (key: 'thread2' | 'thread3' | 'thread4', hex: string) => void;
} = {
  commit() {},
  choose() {},
  pickThread() {},
};
