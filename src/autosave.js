// @ts-check
// Autosave: the design is kept in this browser after every edit, and offered back after a reload or a crash. Saving a
// project file marks it clean, so a clean saved design is not offered again.
import {documentNow} from './documentState.js';
import {setRestore, restoreActions} from './restoreState.js';
import {restoreProject} from './projectIO.js';
import {clone} from './appHelpers.js';
import {validateDocument} from './engine.js';
import {t} from './i18n.js';
import {editor} from './editorContext.js';

const AUTOSAVE_KEY = 'welcome.autosave';

function readSaved() {
  try { return localStorage.getItem(AUTOSAVE_KEY); } catch { return null; }
}

function removeSaved() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
}

/** Mounts autosave, the page-hide flush and the restore prompt. */
export function mountAutosave() {
  /** @type {any} */
  let timer = null;
  let lastKey = '';
  const write = () => {
    try {
      const state = documentNow();
      const text = JSON.stringify({savedAt: Date.now(), clean: !state.dirty, doc: state.doc});
      if (state.doc.revision > 0 && text.length < 4_500_000) localStorage.setItem(AUTOSAVE_KEY, text);
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

  const raw = readSaved();
  if (!raw || new URL(location.href).searchParams.get('open')) return;
  try {
    const saved = JSON.parse(raw);
    validateDocument(clone(saved.doc));
    if (!saved.clean && saved.doc.revision > 0 && saved.doc.objects.length > 0) {
      const ago = Math.max(1, Math.round((Date.now() - saved.savedAt) / 60000));
      setRestore({info: t('"{name}", {n} objects, edited {m} min ago.', {name: saved.doc.name, n: saved.doc.objects.length, m: ago})});
      restoreActions.yes = () => { restoreProject(saved.doc); setRestore({open: false}); };
      restoreActions.no = () => { removeSaved(); setRestore({open: false}); };
      queueMicrotask(() => setRestore({open: true}));
    }
  } catch {
    removeSaved();
  }
}
