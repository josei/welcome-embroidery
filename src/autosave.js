// @ts-check
// Autosave: the design is kept in this browser after every edit, and offered back after a reload or a crash. Each tab writes
// its own copy (see docSlot.js), so a reload restores that tab's design. Saving a project file marks it clean, so a clean
// saved design is not offered again.
import {documentNow} from './documentState.js';
import {setRestore, restoreActions} from './restoreState.js';
import {restoreProject} from './projectIO.js';
import {clone} from './appHelpers.js';
import {validateDocument} from './engine.js';
import {t} from './i18n.js';
import {editor} from './editorContext.js';
import {
  currentDocId, isDocId, LEGACY_AUTOSAVE_KEY, mountSlot, onSlotChange, openElsewhere, orphanedKeys, ownAutosaveKey,
  pruneOrphans, removeKey,
} from './docSlot.js';

/** @param {string} key @returns {any} */
function readCopy(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

/**
 * The copy to offer on start-up: this tab's own copy after a reload, otherwise the newest unsaved copy that no open tab
 * owns (a browser restart or crash). Returns the key it came from with the copy.
 * @returns {{key: string, saved: any}|null}
 */
function copyToOffer() {
  const own = readCopy(ownAutosaveKey());
  if (own) return {key: ownAutosaveKey(), saved: own};
  let best = null;
  for (const key of [...orphanedKeys(), LEGACY_AUTOSAVE_KEY]) {
    const saved = readCopy(key);
    if (!saved || saved.clean || typeof saved.savedAt !== 'number') continue;
    if (!best || saved.savedAt > best.saved.savedAt) best = {key, saved};
  }
  return best;
}

/** Mounts autosave, the page-hide flush, the open-elsewhere notice and the restore prompt. */
export function mountAutosave() {
  /** @type {any} */
  let timer = null;
  let lastKey = '';
  const write = () => {
    try {
      const state = documentNow();
      const text = JSON.stringify({savedAt: Date.now(), clean: !state.dirty, docId: currentDocId(), doc: state.doc});
      if (state.doc.revision > 0 && text.length < 4_500_000) localStorage.setItem(ownAutosaveKey(), text);
    } catch {}
  };
  const schedule = () => {
    const state = documentNow();
    const key = state.doc.revision + '|' + state.doc.name + '|' + state.dirty;
    if (key === lastKey) return;
    lastKey = key;
    clearTimeout(timer);
    timer = setTimeout(write, 700);
  };
  /** @type {any} */ (window).__autosaveHook = schedule;
  window.addEventListener('pagehide', write);
  editor.autosave = {schedule};

  mountSlot();
  onSlotChange(() => {
    const notice = document.getElementById('openElsewhere');
    if (notice) notice.hidden = !openElsewhere();
  });
  pruneOrphans();

  const offered = copyToOffer();
  if (!offered || new URL(location.href).searchParams.get('open')) return;
  const {key, saved} = offered;
  try {
    validateDocument(clone(saved.doc));
    if (!saved.clean && saved.doc.revision > 0 && saved.doc.objects.length > 0) {
      const ago = Math.max(1, Math.round((Date.now() - saved.savedAt) / 60000));
      setRestore({info: t('"{name}", {n} objects, edited {m} min ago.', {name: saved.doc.name, n: saved.doc.objects.length, m: ago})});
      restoreActions.yes = () => {
        // A copy from another tab is used up once restored; this tab's own copy is rewritten by the next autosave.
        if (key !== ownAutosaveKey()) removeKey(key);
        restoreProject({...saved.doc, docId: isDocId(saved.docId) ? saved.docId : undefined});
        setRestore({open: false});
      };
      restoreActions.no = () => {
        if (!confirm(t('Discard unsaved changes?'))) return;
        removeKey(key);
        setRestore({open: false});
      };
      queueMicrotask(() => setRestore({open: true}));
    }
  } catch {
    removeKey(key);
  }
}
