import {useRef, useSyncExternalStore} from 'react';
import {useModalDialog} from './useModalDialog';
import {t} from '../i18n.js';
import {modifierName} from '../shortcutLabels.js';
import {SHORTCUTS, setShortcutsOpen, shortcutsState} from '../shortcutsState.js';
import {CloseButton} from './CloseButton';
// The keyboard shortcuts dialog, rendered by React. It opens and closes through shortcutsState, so the help button and the ? key can open it.
export function KeysDialog() {
 const open = useSyncExternalStore(shortcutsState.subscribe, shortcutsState.get);
 const ref = useRef<HTMLDialogElement>(null);
 useModalDialog(ref, open, '#helpBtn');
 return (
  <dialog id="keysDialog" ref={ref} onClose={() =>
    setShortcutsOpen(false)}><form method="dialog"><div className="dialog-head"><h2>Keyboard shortcuts</h2><CloseButton type="submit" /></div><div id="keysList" className="keys-list">{SHORTCUTS.map(([title, rows]) => (
   <section className="keys-group" key={title}>
    <h4>{t(title)}</h4>
    {rows.flatMap(([key, desc]) => [<kbd key={'k' + key + desc}>{key}</kbd>, <span key={'d' + key + desc}>{t(desc, {shift: modifierName('shift'), alt: modifierName('alt')})}</span>])}
   </section>
  ))}</div></form></dialog>
 );
}
