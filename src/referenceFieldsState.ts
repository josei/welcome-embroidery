import {createStore} from './store.js';

/** The reference picture's position, size and two switches. app.js sets them from the picture. */
export interface ReferenceFields {
  refX: string;
  refY: string;
  refW: string;
  refH: string;
  refVisible: boolean;
  refLocked: boolean;
}

export const referenceFieldsState = createStore<ReferenceFields>({
  refX: '',
  refY: '',
  refW: '',
  refH: '',
  refVisible: true,
  refLocked: false,
});

/** Changes some of the reference picture fields. */
export function setReferenceFields(patch: Partial<ReferenceFields>) {
  referenceFieldsState.set({...referenceFieldsState.get(), ...patch});
}

/** The reference panel calls commit(field, text) when a field is committed, and choose(field, checked) for a switch. app.js runs the edit; false puts the stored value back. */
export const referenceActions: {
  commit: (field: 'refX' | 'refY' | 'refW' | 'refH', text: string) => boolean | void;
  choose: (field: 'refVisible' | 'refLocked', checked: boolean) => void;
} = {
  commit() {},
  choose() {},
};

/** The Move on canvas button calls toggle() when it is pressed. app.js runs it: it switches the picture-moving mode. */
export const referenceMoveActions: {toggle: () => void} = {
  toggle() {},
};
