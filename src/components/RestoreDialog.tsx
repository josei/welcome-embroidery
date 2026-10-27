import {useEffect, useRef, useSyncExternalStore} from 'react';
import {restoreActions, restoreState, setRestore} from '../restoreState.js';
// The restore dialog, rendered by React. It opens and closes through restoreState, which app.js sets at start-up when an autosave can be restored.
export function RestoreDialog() {
 const {open, info} = useSyncExternalStore(restoreState.subscribe, restoreState.get);
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const dialog = ref.current;
  if (!dialog) return;
  if (open && !dialog.open) dialog.showModal();
  if (!open && dialog.open) dialog.close();
 }, [open]);
 return (
  <dialog id="restoreDialog" ref={ref} onClose={() => setRestore({open: false})}><form method="dialog"><h2>Restore your last design?</h2><p id="restoreInfo" className="dlg-note">{info}</p><div className="agent-actions"><button type="button" id="restoreYes" onClick={() => restoreActions.yes()}>Restore</button><button type="button" id="restoreNo" onClick={() => restoreActions.no()}>Start fresh</button></div></form></dialog>
 );
}
