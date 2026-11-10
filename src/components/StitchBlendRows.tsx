import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {IconSelect} from './IconSelect';
import {stitchChoiceActions, stitchChoicesState} from '../stitchChoicesState.js';
import {stitchPanelActions, stitchPanelState} from '../stitchPanelState.js';
import {useNumberInput} from './useNumberInput';
import {t} from '../i18n.js';
import {threadName} from '../threadPalette.js';
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
const DEFAULT_THREADS = ['#527461', '#d9897e', '#d3ad61', '#89a377'];
const THREAD_OPTIONS = [{value: '', label: t('None')}, ...DEFAULT_THREADS.map(hex => ({value: hex, label: threadName(hex)}))];
const paletteOptions = (value: string) => value && !THREAD_OPTIONS.some(o => o.value.toLowerCase() === value.toLowerCase()) ?
 [...THREAD_OPTIONS, {value, label: threadName(value)}] : THREAD_OPTIONS;
export function StitchBlendRows() {
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const choices = useSyncExternalStore(stitchChoicesState.subscribe, stitchChoicesState.get);
 const panel = useSyncExternalStore(stitchPanelState.subscribe, stitchPanelState.get);
 const angle = useNumberInput(panel.blendAngle, text => stitchPanelActions.commitBlendAngle(text), {min: -360, max: 360}, {allowEmpty: true, unit: '°'});
 const start = useNumberInput(panel.blendStart, text => stitchPanelActions.commitBlendRange('blendStart', text), {min: 0, max: 100}, {unit: '%'});
 const end = useNumberInput(panel.blendEnd, text => stitchPanelActions.commitBlendRange('blendEnd', text), {min: 0, max: 100}, {unit: '%'});
 return (
  <><div id="blendRow" hidden={rows.blendRow}><label>Blend into thread<select id="blendThread" value={panel.blendThread} onChange={e =>
    stitchPanelActions.chooseBlendThread(e.target.value)}>{THREAD_OPTIONS.map(o =>
    <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><div className="tool-grid" id="blendPaletteRow">{panel.blendPalette.map((value,
    k) =>
    <label key={k}>{`Color ${k + 1}`}<select id={'blendPalette' + k} value={value} onChange={e =>
    stitchPanelActions.chooseBlendPalette(k, e.target.value)}>{paletteOptions(value).map(o =>
    <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}</div><div className="tool-grid" id="blendRange"
      hidden={rows.blendRange}><label id="blendAngleRow">{"Direction (°)"}<input id="blendAngle" {...angle.inputProps} type="number" step="5" placeholder="across rows"
      title="Angle of the blend, −360 to 360°; empty blends across the rows" />{angle.note && <span className="clamp-note" role="status">{angle.note}</span>}</label><label>{"From (%)"}<input id="blendStart" {...start.inputProps} type="number" min="0" max="100" step="5" />{start.note && <span className="clamp-note" role="status">{start.note}</span>}</label><label>{"To (%)"}<input id="blendEnd" {...end.inputProps} type="number" min="0" max="100" step="5" />{end.note && <span className="clamp-note" role="status">{end.note}</span>}</label></div></div><label id="methodRow" hidden={rows.methodRow}>Fill
      pattern<IconSelect id="fillMethod" groupLabel="Fill pattern" value={choices.fillMethod} options={FILL_METHODS} onChoose={v =>
    stitchChoiceActions.choose('fillMethod', v)} /></label></>
 );
}
