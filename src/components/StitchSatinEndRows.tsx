import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {satinEndRowsActions, satinEndRowsState} from '../satinEndRowsState.js';
import {useNumberInput} from './useNumberInput';
import {runRowsActions, runRowsState} from '../runRowsState.js';
import {ThreadSelect} from './ThreadSelect';
import {BORDER_WIDTH_RANGE, rangeText} from '../fieldRanges.js';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function StitchSatinEndRows() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const satin = useSyncExternalStore(satinEndRowsState.subscribe, satinEndRowsState.get);
 const run = useSyncExternalStore(runRowsState.subscribe, runRowsState.get);
 const borderWidth = useNumberInput(run.borderWidth, text => runRowsActions.commit('borderWidth', text), BORDER_WIDTH_RANGE);
 const endInsetStart = useNumberInput(satin.endInsetStart, text => satinEndRowsActions.commit('endInsetStart', text), {min: 0, max: 2}, {allowEmpty: true});
 const endInsetEnd = useNumberInput(satin.endInsetEnd, text => satinEndRowsActions.commit('endInsetEnd', text), {min: 0, max: 2}, {allowEmpty: true});
 const pullRight = useNumberInput(satin.pullRight, text => satinEndRowsActions.commit('pullRight', text), {min: 0, max: 2}, {allowEmpty: true});
 const pullLeft = useNumberInput(satin.pullLeft, text => satinEndRowsActions.commit('pullLeft', text), {min: 0, max: 2}, {allowEmpty: true});
 return (
  <><label id="endInsetStartRow" hidden={rows.endInsetStartRow}>{"Satin end inset: start (mm)"}<input id="endInsetStart" {...endInsetStart.inputProps} type="number" min="0" max="2" step="0.1" placeholder="0"
      title="Moves the first needle of the satin column inward, so the start stitch is shorter" />{endInsetStart.note && <span className="clamp-note" role="status">{endInsetStart.note}</span>}</label><label id="endInsetEndRow"
        hidden={rows.endInsetEndRow}>{"Satin end inset: end (mm)"}<input id="endInsetEnd" {...endInsetEnd.inputProps} type="number" min="0" max="2" step="0.1" placeholder="0"
      title="Moves the last needle of the satin column inward, so the end stitch is shorter" />{endInsetEnd.note && <span className="clamp-note" role="status">{endInsetEnd.note}</span>}</label><label id="pullRightRow"
        hidden={rows.pullRightRow}>{"Satin pull on the right (mm)"}<input id="pullRight" {...pullRight.inputProps} type="number" min="0" max="2" step="0.05" placeholder="pull compensation"
      title={"Pulls the right-hand satin rail (as seen walking along the path) out by this much; leave empty to use the pull " +
        "compensation"} />{pullRight.note && <span className="clamp-note" role="status">{pullRight.note}</span>}</label><label id="pullLeftRow" hidden={rows.pullLeftRow}>{"Satin pull on the left (mm)"}<input id="pullLeft" {...pullLeft.inputProps} type="number" min="0" max="2" step="0.05" placeholder="pull compensation"
      title={"Pulls the left-hand satin rail (as seen walking along the path) out by this much; leave empty to use the pull " +
        "compensation"} />{pullLeft.note && <span className="clamp-note" role="status">{pullLeft.note}</span>}</label><label id="borderWidthRow" hidden={rows.borderWidthRow}>{"Border width (mm)"}<input id="borderWidth" {...borderWidth.inputProps} type="number" min="0" max="12" step="0.5"
      title="0 sews a plain running outline; more makes a satin border of that width" /><span className="field-range">{rangeText(BORDER_WIDTH_RANGE)}</span>{borderWidth.note && <span className="clamp-note" role="status">{borderWidth.note}</span>}</label><label hidden={layout.borderThreadHidden}>Border
        thread<ThreadSelect id="borderThread" label="Border thread" value={run.borderThread} disabled={run.borderThreadDisabled} onPick={hex =>
    runRowsActions.choose('borderThread', hex)} /></label></>
 );
}
