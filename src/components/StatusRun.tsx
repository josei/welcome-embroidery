import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {statusActions, statusState} from '../statusState.js';
import {viewMode} from '../viewMode.js';
import {toastActions} from '../toastState.js';
import {useCompactLayout} from '../compactLayout';
import {usePhoneMenu} from '../phoneSheetState.js';
import {useTabletPortrait} from '../tabletLayoutState.js';
import {MeasureReadout} from './MeasureReadout';

// The status run below the canvas. Its text and the issues button come from statusState. On a tablet the issues button shows its
// count with the warning triangle when the design has issues, or a lightbulb when it has only sewing tips; the full text stays as
// its accessible name and tooltip. On a tablet the design count is a glyph with its number, and over the hoop in Stitches view it
// stays empty, because the playback bar already names the stitch count there. On a phone and a portrait tablet both live in the top bar instead.
// The glyph the count shows for each design state. Each state has its own shape, so it reads without hover, and the error mark is
// not the triangle the issues button uses, so the two controls on one screen never share a glyph.
const COUNT_GLYPHS = {ready: '#i-run', working: '#i-working', idle: '#i-idle', error: '#i-error'} as const;

// The stitch count as a glyph and its number. The tablet footer and the phone top bar both draw it. While the design compiles
// the number is the last count, dimmed beside the working glyph, so it does not vanish and come back.
export function CountFigure({figure, error, onClick}: {
 figure: {text: string; value: string; glyph: keyof typeof COUNT_GLYPHS};
 error?: boolean;
 onClick?: () => void;
}) {
 return (
  <span id="count" className={error ? 'count-figure error' : 'count-figure'} onClick={onClick}>
   <span className="figure" role="img" aria-label={figure.text} title={figure.text}>
    <svg className="icon" aria-hidden="true" focusable="false"><use href={COUNT_GLYPHS[figure.glyph]} /></svg>
    {figure.value ? <span aria-hidden="true" className={figure.glyph === 'working' ? 'figure-stale' : undefined}>{figure.value}</span> : null}
   </span>
  </span>
 );
}

export function StatusRun() {
 const s = useSyncExternalStore(statusState.subscribe, statusState.get);
 // On a tablet the design count is an icon and its number, in the warning colour when the design has an error; the full sentence
 // stays as the name and tooltip, and the issues button beside it counts the problems.
 const compact = useCompactLayout();
 // On a phone and a portrait tablet the count and the issues button are in the top bar (TopStatusLine, TopIssues), so the footer
 // leaves them out, and so does the Messages button: the Menu holds Messages on both.
 const phoneTop = usePhoneMenu();
 const tabletTop = useTabletPortrait();
 const topBar = phoneTop || tabletTop;
 const stitchView = useSyncExternalStore(viewMode.subscribe, viewMode.get) !== 'design';
 const figure = compact && s.countFigure && s.countFigure.text === s.count ? s.countFigure : null;
 const hideOverHoop = compact && stitchView && s.countError;
 return (
  <>
   <span id="cursorPosition">{s.cursor}</span>
   <MeasureReadout />
   {topBar ? null : hideOverHoop ? (
    <span id="count" className="error" />
   ) : figure ? (
    <CountFigure figure={figure} error={s.countError} onClick={() => statusActions.compile()} />
   ) : (
    <span id="count" className={s.countError ? 'error' : undefined} onClick={() => statusActions.compile()}>{s.count}</span>
   )}
   {topBar ? null : compact ? (
    <button type="button" id="issuesBtn" className={s.issuesWarning ? 'issues-btn issues-indicator warning' : 'issues-btn issues-indicator'}
     hidden={s.issuesHidden} aria-label={s.issuesText} title={`${s.issuesText}\n${s.issuesTitle}`} onClick={() => statusActions.issues()}>
     <svg className="icon" aria-hidden="true" focusable="false"><use href={s.issuesWarning ? '#i-issues' : '#i-tip'} /></svg>
     <span aria-hidden="true">{s.issuesCount}</span>
    </button>
   ) : (
    <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} title={s.issuesTitle} onClick={() =>
     statusActions.issues()}><svg className="icon" aria-hidden="true" focusable="false"><use href="#i-issues" /></svg>{s.issuesText}</button>
   )}
   {topBar ? null : (
    <button type="button" id="messagesBtn" className="messages-btn" onClick={() => toastActions.setLogOpen(true)}>{t('Messages')}</button>
   )}
   <span id="playbackProgress" aria-live="polite">{s.playback}</span>
   <span id="needlePosition" aria-live="polite">{s.needle}</span>
  </>
 );
}

// The phone top bar's count: the second line of the design name field. It is an indicator, so it has no tap action of its own:
// a tap on it lands on the name input underneath and renames, like a tap on the name.
export function TopStatusLine() {
 const s = useSyncExternalStore(statusState.subscribe, statusState.get);
 const stitchView = useSyncExternalStore(viewMode.subscribe, viewMode.get) !== 'design';
 const figure = s.countFigure && s.countFigure.text === s.count ? s.countFigure : null;
 // Over the hoop in Stitches view an error count stays empty, because the playback bar names the stitch count there.
 const hideOverHoop = stitchView && s.countError;
 return (
  <span className="top-status">
   {hideOverHoop ? <span id="count" className="error" /> : figure ? <CountFigure figure={figure} error={s.countError} /> : (
    <span id="count" className={s.countError ? 'error' : undefined}>{s.count}</span>
   )}
  </span>
 );
}

// The phone top bar's issues button: a top-bar icon button, the same size and style as Undo, with the warning triangle (or the
// sewing-tip bulb) over the count. It opens Messages, where the issues are listed; hidden when there is nothing to show.
export function TopIssues() {
 const s = useSyncExternalStore(statusState.subscribe, statusState.get);
 return (
  <button type="button" id="issuesBtn" className={s.issuesWarning ? 'icon-button chrome-state issues-tile warning' : 'icon-button chrome-state issues-tile'}
   hidden={s.issuesHidden} aria-label={s.issuesText} title={`${s.issuesText}\n${s.issuesTitle}`} onClick={() => toastActions.setLogOpen(true)}>
   <svg className="icon" aria-hidden="true" focusable="false"><use href={s.issuesWarning ? '#i-issues' : '#i-tip'} /></svg>
   <span className="issues-count" aria-hidden="true">{s.issuesCount}</span>
  </button>
 );
}
