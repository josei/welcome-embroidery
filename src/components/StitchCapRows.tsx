import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {capRowsActions, capRowsState} from '../capRowsState.js';
import {useDraftInput} from './useDraftInput';
import {IconSelect} from './IconSelect';
import {stitchChoiceActions, stitchChoicesState} from '../stitchChoicesState.js';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
const CAP_ENDS = [
 {value: 'butt', label: 'Flat ends', icon: 'i-cap-butt'},
 {value: 'round', label: 'Round ends', icon: 'i-cap-round'},
 {value: 'square', label: 'Square ends', icon: 'i-cap-square'},
];
const JOIN_CORNERS = [
 {value: 'round', label: 'Rounded corners', icon: 'i-join-round'},
 {value: 'miter', label: 'Sharp (mitered) corners', icon: 'i-join-miter'},
 {value: 'bevel', label: 'Bevelled corners', icon: 'i-join-bevel'},
];
export function StitchCapRows() {
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const cap = useSyncExternalStore(capRowsState.subscribe, capRowsState.get);
 const appliqueWidth = useDraftInput(cap.appliqueWidth, text => capRowsActions.commit('appliqueWidth', text));
 const compensation = useDraftInput(cap.compensation, text => capRowsActions.commit('compensation', text));
 const nodeWidth = useDraftInput(cap.nodeWidth, text => capRowsActions.commit('nodeWidth', text));
 const choices = useSyncExternalStore(stitchChoicesState.subscribe, stitchChoicesState.get);
 return (
  <><label id="capRow" hidden={rows.capRow}>Line ends<IconSelect id="cap" groupLabel="Line ends" value={choices.cap} options={CAP_ENDS} onChoose={v => stitchChoiceActions.choose('cap', v)} /></label><label id="joinRow" hidden={rows.joinRow}>Corners<IconSelect id="join" groupLabel="Corners" value={choices.join} options={JOIN_CORNERS} onChoose={v => stitchChoiceActions.choose('join', v)} /></label><label id="nodeWidthRow" hidden={rows.nodeWidthRow}>Width at selected node (mm)<input id="nodeWidth" {...nodeWidth} type="number" min="0.5" max="12" step="0.5" title="Select a node of the satin path in node-edit mode, then set the column width there; the width eases between nodes" /></label><div id="widthClearRow" className="btn-row" hidden={rows.widthClearRow}><button type="button" id="widthClear" title="Remove the per-node widths and go back to one width">Clear node widths</button></div><label id="appliqueRow" hidden={rows.appliqueRow}>Appliqué <input checked={cap.applique} onChange={e => capRowsActions.choose('applique', e.target.checked)} id="applique" type="checkbox" className="icon-check" data-icon="applique" title="Appliqué: sews a placement line, stops for the fabric, tacks it down, stops to trim, then covers the edge with satin (the area is not filled)" /></label><label id="appliqueWidthRow" hidden={rows.appliqueWidthRow}>Cover width (mm)<input id="appliqueWidth" type="number" min="1" max="8" step="0.5" {...appliqueWidth} /></label><label id="compRow" hidden={rows.compRow}>Pull compensation (mm)<input id="compensation" {...compensation} type="number" min="0" max="2" step="0.05" placeholder="document" title="Overrides the document pull compensation for this object; leave empty to use the document value" /></label></>
 );
}
