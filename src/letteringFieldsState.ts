import {createStore} from './store.js';

/**
 * The lettering panel: the selected text's fields as the text or flags the panel shows, and the actions the panel calls.
 * app.js sets the fields from the selected object and runs the actions.
 */
export interface LetteringFields {
  alongOffset: string;
  text: string;
  height: string;
  heightMin: string;
  heightMax: string;
  heightTitle: string;
  tracking: string;
  wordSpacing: string;
  lineHeight: string;
  boldMm: string;
  italicDeg: string;
  bold: boolean;
  italic: boolean;
  align: string;
  vertical: boolean;
  nameDrop: boolean;
  stitch: string;
  fontValue: string;
  fontOptions: Array<{value: string; label: string}>;
  fontInfoHidden: boolean;
  fontInfoText: string;
  textOff: boolean;
  styleOff: boolean;
}

export const letteringFieldsState = createStore<LetteringFields>({
  alongOffset: '0',
  text: 'BLOOM',
  height: '8',
  heightMin: '2',
  heightMax: '200',
  heightTitle: '',
  tracking: '0',
  wordSpacing: '0',
  lineHeight: '1',
  boldMm: '0',
  italicDeg: '0',
  bold: false,
  italic: false,
  align: 'left',
  vertical: false,
  nameDrop: false,
  stitch: 'fill',
  fontValue: 'welcome-mono/1',
  fontOptions: [
    {value: 'welcome-mono/1', label: 'Welcome Mono'},
    {value: 'neon-blinking/1', label: 'Néon blinking (centerline)'},
  ],
  fontInfoHidden: true,
  fontInfoText: '',
  textOff: false,
  styleOff: false,
});

/** Changes some of the lettering fields. */
export function setLetteringFields(patch: Partial<LetteringFields>) {
  letteringFieldsState.set({...letteringFieldsState.get(), ...patch});
}

/**
 * The lettering panel calls these. commit(field, text) runs for a committed text or number field; choose(field, value)
 * for a checkbox or select; press(name, value) for a style button. app.js runs them. commit returns false to show the
 * stored value again.
 */
export const letteringActions: {
  commit: (field: 'alongOffset' | 'text' | 'height' | 'tracking' | 'wordSpacing' | 'lineHeight' | 'boldMm' | 'italicDeg', text: string) => boolean | void;
  choose: (field: 'vertical' | 'nameDrop' | 'stitch' | 'font', value: boolean | string) => boolean | void;
  press: (name: 'bold' | 'italic' | 'align', value?: string) => void;
} = {
  commit() {},
  choose() {},
  press() {},
};
