// @ts-check
// Desktop close guard. In the Tauri shell, closing the window or quitting asks before throwing away unsaved work. The
// shell (src-tauri/src/main.rs) keeps the unsaved flag this module reports and calls back here to ask; the browser has no
// Tauri bridge, so nothing is mounted there and browser behaviour is unchanged.
import {t} from './i18n.js';

/** @returns {((cmd: string, args?: Record<string, unknown>) => Promise<unknown>)|null} */
function tauriInvoke() {
  const internals = /** @type {any} */ (window).__TAURI_INTERNALS__;
  return internals && typeof internals.invoke === 'function' ? (cmd, args) => internals.invoke(cmd, args) : null;
}

/**
 * Connects the shell's close guard. `flush` writes the pending autosave copy; it runs before a discarded window closes.
 * `doc` is the document store; only its `dirty` flag is read. It is passed in so this module stays loadable without the
 * TypeScript build.
 * @param {() => void} flush
 * @param {{get: () => {dirty: boolean}, subscribe: (fn: () => void) => () => void}} doc
 */
export function mountDesktopClose(flush, doc) {
  const invoke = tauriInvoke();
  if (!invoke) return;

  /** @type {boolean|null} */
  let sent = null;
  const syncUnsaved = () => {
    const unsaved = doc.get().dirty;
    if (unsaved === sent) return;
    sent = unsaved;
    invoke('set_unsaved', {unsaved}).catch(() => {});
  };
  doc.subscribe(syncUnsaved);
  syncUnsaved();

  // The shell's answer to the unsaved-work prompt. On Discard the autosave copy is flushed first (it is synchronous), then
  // the shell performs the close or quit. Cancel keeps the window and app open.
  /** @type {any} */ (window).__welcomeAnswerClose = (/** @type {boolean} */ discard) => {
    if (discard) flush();
    invoke('close_decision', {discard}).catch(() => {});
  };
  // Used on platforms without a native prompt in the shell: the page's own confirm() asks.
  /** @type {any} */ (window).__welcomeConfirmClose = () => {
    /** @type {any} */ (window).__welcomeAnswerClose(confirm(t('Discard unsaved changes?')));
  };
}
