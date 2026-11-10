// @ts-check
// The toast model, without a DOM or timers: how long a message stays, which toasts are on screen, and the log of the last
// messages. toastState.js drives it with the clock and renders it; the unit test drives it with plain numbers.

export const TOAST_MIN_MS = 4000;
export const TOAST_MAX_MS = 12000;
export const TOAST_LOG_LIMIT = 20;
export const TOAST_VISIBLE_LIMIT = 3;

/**
 * How long a confirmation stays up: a fixed base plus time to read each character, never under the minimum.
 * Error toasts do not use this; they stay until dismissed.
 * @param {string} message
 * @returns {number} milliseconds
 */
export function toastDuration(message) {
  const ms = 1500 + 55 * [...message.trim()].length;
  return Math.min(TOAST_MAX_MS, Math.max(TOAST_MIN_MS, ms));
}

/**
 * @typedef {'status' | 'error'} ToastKind
 * @typedef {{label: string, run: () => void}} ToastAction a button on the toast, e.g. Undo; running it dismisses the toast
 * @typedef {{id: number, kind: ToastKind, text: string, at: number, expiresAt: number | null, remaining: number, holds: number, action: ToastAction | null, hint: boolean}} ToastEntry
 * @typedef {{id: number, kind: ToastKind, text: string, at: number}} ToastLogEntry
 */

/**
 * A queue of toasts: messages shown together stack, the oldest confirmation is dropped from view when the stack is full
 * (it stays in the log), and errors stay until dismissed. Hovering or focusing a toast holds its timer; each hold must be
 * released before the time left runs again.
 * @param {{visibleLimit?: number, logLimit?: number}} [options]
 */
export function createToastQueue({visibleLimit = TOAST_VISIBLE_LIMIT, logLimit = TOAST_LOG_LIMIT} = {}) {
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
      const duration = kind === 'error' ? null : toastDuration(text);
      /** @type {ToastEntry} */
      const entry = {id, kind, text, at: now, expiresAt: duration === null ? null : now + duration, remaining: duration ?? 0, holds: 0, action, hint};
      // A repeat of a message already on screen replaces it rather than stacking an identical copy beside it.
      visible = [...visible.filter(item => (item.text !== text || item.kind !== kind) && !(hint && item.hint)), entry];
      // Drop the oldest confirmation from view when the stack is full. Errors are never dropped; they are dismissed by hand.
      while (visible.length > visibleLimit) {
        const oldest = visible.find(item => item.kind === 'status');
        if (!oldest) break;
        visible = visible.filter(item => item !== oldest);
      }
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
