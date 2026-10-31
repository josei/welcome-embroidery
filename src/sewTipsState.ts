import {createStore} from './store.js';

/** One tip on the card: its key (which the buttons pass back), its text, and whether it has a fix. */
export interface SewTip {
  key: string;
  message: string;
  canFix: boolean;
}

/** The tips the card shows for the selected objects, at most four. app.js sets it on each render. */
export const sewTipsState = createStore<{tips: SewTip[]}>({tips: []});

/** Replaces the tips the card shows. */
export function setSewTips(tips: SewTip[]) {
  sewTipsState.set({tips});
}

/** The card's buttons call these with a tip's key. app.js runs them: Fix tip applies the tip's edit, Ignore hides it for the object. */
export const sewTipActions: {fix: (key: string) => void; ignore: (key: string) => void} = {
  fix() {},
  ignore() {},
};
