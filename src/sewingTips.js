// @ts-check
// Sewing tips: plain-language advice from the same design checks the MCP agents get. One cache keyed on the document
// object, the settings list that hides categories, and the per-object ignore list kept in this browser.
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {TIP_CATEGORIES, designWarnings, visibleTips} from './engine.js';
import {hiddenTips, ignoredTips, ignoredTipsKey, TIPS_KEY} from './storedPrefs.js';
import {tipKey} from './appHelpers.js';
import {setSewTips, sewTipActions} from './sewTipsState.js';
import {t} from './i18n.js';
import {editor} from './editorContext.js';

/** @type {{doc: any, list: any[]} | null} */
let tipsCache = null;
/** @type {Map<string, any>} */
let shownTips = new Map();

/** The selected document's tips, minus the categories and individual tips the user switched off. */
export function sewingTips() {
  const doc = documentNow().doc;
  if (!tipsCache || tipsCache.doc !== doc) {
    /** @type {any[]} */
    let list = [];
    try { list = designWarnings(/** @type {any} */ (doc)); } catch {}
    tipsCache = {doc, list};
  }
  const ignored = ignoredTips();
  return visibleTips(tipsCache.list, hiddenTips()).filter(w => !ignored.has(tipKey(w)));
}

function buildTipsList() {
  const box = /** @type {HTMLElement | null} */ (document.getElementById('tipsList'));
  if (!box) return;
  const hidden = new Set(hiddenTips());
  box.replaceChildren();
  for (const category of TIP_CATEGORIES) {
    const label = document.createElement('label'), checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !hidden.has(category.id);
    checkbox.onchange = () => {
      const off = new Set(hiddenTips());
      if (checkbox.checked) off.delete(category.id); else off.add(category.id);
      try { localStorage.setItem(TIPS_KEY, JSON.stringify([...off])); } catch {}
      editor.render();
    };
    label.append(checkbox, ' ', t(category.label));
    box.append(label);
  }
}

/**
 * Shows the selected objects' tips (at most four). The card's buttons come back here by key.
 * @param {any[]} tips
 */
export function renderSewTips(tips) {
  const mine = tips.filter(w => selState().multi.has(w.id)).slice(0, 4);
  shownTips = new Map(mine.map(w => [tipKey(w), w]));
  setSewTips(mine.map(w => ({key: tipKey(w), message: w.message, canFix: Boolean(w.fix)})));
}

/** Mounts the settings list and wires the tip card's Fix and Ignore buttons. */
export function mountSewingTips() {
  buildTipsList();
  sewTipActions.fix = key => {
    const warning = shownTips.get(key);
    if (warning?.fix) editor.edit(warning.fix);
  };
  sewTipActions.ignore = key => {
    const set = ignoredTips();
    set.add(key);
    try { localStorage.setItem(ignoredTipsKey(), JSON.stringify([...set].slice(-200))); } catch {}
    editor.render();
  };
}
