import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {t} from './i18n.js';

/** Where the selected objects go: first, one step earlier, one step later, or last. */
export type OrderMove = 'back' | 'backward' | 'forward' | 'front';

/** What the sewing order needs from the editor, supplied by app.js. */
export interface OrderApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void, coalesceKey?: string, label?: string): boolean;
}

let api: OrderApi | null = null;

/** Wires the editor commands the sewing order needs, once. */
export function configureSewingOrder(next: OrderApi) {
  api = next;
}

/** The wired editor commands. app.js calls configureSewingOrder before a button can reorder anything. */
function wired(): OrderApi {
  if (!api) throw Error('The sewing order is not wired.');
  return api;
}

/** Moves every selected object to the back or front, or one step earlier or later, keeping their relative order. */
export function moveSelection(to: OrderMove) {
  const ids = (documentNow().doc.objects as Array<{id: string}>).map(o => o.id).filter(id => selState().multi.has(id));
  if (to === 'back' || to === 'forward') ids.reverse();
  if (ids.length) wired().edit(ids.map(id => ({op: 'reorder', id, to})), undefined, undefined, t('reorder'));
}

/** Groups the document's objects by thread colour, so the machine changes thread as few times as it can. */
export function sortByColour() {
  wired().edit([{op: 'sort_by_color'}]);
}
