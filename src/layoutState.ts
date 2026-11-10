import {createStore} from './store.js';

/**
 * Which sections and labels of the inspector are shown. app.js sets them from the selection; the components draw them.
 * The section fields are true when the section is hidden, as the markup's hidden attribute is.
 */
export interface Layout {
  secTransform: boolean;
  secStitch: boolean;
  secText: boolean;
  secPath: boolean;
  secArray: boolean;
  secOrder: boolean;
  typeHidden: boolean;
  threadHidden: boolean;
  spacingHidden: boolean;
  spacingLabel: string;
  angleHidden: boolean;
  /** The angle field is shown but cannot be edited, e.g. when some selected fills do not use rows. */
  angleDisabled: boolean;
  /** Why the angle field is disabled, shown under it; empty when it is enabled. */
  angleNote: string;
  borderHidden: boolean;
  borderThreadHidden: boolean;
  objectHeadingHidden: boolean;
}

export const layoutState = createStore<Layout>({
  secTransform: true,
  secStitch: true,
  secText: true,
  secPath: true,
  secArray: true,
  secOrder: true,
  typeHidden: false,
  threadHidden: false,
  spacingHidden: false,
  spacingLabel: 'Row spacing (mm)',
  angleHidden: false,
  angleDisabled: false,
  angleNote: '',
  borderHidden: false,
  borderThreadHidden: false,
  objectHeadingHidden: true,
});

/** Changes some of the layout fields. */
export function setLayout(patch: Partial<Layout>) {
  layoutState.set({...layoutState.get(), ...patch});
}
