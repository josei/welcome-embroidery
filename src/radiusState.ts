import {createStore} from './store.js';

/**
 * The corner radius of the selected rectangle: the overall radius and each corner, as text. app.js sets them from the
 * rectangle; the fields commit them through radiusActions.
 */
export interface RadiusFields {
  radius: string;
  radiusTL: string;
  radiusTR: string;
  radiusBR: string;
  radiusBL: string;
}

export const radiusState = createStore<RadiusFields>({
  radius: '0',
  radiusTL: '0',
  radiusTR: '0',
  radiusBR: '0',
  radiusBL: '0',
});

/** Changes some of the radius values. */
export function setRadius(patch: Partial<RadiusFields>) {
  radiusState.set({...radiusState.get(), ...patch});
}

/** The fields call commit(field, text) when a value is committed. app.js runs the edit on the selected rectangle. */
export const radiusActions: {commit: (field: keyof RadiusFields, text: string) => void} = {
  commit() {},
};
