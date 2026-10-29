import {createStore} from './store.js';

/**
 * The thread colour picker: which thread select it is open for, the colour that select shows, and the function that applies
 * a picked colour to it. Both the React thread selects and the thread selects app.js still builds open it through this store.
 */
export interface ThreadOwner {
  id: string;
  value: string;
  onPick: (hex: string) => void;
}

export interface ThreadPopover {
  owner: ThreadOwner | null;
  anchor: {top: number; bottom: number; right: number} | null;
}

export const threadPopoverState = createStore<ThreadPopover>({owner: null, anchor: null});

/** Opens the picker for a thread select, anchored to its button. */
export function openThreadPopover(owner: ThreadOwner, anchor: {top: number; bottom: number; right: number}) {
  threadPopoverState.set({owner, anchor});
}

/** Closes the picker. */
export function closeThreadPopover() {
  threadPopoverState.set({owner: null, anchor: null});
}
