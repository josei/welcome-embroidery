import {useEffect, useRef, useSyncExternalStore} from 'react';
import {useModalDialog} from './useModalDialog';
import {answerDiscard, discardState} from '../discardState.js';
import {t} from '../i18n.js';
// The discard dialog: Save, Discard or Cancel before unsaved objects are replaced. It opens through discardState. Escape is
// Cancel, and focus starts on Save so Discard is never the one Enter presses by accident.
export function DiscardDialog() {
 const {open, name, objects, minutes, notice} = useSyncExternalStore(discardState.subscribe, discardState.get);
 const ref = useRef<HTMLDialogElement>(null);
 const save = useRef<HTMLButtonElement>(null);
 useModalDialog(ref, open);
 useEffect(() => {
  if (open) save.current?.focus();
 }, [open]);
 const count = objects === 1 ? t('1 unsaved object') : t('{n} unsaved objects', {n: objects});
 const question = minutes === null ? t('Discard {objects}?', {objects: count}) : t('Discard {objects}, edited {m} min ago?', {objects: count, m: minutes});
 return (
  <dialog id="discardDialog" ref={ref} aria-labelledby="discardTitle" onCancel={e => { e.preventDefault(); answerDiscard('cancel'); }}>
   <form method="dialog" onSubmit={e => e.preventDefault()}>
    <h2 id="discardTitle">{t('"{name}" has unsaved changes', {name: t(name)})}</h2>
    <p id="discardInfo" className="dlg-note">{question}</p>
    {notice && <p id="discardNotice" className="dlg-note" role="status">{notice}</p>}
    <div className="agent-actions discard-actions">
     <button type="button" id="discardCancel" onClick={() => answerDiscard('cancel')}>{t('Cancel')}</button>
     <button type="button" id="discardDiscard" className="danger" onClick={() => answerDiscard('discard')}>{t('Discard')}</button>
     <button type="button" id="discardSave" className="primary" ref={save} onClick={() => answerDiscard('save')}>{t('Save')}</button>
    </div>
   </form>
  </dialog>
 );
}
