import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {runRowsActions, runRowsState} from '../runRowsState.js';
import {useDraftInput} from './useDraftInput';
import {IconSelect} from './IconSelect';
import {stitchChoiceActions, stitchChoicesState} from '../stitchChoicesState.js';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
const RUN_STYLES = [
 {value: 'single', label: 'Single run', icon: 'i-run'},
 {value: 'bean', label: 'Bean (triple) run', icon: 'i-bean'},
 {value: 'redwork', label: 'Redwork (out and back)', icon: 'i-run'},
 {value: 'stem', label: 'Stem stitch (braid)', icon: 'i-run'},
];
export function StitchRunRows() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const choices = useSyncExternalStore(stitchChoicesState.subscribe, stitchChoicesState.get);
 const run = useSyncExternalStore(runRowsState.subscribe, runRowsState.get);
 const laydownSpacing = useDraftInput(run.laydownSpacing, text => runRowsActions.commit('laydownSpacing', text));
 const stemWidth = useDraftInput(run.stemWidth, text => runRowsActions.commit('stemWidth', text));
 const lengthVariance = useDraftInput(run.lengthVariance, text => runRowsActions.commit('lengthVariance', text));
 return (
  <><label id="runStyleRow" hidden={rows.runStyleRow}>Run style<IconSelect id="runStyle" groupLabel="Run style" value={choices.runStyle} options={RUN_STYLES} onChoose={v => stitchChoiceActions.choose('runStyle', v)} /></label><label id="stemWidthRow" hidden={rows.stemWidthRow}>Stem width (mm)<input id="stemWidth" {...stemWidth} type="number" min="0.4" max="4" step="0.1" placeholder="1.2" title="Full width of the stem stitch braid (0.4-4 mm); empty uses 1.2 mm" /></label><label id="underpathRow" hidden={rows.underpathRow}>Underpath travel <input id="underpath" type="checkbox" checked={run.underpath} onChange={e => runRowsActions.choose('underpath', e.target.checked)} title="Hide longer travel stitches under rows that are sewn later instead of jumping" /></label><label id="varianceRow" hidden={rows.varianceRow}>Stitch length variation (%)<input id="lengthVariance" {...lengthVariance} type="number" min="0" max="50" step="5" title="Randomises the needle spacing from row to row so the fill shows less pattern (moiré)" /></label><label id="stitchLenRow" hidden={rows.stitchLenRow}>Stitch length (mm)<input id="stitchLength" type="number" min="0.5" max="7" step="0.1" defaultValue="3" /></label><label id="staggerRow" hidden={rows.staggerRow}>Needle stagger<select id="stagger" value={run.stagger} onChange={e => runRowsActions.choose('stagger', e.target.value)}><option value="1">Off</option><option value="2">2 phases</option><option value="4">4 phases</option><option value="8">8 phases</option></select></label><label id="underlayRow" hidden={rows.underlayRow}>Underlay<select id="underlayType"></select></label><div id="underlayDetails" className="underlay-details" hidden={rows.underlayDetails}><label>Inset (mm)<input id="underlayInset" type="number" min="0" max="3" step="0.1" defaultValue="0.4" /></label><label>Spacing (mm)<input id="underlaySpacing" type="number" min="0.5" max="8" step="0.1" defaultValue="2.2" /></label><label id="laydownSpacingRow" hidden={rows.laydownSpacingRow}>Laydown rows (mm)<input id="laydownSpacing" {...laydownSpacing} type="number" min="2" max="8" step="0.5" placeholder="4" title="Row spacing of the laydown underlay (2-8 mm); empty uses 4 mm" /></label></div><label hidden={layout.borderHidden}>Border <input id="border" type="checkbox" className="icon-check" data-icon="border" checked={run.border} disabled={run.borderDisabled} onChange={e => runRowsActions.choose('border', e.target.checked)} title="Border: sew an outline around the fill" /></label></>
 );
}
