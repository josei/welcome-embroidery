// @ts-check
// Editor chrome that lives outside React: the toast entry point, the shared tooltip, the fold persistence for the settings
// sections, and the shortcuts button. app.js mounts it once after the React tree exists.
import {setShortcutsOpen} from './shortcutsState.js';
import {toastActions} from './toastState.js';
import {selectionState, selState} from './selectionState.js';

/**
 * Shows a message in the toast stack and keeps it in the log. An error stays until the user dismisses it.
 * @param {string} message
 * @param {'status' | 'error'} [kind]
 * @param {{label: string, run: () => void}} [action] a button on the toast; clicking it runs the action and dismisses the toast
 */
export function toast(message, kind = 'status', action) {
  toastActions.push(message, kind, action ?? null);
}

/**
 * Shows the hint for the tool in use. It replaces any tool hint already on screen, and clears when its step ends
 * (see clearToolHints and the selection watch in mountEditorChrome).
 * @param {string} message
 */
export function toolHint(message) {
  toastActions.push(message, 'status', null, true);
}

/** Removes the tool hint on screen: the step it described has ended. */
export function clearToolHints() {
  toastActions.clearHints();
}

function mountTooltip() {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  /** @type {Element | null} */
  let current = null;
  const hide = () => { current = null; tip.classList.remove('show'); };
  /** @param {Element} el */
  const show = el => {
    const text = /** @type {HTMLElement} */ (el).dataset.tooltip;
    if (!text) { hide(); return; }
    current = el;
    tip.textContent = text;
    tip.style.left = '0px';
    tip.style.top = '0px';
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth;
    let top = r.top - h - 8;
    if (top < 6) top = r.bottom + 8;
    const left = Math.max(6, Math.min(vw - w - 6, r.left + r.width / 2 - w / 2));
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
    tip.classList.add('show');
  };
  document.addEventListener('pointerover', e => {
    const target = /** @type {any} */ (e.target);
    const el = target.closest?.('[data-tooltip]');
    if (el) show(el); else if (current) hide();
  });
  document.addEventListener('pointerleave', hide, true);
  document.addEventListener('pointerdown', hide, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
  document.addEventListener('focusin', e => {
    const target = /** @type {any} */ (e.target);
    if (target.matches?.('[data-tooltip]:focus-visible')) show(target);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
}

function mountFolds() {
  for (const element of document.querySelectorAll('details.sec-fold')) {
    const section = /** @type {HTMLDetailsElement} */ (element);
    try { section.open = localStorage.getItem('welcome.fold.' + section.id) === '1'; } catch {}
    section.addEventListener('toggle', () => {
      try { localStorage.setItem('welcome.fold.' + section.id, section.open ? '1' : '0'); } catch {}
    });
  }
}

/** Mounts the tooltip, persisted folds and the shortcuts button. */
export function mountEditorChrome() {
  // A tool hint describes the selection it was shown for, so a change of selected object ends it.
  let selected = selState().selected;
  selectionState.subscribe(() => {
    const next = selState().selected;
    if (next !== selected) { selected = next; clearToolHints(); }
  });
  mountTooltip();
  mountFolds();
  const help = /** @type {HTMLElement | null} */ (document.getElementById('helpBtn'));
  if (help) help.onclick = () => setShortcutsOpen(true);
}
