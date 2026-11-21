import {createStore} from './store.js';
import {formatNumber} from './decimalText.js';
import {lang} from './i18n.js';

/** The status run below the canvas: cursor position, design count, issues button, and playback text. app.js changes it. */
export interface StatusRun {
  cursor: string;
  count: string;
  /** The count as an icon and its number, set with the same text as `count`; the status run shows it on phones and tablets. */
  countFigure?: {text: string; value: string};
  countError: boolean;
  issuesHidden: boolean;
  issuesText: string;
  /** How many issues and sewing tips the issues button counts; the phone and tablet status run shows only this number. */
  issuesCount: number;
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
  issuesCount: 0,
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
