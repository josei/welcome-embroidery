import {createStore} from './store.js';

/** The lettering panel's fields as text. app.js sets them from the selected object; the panel commits them. */
export interface LetteringFields {
  alongOffset: string;
}

export const letteringFieldsState = createStore<LetteringFields>({
  alongOffset: '0',
});

/** Changes some of the lettering fields. */
export function setLetteringFields(patch: Partial<LetteringFields>) {
  letteringFieldsState.set({...letteringFieldsState.get(), ...patch});
}

/** The lettering panel calls commit(field, text) when a field is committed. app.js runs the edit. */
export const letteringActions: {commit: (field: keyof LetteringFields, text: string) => boolean | void} = {
  commit() {},
};
