import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {IconSelect} from './IconSelect';
import {stitchChoiceActions, stitchChoicesState} from '../stitchChoicesState.js';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
const FILL_METHODS = [
 {value: 'rows', label: 'Rows (tatami)', icon: 'i-rows'},
 {value: 'contour', label: 'Contours (concentric)', icon: 'i-contour'},
 {value: 'spiral', label: 'Spiral', icon: 'i-spiral'},
 {value: 'meander', label: 'Meander', icon: 'i-meander'},
 {value: 'guided', label: 'Guided (follows a line)', icon: 'i-guided'},
 {value: 'cross', label: 'Cross stitch', icon: 'i-cross'},
 {value: 'ripple', label: 'Ripple', icon: 'i-ripple'},
 {value: 'motif', label: 'Motif loops', icon: 'i-bean'},
 {value: 'sequin', label: 'Sequin fill', icon: 'i-ripple'},
 {value: 'bling', label: 'Bling fill', icon: 'i-ripple'},
];
export function StitchBlendRows() {
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const choices = useSyncExternalStore(stitchChoicesState.subscribe, stitchChoicesState.get);
 return (
  <><div id="blendRow" hidden={rows.blendRow}><label>Blend into thread<select id="blendThread"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label><div className="tool-grid" id="blendPaletteRow"><label>Colour 1<select id="blendPalette0"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label><label>Colour 2<select id="blendPalette1"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label><label>Colour 3<select id="blendPalette2"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label><label>Colour 4<select id="blendPalette3"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label></div><div className="tool-grid" id="blendRange" hidden={rows.blendRange}><label id="blendAngleRow">Direction (°)<input id="blendAngle" type="number" step="5" placeholder="across rows" title="Angle of the blend; empty blends across the rows" /></label><label>From (%)<input id="blendStart" type="number" min="0" max="100" step="5" defaultValue="0" /></label><label>To (%)<input id="blendEnd" type="number" min="0" max="100" step="5" defaultValue="100" /></label></div></div><label id="methodRow" hidden={rows.methodRow}>Fill pattern<IconSelect id="fillMethod" groupLabel="Fill pattern" value={choices.fillMethod} options={FILL_METHODS} onChoose={v => stitchChoiceActions.choose('fillMethod', v)} /></label></>
 );
}
