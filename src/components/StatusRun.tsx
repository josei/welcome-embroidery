import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {statusActions, statusState} from '../statusState.js';
import {toastActions} from '../toastState.js';
import {MeasureReadout} from './MeasureReadout';

// The status run below the canvas. Its text and the issues button come from statusState.
export function StatusRun() {
 const s = useSyncExternalStore(statusState.subscribe, statusState.get);
 return (
  <>
   <span id="cursorPosition">{s.cursor}</span>
   <MeasureReadout />
   <span id="count" className={s.countError ? 'error' : undefined} onClick={() => statusActions.compile()}>{s.count}</span>
   <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} title={s.issuesTitle} onClick={() =>
     statusActions.issues()}>{s.issuesText}</button>
   <button type="button" id="messagesBtn" className="messages-btn" onClick={() => toastActions.setLogOpen(true)}>{t('Messages')}</button>
   <span id="playbackProgress" aria-live="polite">{s.playback}</span>
   <span id="needlePosition" aria-live="polite">{s.needle}</span>
  </>
 );
}
