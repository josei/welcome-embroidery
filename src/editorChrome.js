// @ts-check
// Editor chrome that lives outside React: the toast, the shared tooltip, the fold persistence for the settings
// sections, and the shortcuts button. app.js mounts it once after the React tree exists.
import {setShortcutsOpen} from './shortcutsState.js';

/** @param {string} message */
export function toast(message) {
  const root = /** @type {HTMLElement | null} */ (document.getElementById('toast'));
  if (!root) return;
  root.textContent = message;
  root.classList.add('show');
  setTimeout(() => root.classList.remove('show'), 2600);
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

/** Mounts the toast target, tooltip, persisted folds and the shortcuts button. */
export function mountEditorChrome() {
  mountTooltip();
  mountFolds();
  const help = /** @type {HTMLElement | null} */ (document.getElementById('helpBtn'));
  if (help) help.onclick = () => setShortcutsOpen(true);
}
