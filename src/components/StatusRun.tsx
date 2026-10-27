import {useSyncExternalStore} from 'react';
import {statusActions, statusState} from '../statusState.js';
import {MeasureReadout} from './MeasureReadout';

// The status run below the canvas. Its text and the issues button come from statusState.
export function StatusRun() {
 const s = useSyncExternalStore(statusState.subscribe, statusState.get);
 return (
  <>
   <span id="cursorPosition">{s.cursor}</span>
   <MeasureReadout />
   <span id="count" className={s.countError ? 'error' : undefined} onClick={() => statusActions.compile()}>{s.count}</span>
   <button type="button" id="issuesBtn" className="issues-btn" hidden={s.issuesHidden} title={s.issuesTitle} onClick={() => statusActions.issues()}>{s.issuesText}</button>
   <span id="playbackProgress" aria-live="polite">{s.playback}</span>
   <span id="needlePosition" aria-live="polite">{s.needle}</span>
  </>
 );
}
