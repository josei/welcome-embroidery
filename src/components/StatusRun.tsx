import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {statusActions, statusState} from '../statusState.js';
import {toastActions} from '../toastState.js';
import {useCompactLayout} from '../compactLayout';
import {Figure} from './Figure';
import {MeasureReadout} from './MeasureReadout';

// The status run below the canvas. Its text and the issues button come from statusState. On a phone or tablet the issues
// button shows its count only; the full text stays as its accessible name and tooltip.
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
   {compact ? (
    <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} aria-label={s.issuesText}
     title={`${s.issuesText}\n${s.issuesTitle}`} onClick={() => statusActions.issues()}>⚠ {s.issuesCount}</button>
   ) : (
    <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} title={s.issuesTitle} onClick={() =>
     statusActions.issues()}>{s.issuesText}</button>
   )}
   {compact ? (
    <button type="button" id="messagesBtn" className="messages-btn" aria-label={t('Messages')} title={t('Messages')}
     onClick={() => toastActions.setLogOpen(true)}><svg className="icon" aria-hidden="true" focusable="false"><use href="#i-msg" /></svg></button>
   ) : (
    <button type="button" id="messagesBtn" className="messages-btn" onClick={() => toastActions.setLogOpen(true)}>{t('Messages')}</button>
   )}
   <span id="playbackProgress" aria-live="polite">{s.playback}</span>
   <span id="needlePosition" aria-live="polite">{s.needle}</span>
  </>
 );
}
