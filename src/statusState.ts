import {createStore} from './store.js';
import {formatNumber} from './decimalText.js';
import {lang} from './i18n.js';

/** The status run below the canvas: cursor position, design count, issues button, and playback text. app.js changes it. */
export interface StatusRun {
  cursor: string;
  count: string;
  countError: boolean;
  issuesHidden: boolean;
  issuesText: string;
  issuesTitle: string;
  playback: string;
  needle: string;
}

export const statusState = createStore<StatusRun>({
  cursor: `x ${formatNumber(0, lang, 1)} mm · y ${formatNumber(0, lang, 1)} mm`,
  count: 'Compile the design',
  countError: false,
  issuesHidden: true,
  issuesText: '',
  issuesTitle: '',
  playback: '',
  needle: '',
});

/** Changes some of the status run's fields. */
export function setStatus(patch: Partial<StatusRun>) {
  statusState.set({...statusState.get(), ...patch});
}

/** The design count and the issues button call these. app.js sets them. */
export const statusActions: {compile: () => void; issues: () => void} = {
  compile() {},
  issues() {},
};
