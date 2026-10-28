import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {satinEndRowsActions, satinEndRowsState} from '../satinEndRowsState.js';
import {useSyncExternalStore} from 'react';
import {raisedRowsActions, raisedRowsState} from '../raisedRowsState.js';
import {useDraftInput} from './useDraftInput';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function StitchFillRows() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const raised = useSyncExternalStore(raisedRowsState.subscribe, raisedRowsState.get);
 const raisedSpacing = useDraftInput(raised.raisedSpacing, text => raisedRowsActions.commit('raisedSpacing', text));
 const raisedAngle = useDraftInput(raised.raisedAngle, text => raisedRowsActions.commit('raisedAngle', text));
 const satin = useSyncExternalStore(satinEndRowsState.subscribe, satinEndRowsState.get);
 const satinWidthEnd = useDraftInput(satin.satinWidthEnd, text => satinEndRowsActions.commit('satinWidthEnd', text));
 return (
  <><label id="satinButtonholeRow" hidden={rows.satinButtonholeRow}>Buttonhole (bar tacks at both ends)<input id="satinButtonhole" type="checkbox" className="icon-check" checked={raised.satinButtonhole} onChange={e => raisedRowsActions.choose('satinButtonhole', e.target.checked)} title="Buttonhole: a satin column with a bar tack across each end" /></label><label id="edgeCloseRow" hidden={rows.edgeCloseRow}>Close edges at the mask (back-stitch at cut ends)<input id="edgeClose" type="checkbox" className="icon-check" checked={raised.edgeClose} onChange={e => raisedRowsActions.choose('edgeClose', e.target.checked)} title="Edge closing: a short back-stitch at each place a run or satin is cut by a clipping mask" /></label><label id="fillRaisedRow" hidden={rows.fillRaisedRow}>Raised fill (extra tatami underlay)<input id="fillRaised" type="checkbox" className="icon-check" checked={raised.fillRaised} onChange={e => raisedRowsActions.choose('fillRaised', e.target.checked)} title="Raised fill: adds a second tatami underlay so the fill stands up" /></label><label id="raisedSpacingRow" hidden={rows.raisedSpacingRow}>Raised spacing (mm)<input id="raisedSpacing" {...raisedSpacing} type="number" min="1" max="4" step="0.5" placeholder="2" title="Row spacing of the raised underlay (1-4 mm); empty uses 2 mm" /></label><label id="raisedAngleRow" hidden={rows.raisedAngleRow}>Raised underlay turn (° from the fill)<input id="raisedAngle" {...raisedAngle} type="number" min="-180" max="180" step="5" placeholder="90" title="Angle of the raised underlay from the fill angle; 90 is across the fill, the default" /></label><label id="satinRaisedRow" hidden={rows.satinRaisedRow}>Raised satin (thick underlay)<input id="satinRaised" type="checkbox" className="icon-check" checked={raised.satinRaised} onChange={e => raisedRowsActions.choose('satinRaised', e.target.checked)} title="Raised satin: adds a centre run and a zigzag underlay under the satin so the column stands up" /></label><label id="satinEndRow" hidden={rows.satinEndRow}>End width (mm)<input id="satinWidthEnd" {...satinWidthEnd} type="number" min="0.5" max="12" step="0.5" placeholder="same" title="Leave empty for a constant width; a different value tapers the column from the start width to this one" /></label><label hidden={layout.spacingHidden}>{layout.spacingLabel}<input id="spacing" type="number" min="0.25" max="1.2" step="0.05" defaultValue="0.4" /></label><label hidden={layout.angleHidden}>Angle (°)<input id="angle" type="number" min="0" max="180" defaultValue="32" /></label></>
 );
}
