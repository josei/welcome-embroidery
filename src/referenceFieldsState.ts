import {createStore} from './store.js';

/** The reference picture's position and size, as the text the panel shows. app.js sets them from the picture. */
export interface ReferenceFields {
  refX: string;
  refY: string;
  refW: string;
  refH: string;
}

export const referenceFieldsState = createStore<ReferenceFields>({
  refX: '',
  refY: '',
  refW: '',
  refH: '',
});

/** Changes some of the reference picture fields. */
export function setReferenceFields(patch: Partial<ReferenceFields>) {
  referenceFieldsState.set({...referenceFieldsState.get(), ...patch});
}

/** The reference panel calls commit(field, text) when a field is committed. app.js runs the edit; false puts the stored value back. */
export const referenceActions: {commit: (field: keyof ReferenceFields, text: string) => boolean | void} = {
  commit() {},
};
