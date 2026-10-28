import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {satinEndRowsActions, satinEndRowsState} from '../satinEndRowsState.js';
import {useDraftInput} from './useDraftInput';
import {runRowsActions, runRowsState} from '../runRowsState.js';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function StitchSatinEndRows() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const satin = useSyncExternalStore(satinEndRowsState.subscribe, satinEndRowsState.get);
 const run = useSyncExternalStore(runRowsState.subscribe, runRowsState.get);
 const borderWidth = useDraftInput(run.borderWidth, text => runRowsActions.commit('borderWidth', text));
 const endInsetStart = useDraftInput(satin.endInsetStart, text => satinEndRowsActions.commit('endInsetStart', text));
 const endInsetEnd = useDraftInput(satin.endInsetEnd, text => satinEndRowsActions.commit('endInsetEnd', text));
 const pullRight = useDraftInput(satin.pullRight, text => satinEndRowsActions.commit('pullRight', text));
 const pullLeft = useDraftInput(satin.pullLeft, text => satinEndRowsActions.commit('pullLeft', text));
 return (
  <><label id="endInsetStartRow" hidden={rows.endInsetStartRow}>Satin end inset: start (mm)<input id="endInsetStart" {...endInsetStart} type="number" min="0" max="2" step="0.1" placeholder="0" title="Moves the first needle of the satin column inward, so the start stitch is shorter" /></label><label id="endInsetEndRow" hidden={rows.endInsetEndRow}>Satin end inset: end (mm)<input id="endInsetEnd" {...endInsetEnd} type="number" min="0" max="2" step="0.1" placeholder="0" title="Moves the last needle of the satin column inward, so the end stitch is shorter" /></label><label id="pullRightRow" hidden={rows.pullRightRow}>Satin pull on the right (mm)<input id="pullRight" {...pullRight} type="number" min="0" max="2" step="0.05" placeholder="pull compensation" title="Pulls the right-hand satin rail (as seen walking along the path) out by this much; leave empty to use the pull compensation" /></label><label id="pullLeftRow" hidden={rows.pullLeftRow}>Satin pull on the left (mm)<input id="pullLeft" {...pullLeft} type="number" min="0" max="2" step="0.05" placeholder="pull compensation" title="Pulls the left-hand satin rail (as seen walking along the path) out by this much; leave empty to use the pull compensation" /></label><label id="borderWidthRow" hidden={rows.borderWidthRow}>Border width (mm)<input id="borderWidth" {...borderWidth} type="number" min="0" max="12" step="0.5" title="0 sews a plain running outline; more makes a satin border of that width" /></label><label hidden={layout.borderThreadHidden}>Border thread<select id="borderThread"><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label></>
 );
}
