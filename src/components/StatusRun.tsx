import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {statusActions, statusState} from '../statusState.js';
import {viewMode} from '../viewMode.js';
import {toastActions} from '../toastState.js';
import {useCompactLayout} from '../compactLayout';
import {usePhoneWidth} from '../phoneSheetState.js';
import {Figure} from './Figure';
import {MeasureReadout} from './MeasureReadout';

// The status run below the canvas. Its text and the issues button come from statusState. On a phone or tablet the issues
// button shows its count with the warning triangle when the design has issues, or a lightbulb when it has only sewing
// tips; the full text stays as its accessible name and tooltip. The count keeps its needle in every state, and over the hoop in Stitches view it stays empty, because the
// playback bar already names the stitch count there.
export function StatusRun() {
 const s = useSyncExternalStore(statusState.subscribe, statusState.get);
 // On a phone or tablet the design count is an icon and its number, in the warning colour when the design has an error; the
 // full sentence stays as the name and tooltip, and the issues chip beside it counts the problems.
 const compact = useCompactLayout();
 // At phone width the Menu's Issues row is the one route to the tips, so the status line shows the count as an indicator.
 const phone = usePhoneWidth();
 const stitchView = useSyncExternalStore(viewMode.subscribe, viewMode.get) !== 'design';
 const figure = compact && s.countFigure && s.countFigure.text === s.count ? s.countFigure : null;
 const hideOverHoop = compact && stitchView && s.countError;
 return (
  <>
   <span id="cursorPosition">{s.cursor}</span>
   <MeasureReadout />
   {hideOverHoop ? (
    <span id="count" className="error" />
   ) : figure ? (
    <span id="count" className={s.countError ? 'count-figure error' : 'count-figure'} onClick={() => statusActions.compile()}>
     <Figure icon="i-needle" value={figure.value} label={figure.text} />
    </span>
   ) : (
    <span id="count" className={s.countError ? 'error' : undefined} onClick={() => statusActions.compile()}>{s.count}</span>
   )}
   {phone && compact ? (
    <span id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} role="img" aria-label={s.issuesText}
     title={`${s.issuesText}\n${s.issuesTitle}`}>
     <svg className="icon" aria-hidden="true" focusable="false"><use href={s.issuesWarning ? '#i-issues' : '#i-tip'} /></svg>
     <span aria-hidden="true">{s.issuesCount}</span>
    </span>
   ) : compact ? (
    <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} aria-label={s.issuesText}
     title={`${s.issuesText}\n${s.issuesTitle}`} onClick={() => statusActions.issues()}>
     <svg className="icon" aria-hidden="true" focusable="false"><use href={s.issuesWarning ? '#i-issues' : '#i-tip'} /></svg>
     <span aria-hidden="true">{s.issuesCount}</span>
    </button>
   ) : (
    <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} title={s.issuesTitle} onClick={() =>
     statusActions.issues()}><svg className="icon" aria-hidden="true" focusable="false"><use href="#i-issues" /></svg>{s.issuesText}</button>
   )}
   <button type="button" id="messagesBtn" className="messages-btn" onClick={() => toastActions.setLogOpen(true)}>{t('Messages')}</button>
   <span id="playbackProgress" aria-live="polite">{s.playback}</span>
   <span id="needlePosition" aria-live="polite">{s.needle}</span>
  </>
 );
}
