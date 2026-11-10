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
  /** The .thread-btn that opened the picker; focus goes back to it when a colour is picked or the picker is dismissed. */
  trigger: HTMLElement | null;
}

export const threadPopoverState = createStore<ThreadPopover>({owner: null, anchor: null, trigger: null});

/** Opens the picker for a thread select, anchored to its button. */
export function openThreadPopover(owner: ThreadOwner, anchor: {top: number; bottom: number; right: number}, trigger: HTMLElement | null = null) {
  threadPopoverState.set({owner, anchor, trigger});
}

/** Closes the picker. With returnFocus, focus moves back to the button that opened it (keyboard users keep their place). */
export function closeThreadPopover(returnFocus = false) {
  const {trigger} = threadPopoverState.get();
  threadPopoverState.set({owner: null, anchor: null, trigger: null});
  if (returnFocus && trigger?.isConnected) trigger.focus();
}
