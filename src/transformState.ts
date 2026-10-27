import {createStore} from './store.js';

/** The transform fields of the selected object, as the text the panel shows: X, Y, W, H and rotation. app.js sets them. */
export interface TransformFields {
  posX: string;
  posY: string;
  sizeW: string;
  sizeH: string;
  rotation: string;
}

export const transformState = createStore<TransformFields>({
  posX: '',
  posY: '',
  sizeW: '',
  sizeH: '',
  rotation: '0',
});

/** Changes some of the transform fields. */
export function setTransformFields(patch: Partial<TransformFields>) {
  transformState.set({...transformState.get(), ...patch});
}

/** The transform panel calls commit(field, text) when a field is committed. app.js runs the edit; false puts the stored value back. */
export const transformActions: {commit: (field: keyof TransformFields, text: string) => boolean | void} = {
  commit() {},
};
