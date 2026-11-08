import {useEffect, useRef, useSyncExternalStore} from 'react';
import {saveAsDownload} from '../projectIO.js';
import {saveState, setSave} from '../saveState.js';
import {t} from '../i18n.js';
// The Save As name prompt for browsers without a file picker. Their download cannot ask for a name, so the name typed here
// becomes the download's file name. It opens through saveState, which projectSaveAs sets.
export function SaveAsDialog() {
 const {saveAsOpen, saveAsName} = useSyncExternalStore(saveState.subscribe, saveState.get);
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const dialog = ref.current;
  if (!dialog) return;
  if (saveAsOpen && !dialog.open) dialog.showModal();
  if (!saveAsOpen && dialog.open) dialog.close();
 }, [saveAsOpen]);
 return (
  <dialog id="saveAsDialog" ref={ref} onClose={() => setSave({saveAsOpen: false})}>
   <form onSubmit={e => { e.preventDefault(); saveAsDownload(saveAsName); }}>
    <h2>{t('Save As')}</h2>
    <p>{t('This browser downloads the project file. The name below is the file name.')}</p>
    <label className="agent-field">
     {t('File name')}
     <input id="saveAsName" value={saveAsName} spellCheck={false} onChange={e => setSave({saveAsName: e.target.value})} />
    </label>
    <div className="agent-actions">
     <button type="button" id="saveAsCancel" onClick={() => setSave({saveAsOpen: false})}>{t('Cancel')}</button>
     <button type="submit" id="saveAsConfirm">{t('Save')}</button>
    </div>
   </form>
  </dialog>
 );
}
