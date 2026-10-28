import {createStore} from './store.js';

/**
 * The accordion and cross stitch values of the selected object: the row spacing at each end, the curve between them and
 * the cross size, as text (empty when unset). app.js sets them; the rows commit them through accordionRowsActions.
 */
export interface AccordionRows {
  accordionStart: string;
  accordionEnd: string;
  accordionEase: string;
  crossSize: string;
}

export const accordionRowsState = createStore<AccordionRows>({
  accordionStart: '',
  accordionEnd: '',
  accordionEase: 'linear',
  crossSize: '2.5',
});

/** Changes some of the accordion and cross values. */
export function setAccordionRows(patch: Partial<AccordionRows>) {
  accordionRowsState.set({...accordionRowsState.get(), ...patch});
}

/** The rows call commit(field, text) for a committed number, and choose('accordionEase', value) for the curve. app.js runs them. */
export const accordionRowsActions: {
  commit: (field: 'accordionStart' | 'accordionEnd' | 'crossSize', text: string) => void;
  choose: (field: 'accordionEase', value: string) => void;
} = {
  commit() {},
  choose() {},
};
