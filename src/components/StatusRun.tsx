import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {statusActions, statusState} from '../statusState.js';
import {toastActions} from '../toastState.js';
import {useCompactLayout} from '../compactLayout';
import {Figure} from './Figure';
import {MeasureReadout} from './MeasureReadout';

// The status run below the canvas. Its text and the issues button come from statusState.
export function StatusRun() {
 const s = useSyncExternalStore(statusState.subscribe, statusState.get);
 // On a phone or tablet the design count is an icon and its number; the full sentence stays as the name and tooltip.
 const compact = useCompactLayout();
 const figure = compact && s.countFigure && s.countFigure.text === s.count ? s.countFigure : null;
 return (
  <>
   <span id="cursorPosition">{s.cursor}</span>
   <MeasureReadout />
   {figure ? (
    <span id="count" className="count-figure" onClick={() => statusActions.compile()}>
     <Figure icon="i-run" value={figure.value} label={figure.text} />
    </span>
   ) : (
    <span id="count" className={s.countError ? 'error' : undefined} onClick={() => statusActions.compile()}>{s.count}</span>
   )}
   <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} title={s.issuesTitle} onClick={() =>
     statusActions.issues()}>{s.issuesText}</button>
   <button type="button" id="messagesBtn" className="messages-btn" onClick={() => toastActions.setLogOpen(true)}>{t('Messages')}</button>
   <span id="playbackProgress" aria-live="polite">{s.playback}</span>
   <span id="needlePosition" aria-live="polite">{s.needle}</span>
  </>
 );
}
