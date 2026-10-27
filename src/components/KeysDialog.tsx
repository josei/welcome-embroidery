import {useEffect, useRef, useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {SHORTCUTS, setShortcutsOpen, shortcutsState} from '../shortcutsState.js';
// The keyboard shortcuts dialog, rendered by React. It opens and closes through shortcutsState, so the help button and the ? key can open it.
export function KeysDialog() {
 const open = useSyncExternalStore(shortcutsState.subscribe, shortcutsState.get);
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const dialog = ref.current;
  if (!dialog) return;
  if (open && !dialog.open) dialog.showModal();
  if (!open && dialog.open) dialog.close();
 }, [open]);
 return (
  <dialog id="keysDialog" ref={ref} onClose={() => setShortcutsOpen(false)}><form method="dialog"><h2>Keyboard shortcuts</h2><div id="keysList" className="keys-list">{SHORTCUTS.flatMap(([title, rows]) => [
   <h4 key={title}>{t(title)}</h4>,
   ...rows.flatMap(([key, desc]) => [<kbd key={'k' + key + desc}>{key}</kbd>, <span key={'d' + key + desc}>{t(desc)}</span>]),
  ])}</div><button>Close</button></form></dialog>
 );
}
