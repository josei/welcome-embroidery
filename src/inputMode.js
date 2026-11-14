// @ts-check
// Which kind of input the person used last: a touch, a mouse or pen, or the keyboard. Hints and focus styles read it so a
// phone is told to tap rather than click or press Enter. The root element carries it as data-input, so CSS can drop the
// focus ring a tap leaves behind without touching the keyboard ring.
import {createStore} from './store.js';

/** @typedef {'touch' | 'pointer' | 'keyboard'} InputKind */

export const inputMode = createStore(/** @type {InputKind} */ ('pointer'));

if (typeof window !== 'undefined') {
  const set = (/** @type {InputKind} */ kind) => {
    inputMode.set(kind);
    document.documentElement.dataset.input = kind;
  };
  // Capture phase, so the kind is set before any handler the press or key starts runs.
  window.addEventListener('pointerdown', e => set(e.pointerType === 'touch' ? 'touch' : 'pointer'), true);
  window.addEventListener('keydown', () => set('keyboard'), true);
}
