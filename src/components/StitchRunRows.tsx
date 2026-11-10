import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {runRowsActions, runRowsState} from '../runRowsState.js';
import {useNumberInput} from './useNumberInput';
import {IconSelect} from './IconSelect';
import {PillSelect} from './PillSelect';
import {underlayActions, underlayState} from '../underlayState.js';
import {stitchChoiceActions, stitchChoicesState} from '../stitchChoicesState.js';
import {stitchPanelActions, stitchPanelState} from '../stitchPanelState.js';
import {STITCH_LENGTH_RANGE, rangeText} from '../fieldRanges.js';
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
 const underlay = useSyncExternalStore(underlayState.subscribe, underlayState.get);
 const run = useSyncExternalStore(runRowsState.subscribe, runRowsState.get);
 const panel = useSyncExternalStore(stitchPanelState.subscribe, stitchPanelState.get);
 const stitchLength = useNumberInput(panel.stitchLength, text => stitchPanelActions.commitValue('stitchLength', text), STITCH_LENGTH_RANGE);
 const underlayInset = useNumberInput(panel.underlayInset, text => stitchPanelActions.commitValue('underlayInset', text), {min: 0, max: 3});
 const underlaySpacing = useNumberInput(panel.underlaySpacing, text => stitchPanelActions.commitValue('underlaySpacing', text), {min: 0.5, max: 8});
 const laydownSpacing = useNumberInput(run.laydownSpacing, text => runRowsActions.commit('laydownSpacing', text), {min: 2, max: 8}, {allowEmpty: true});
 const stemWidth = useNumberInput(run.stemWidth, text => runRowsActions.commit('stemWidth', text), {min: 0.4, max: 4}, {allowEmpty: true});
 const lengthVariance = useNumberInput(run.lengthVariance, text => runRowsActions.commit('lengthVariance', text), {min: 0, max: 50}, {unit: '%'});
 return (
  <><label id="runStyleRow" hidden={rows.runStyleRow}>Run style<IconSelect id="runStyle" groupLabel="Run style" value={choices.runStyle}
    options={RUN_STYLES} onChoose={v =>
    stitchChoiceActions.choose('runStyle', v)} /></label><label id="stemWidthRow" hidden={rows.stemWidthRow}>{"Stem width (mm)"}<input id="stemWidth" {...stemWidth.inputProps} type="number" min="0.4" max="4" step="0.1" placeholder="1.2"
      title="Full width of the stem stitch braid (0.4-4 mm); empty uses 1.2 mm" />{stemWidth.note && <span className="clamp-note" role="status">{stemWidth.note}</span>}</label><label id="underpathRow" hidden={rows.underpathRow}>Underpath
        travel <input id="underpath" type="checkbox" checked={run.underpath} onChange={e =>
    runRowsActions.choose('underpath',
    e.target.checked)} title="Hide longer travel stitches under rows that are sewn later instead of jumping" /></label><label id="varianceRow"
      hidden={rows.varianceRow}>{"Stitch length variation (%)"}<input id="lengthVariance" {...lengthVariance.inputProps} type="number" min="0" max="50" step="5"
      title="Randomises the needle spacing from row to row so the fill shows less pattern (moiré)" />{lengthVariance.note && <span className="clamp-note" role="status">{lengthVariance.note}</span>}</label><label id="stitchLenRow"
        hidden={rows.stitchLenRow}>{"Stitch length (mm)"}<input id="stitchLength" {...stitchLength.inputProps} type="number" min="0.5" max="7" step="0.1" /><span className="field-range">{rangeText(STITCH_LENGTH_RANGE)}</span>{stitchLength.note && <span className="clamp-note" role="status">{stitchLength.note}</span>}</label><label id="staggerRow"
      hidden={rows.staggerRow}>Needle stagger<select id="stagger" value={run.stagger} onChange={e =>
    runRowsActions.choose('stagger',
    e.target.value)}><option value="1">Off</option><option value="2">2 phases</option><option value="4">4 phases</option><option value="8">8
      phases</option></select></label><label id="underlayRow" className="block" hidden={rows.underlayRow}>Underlay<PillSelect id="underlayType"
        groupLabel="Underlay" value={underlay.value} options={underlay.types} onChoose={v =>
    underlayActions.choose(v)} /></label><div id="underlayDetails" className="underlay-details" hidden={rows.underlayDetails}><label>{"Inset (mm)"}<input id="underlayInset" {...underlayInset.inputProps} type="number" min="0" max="3" step="0.1" />{underlayInset.note && <span className="clamp-note" role="status">{underlayInset.note}</span>}</label><label>{"Spacing (mm)"}<input id="underlaySpacing" {...underlaySpacing.inputProps} type="number" min="0.5" max="8" step="0.1" />{underlaySpacing.note && <span className="clamp-note" role="status">{underlaySpacing.note}</span>}</label><label id="laydownSpacingRow"
      hidden={rows.laydownSpacingRow}>{"Laydown rows (mm)"}<input id="laydownSpacing" {...laydownSpacing.inputProps} type="number" min="2" max="8" step="0.5" placeholder="4"
      title="Row spacing of the laydown underlay (2-8 mm); empty uses 4 mm" />{laydownSpacing.note && <span className="clamp-note" role="status">{laydownSpacing.note}</span>}</label></div><label hidden={layout.borderHidden}>Border <input
        id="border" type="checkbox" className="icon-check" data-icon="border" checked={run.border} disabled={run.borderDisabled} onChange={e =>
    runRowsActions.choose('border', e.target.checked)} title="Border: sew an outline around the fill" /></label></>
 );
}
