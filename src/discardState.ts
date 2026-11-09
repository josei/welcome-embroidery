import {createStore} from './store.js';
import {t} from './i18n.js';
import {ownAutosaveKey} from './docSlot.js';
import {lastEditTime} from './documentCommands.js';

/**
 * The discard dialog: shown before unsaved objects are thrown away (New, Open, Import, or Start fresh on the restore prompt).
 * It names the design and says what would be lost. Save runs `save` and, when that succeeds, `proceed`; Discard runs
 * `proceed`; Cancel and Escape run `cancel` and leave everything as it was.
 */
export interface DiscardDialogState {
  open: boolean;
  name: string;
  objects: number;
  /** Minutes since the last edit, or null when no edit time is known. */
  minutes: number | null;
  /** Shown under the question after a Save that did not happen. */
  notice: string;
  save: () => Promise<boolean>;
  proceed: () => void;
  cancel: () => void;
}

export const discardState = createStore<DiscardDialogState>({
  open: false,
  name: '',
  objects: 0,
  minutes: null,
  notice: '',
  save: async () => false,
  proceed() {},
  cancel() {},
});

/** Changes some of the discard dialog fields. */
function setDiscard(patch: Partial<DiscardDialogState>) {
  discardState.set({...discardState.get(), ...patch});
}

/**
 * The minutes since the open design was last edited: the last transaction this session, or else the autosave copy's time
 * (a restored design has no edit this session). Null when neither is known, so the prompt leaves the time out.
 * @returns {number|null}
 */
export function lastEditMinutes() {
  let at = lastEditTime();
  if (!at) {
    try {
      const saved = JSON.parse(localStorage.getItem(ownAutosaveKey()) || 'null');
      at = saved && typeof saved.savedAt === 'number' ? saved.savedAt : 0;
    } catch {}
  }
  return at ? Math.max(1, Math.round((Date.now() - at) / 60000)) : null;
}

/** Opens the discard dialog for a design with unsaved objects. */
export function openDiscard(next: Omit<DiscardDialogState, 'open' | 'notice'>) {
  discardState.set({...next, open: true, notice: ''});
}

/** True while a Save from the dialog is running, so a second click does not start another save. */
let saving = false;

/** Runs the answer the user picked in the dialog. */
export async function answerDiscard(choice: 'save' | 'discard' | 'cancel') {
  const current = discardState.get();
  if (!current.open || saving) return;
  if (choice === 'cancel') {
    setDiscard({open: false});
    current.cancel();
    return;
  }
  if (choice === 'discard') {
    setDiscard({open: false});
    current.proceed();
    return;
  }
  saving = true;
  try {
    if (!(await current.save())) {
      setDiscard({notice: t('Not saved. The design is still open.')});
      return;
    }
  } finally {
    saving = false;
  }
  setDiscard({open: false});
  current.proceed();
}
