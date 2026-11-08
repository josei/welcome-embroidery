import {useEffect, useRef, useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {toastActions, toastState} from '../toastState.js';

// The toasts on screen. #toast keeps the text of the messages it shows (the tests and the public capture read it), and
// each message is its own row: a confirmation is role="status" and goes away by itself; an error is role="alert", has a
// close button and stays until it is dismissed.
// The stack is click-through, so a message never takes clicks meant for the canvas beneath it. Hover is therefore read from
// the document's pointer moves against each row's rectangle, and only an error's close button takes the pointer.
export function ToastStack() {
 const {visible} = useSyncExternalStore(toastState.subscribe, toastState.get);
 const rows = useRef(new Map<number, HTMLElement>());
 const hovered = useRef(new Set<number>());
 useEffect(() => {
  const releaseAll = () => {
   for (const id of hovered.current) toastActions.release(id);
   hovered.current.clear();
  };
  const onMove = (event: PointerEvent) => {
   for (const id of hovered.current) if (!rows.current.has(id)) hovered.current.delete(id); // dismissed while hovered
   for (const [id, row] of rows.current) {
    const r = row.getBoundingClientRect();
    const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    const was = hovered.current.has(id);
    if (inside && !was) { hovered.current.add(id); toastActions.hold(id); }
    else if (!inside && was) { hovered.current.delete(id); toastActions.release(id); }
   }
  };
  document.addEventListener('pointermove', onMove);
  document.documentElement.addEventListener('mouseleave', releaseAll);
  window.addEventListener('blur', releaseAll);
  return () => {
   document.removeEventListener('pointermove', onMove);
   document.documentElement.removeEventListener('mouseleave', releaseAll);
   window.removeEventListener('blur', releaseAll);
  };
 }, []);
 return (
  <div id={"toast"}>
   {visible.map(entry => {
    const error = entry.kind === 'error';
    return (
     <div
      key={entry.id}
      ref={el => { if (el) rows.current.set(entry.id, el); else rows.current.delete(entry.id); }}
      className={error ? 'toast-item error' : 'toast-item'}
      role={error ? 'alert' : 'status'}
      onFocus={() => toastActions.hold(entry.id)}
      onBlur={() => toastActions.release(entry.id)}
     >
      <span>{entry.text}</span>
      {error ? <button type={"button"} className={"toast-close"} aria-label={t('Dismiss')} onClick={() => toastActions.dismiss(entry.id)}>{"×"}</button> : null}
     </div>
    );
   })}
  </div>
 );
}

// The message log: the last messages, newest first, with the time each one showed. Opened from the Messages button in the status bar.
export function MessagesDialog() {
 const {logOpen, log} = useSyncExternalStore(toastState.subscribe, toastState.get);
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const dialog = ref.current;
  if (!dialog) return;
  if (logOpen && !dialog.open) dialog.showModal();
  if (!logOpen && dialog.open) dialog.close();
 }, [logOpen]);
 return (
  <dialog id={"messagesDialog"} ref={ref} aria-labelledby={"messagesTitle"} onClose={() => toastActions.setLogOpen(false)}>
   <form method={"dialog"}>
    <h2 id={"messagesTitle"}>{t('Messages')}</h2>
    {log.length ? (
     <ol id={"messagesList"} className={"messages-list"}>
      {log.map(entry => (
       <li key={entry.id} className={entry.kind === 'error' ? 'error' : undefined}>
        <time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</time>
        <span>{entry.text}</span>
       </li>
      ))}
     </ol>
    ) : <p>{t('No messages yet.')}</p>}
    <button>{t('Close')}</button>
   </form>
  </dialog>
 );
}
