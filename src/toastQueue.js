// @ts-check
// The toast model, without a DOM or timers: how long a message stays, which toasts are on screen, and the log of the last
// messages. toastState.js drives it with the clock and renders it; the unit test drives it with plain numbers.

/** How long a confirmation stays up: long enough to read a short sentence, short enough to not linger over the canvas. */
export const TOAST_MS = 3000;
export const TOAST_LOG_LIMIT = 20;

/**
 * @typedef {'status' | 'error'} ToastKind
 * @typedef {{label: string, run: () => void}} ToastAction a button on the toast, e.g. Undo; running it dismisses the toast
 * @typedef {{id: number, kind: ToastKind, text: string, at: number, expiresAt: number | null, remaining: number, holds: number, action: ToastAction | null, hint: boolean}} ToastEntry
 * @typedef {{id: number, kind: ToastKind, text: string, at: number}} ToastLogEntry
 */

/**
 * A queue of toasts: one confirmation is on screen at a time, so a new one replaces the one showing instead of stacking
 * over the canvas. Errors stay until dismissed and are never replaced. Hovering or focusing a toast holds its timer; each
 * hold must be released before the time left runs again.
 * @param {{logLimit?: number}} [options]
 */
export function createToastQueue({logLimit = TOAST_LOG_LIMIT} = {}) {
  let nextId = 1;
  /** @type {ToastEntry[]} */
  let visible = [];
  /** @type {ToastLogEntry[]} newest first */
  let log = [];

  /** @param {number} id */
  const find = id => visible.find(entry => entry.id === id);

  return {
    /**
     * @param {string} text
     * @param {ToastKind} kind
     * @param {number} now
     * @param {ToastAction | null} [action]
     * @param {boolean} [hint] a tool hint: at most one is on screen, so this replaces any hint already showing
     * @returns {number} the toast id
     */
    push(text, kind, now, action = null, hint = false) {
      const id = nextId++;
      const duration = kind === 'error' ? null : TOAST_MS;
      /** @type {ToastEntry} */
      const entry = {id, kind, text, at: now, expiresAt: duration === null ? null : now + duration, remaining: duration ?? 0, holds: 0, action, hint};
      // One confirmation at a time: a new confirmation (or tool hint) replaces the one on screen rather than stacking
      // beside it. Errors are kept, so a passing confirmation never hides a problem that still needs an answer; a repeated
      // error replaces its earlier copy instead of showing twice.
      visible = [...visible.filter(item => (kind === 'status' ? item.kind !== 'status' : item.kind !== kind || item.text !== text)), entry];
      log = [{id, kind, text, at: now}, ...log].slice(0, logLimit);
      return id;
    },

    /** Holds a toast's timer, for hover or focus. Holds nest. @param {number} id @param {number} now */
    pause(id, now) {
      const entry = find(id);
      if (!entry || entry.kind === 'error') return;
      entry.holds++;
      if (entry.holds === 1 && entry.expiresAt !== null) {
        entry.remaining = Math.max(0, entry.expiresAt - now);
        entry.expiresAt = null;
      }
    },

    /** Releases one hold; the timer runs again with the time it had left once every hold is released. @param {number} id @param {number} now */
    resume(id, now) {
      const entry = find(id);
      if (!entry || entry.kind === 'error' || entry.holds === 0) return;
      entry.holds--;
      if (entry.holds === 0) entry.expiresAt = now + entry.remaining;
    },

    /** Removes the tool hint on screen, if any. The log keeps it. */
    clearHints() {
      visible = visible.filter(entry => !entry.hint);
    },

    /** @param {number} id */
    dismiss(id) {
      visible = visible.filter(entry => entry.id !== id);
    },

    /** Removes the toasts whose time is up. @param {number} now @returns {number[]} the removed ids */
    expire(now) {
      const gone = visible.filter(entry => entry.expiresAt !== null && entry.expiresAt <= now).map(entry => entry.id);
      visible = visible.filter(entry => !gone.includes(entry.id));
      return gone;
    },

    /** The next moment a timer ends, or null when nothing is timed. */
    nextExpiry() {
      let next = null;
      for (const entry of visible) {
        if (entry.expiresAt !== null && (next === null || entry.expiresAt < next)) next = entry.expiresAt;
      }
      return next;
    },

    /** @returns {ToastEntry[]} oldest first */
    visible: () => visible.slice(),

    /** @returns {ToastLogEntry[]} newest first */
    log: () => log.slice(),
  };
}
