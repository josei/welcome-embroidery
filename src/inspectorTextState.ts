import {createStore} from './store.js';

/** The inspector heading (the selected object's name) and the design summary line. app.js sets them as the design changes. */
export interface InspectorText {
  heading: string;
  summary: string;
}

export const inspectorTextState = createStore<InspectorText>({
  heading: 'Select an object',
  summary: 'No generated stitches.',
});

/** Changes some of the inspector text. */
export function setInspectorText(patch: Partial<InspectorText>) {
  inspectorTextState.set({...inspectorTextState.get(), ...patch});
}
