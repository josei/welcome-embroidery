import {createStore} from './store.js';
import {formatNumber} from './decimalText.js';
import {lang} from './i18n.js';

/** The status run's design count glyph: ready to sew, compiling, nothing to sew yet, or an error. */
export type CountGlyph = 'ready' | 'working' | 'idle' | 'error';

/** The status run below the canvas: cursor position, design count, issues button, and playback text. app.js changes it. */
export interface StatusRun {
  cursor: string;
  count: string;
  /**
   * The count as a glyph, with its number when there is a plan, set with the same text as `count`. Phones and tablets show
   * this in place of the sentence; the sentence stays as its accessible name and tooltip.
   */
  countFigure?: {text: string; value: string; glyph: CountGlyph};
  countError: boolean;
  issuesHidden: boolean;
  issuesText: string;
  /** How many issues and sewing tips the issues button counts; the phone and tablet status run shows only this number. */
  issuesCount: number;
  /** True when the design has real issues, so the issues button shows the warning triangle. Sewing tips alone do not. */
  issuesWarning: boolean;
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
  issuesWarning: false,
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
