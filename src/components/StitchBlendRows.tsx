import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {IconSelect} from './IconSelect';
import {stitchChoiceActions, stitchChoicesState} from '../stitchChoicesState.js';
import {stitchPanelActions, stitchPanelState} from '../stitchPanelState.js';
import {useDraftInput} from './useDraftInput';
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
 const angle = useDraftInput(panel.blendAngle, text => stitchPanelActions.commitBlendAngle(text));
 const start = useDraftInput(panel.blendStart, text => stitchPanelActions.commitBlendRange('blendStart', text));
 const end = useDraftInput(panel.blendEnd, text => stitchPanelActions.commitBlendRange('blendEnd', text));
 return (
  <><div id="blendRow" hidden={rows.blendRow}><label>Blend into thread<select id="blendThread" value={panel.blendThread} onChange={e => stitchPanelActions.chooseBlendThread(e.target.value)}>{THREAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><div className="tool-grid" id="blendPaletteRow">{panel.blendPalette.map((value, k) => <label key={k}>Colour {k + 1}<select id={'blendPalette' + k} value={value} onChange={e => stitchPanelActions.chooseBlendPalette(k, e.target.value)}>{paletteOptions(value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}</div><div className="tool-grid" id="blendRange" hidden={rows.blendRange}><label id="blendAngleRow">Direction (°)<input id="blendAngle" {...angle} type="number" step="5" placeholder="across rows" title="Angle of the blend; empty blends across the rows" /></label><label>From (%)<input id="blendStart" {...start} type="number" min="0" max="100" step="5" /></label><label>To (%)<input id="blendEnd" {...end} type="number" min="0" max="100" step="5" /></label></div></div><label id="methodRow" hidden={rows.methodRow}>Fill pattern<IconSelect id="fillMethod" groupLabel="Fill pattern" value={choices.fillMethod} options={FILL_METHODS} onChoose={v => stitchChoiceActions.choose('fillMethod', v)} /></label></>
 );
}
