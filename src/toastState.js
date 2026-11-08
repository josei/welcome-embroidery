// @ts-check
// The toasts on screen and the message log, shared by the toast stack, the Messages dialog and editorChrome's toast().
// The clock and the timers live here; the rules live in toastQueue.js.
import {createToastQueue} from './toastQueue.js';

/** @typedef {import('./toastQueue.js').ToastKind} ToastKind */

const queue = createToastQueue();
let logOpen = false;
/** @type {ReturnType<typeof snapshot>} */
let current = snapshot();
/** @type {Set<() => void>} */
const listeners = new Set();
/** @type {ReturnType<typeof setTimeout> | null} */
let timer = null;

function snapshot() {
  return {visible: queue.visible(), log: queue.log(), logOpen};
}

function emit() {
  current = snapshot();
  for (const listener of listeners) listener();
  arm();
}

/** Wakes up when the next confirmation ends, so it leaves the screen on time even if nothing else renders. */
function arm() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  const next = queue.nextExpiry();
  if (next === null) return;
  timer = setTimeout(() => {
    timer = null;
    if (queue.expire(Date.now()).length) emit(); else arm();
  }, Math.max(0, next - Date.now()));
}

export const toastState = {
  /** @param {() => void} listener */
  subscribe(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  get: () => current,
};

export const toastActions = {
  /**
   * @param {string} text
   * @param {ToastKind} [kind]
   * @param {import('./toastQueue.js').ToastAction | null} [action] a button on the toast, e.g. Undo
   * @returns {number}
   */
  push(text, kind = 'status', action = null) {
    const id = queue.push(text, kind, Date.now(), action);
    emit();
    return id;
  },
  /** @param {number} id */
  hold(id) { queue.pause(id, Date.now()); emit(); },
  /** @param {number} id */
  release(id) { queue.resume(id, Date.now()); emit(); },
  /** @param {number} id */
  dismiss(id) { queue.dismiss(id); emit(); },
  /** @param {boolean} open */
  setLogOpen(open) { logOpen = open; emit(); },
};
