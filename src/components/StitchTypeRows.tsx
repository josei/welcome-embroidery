import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {selectionLabelsState} from '../selectionLabelsState.js';
import {useSyncExternalStore} from 'react';
import {typeRowsActions, typeRowsState} from '../typeRowsState.js';
import {loopRowsActions, loopRowsState} from '../loopRowsState.js';
import {useDraftInput} from './useDraftInput';
import {IconSelect} from './IconSelect';
import {stitchChoiceActions, stitchChoicesState} from '../stitchChoicesState.js';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function StitchTypeRows() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const choices = useSyncExternalStore(stitchChoicesState.subscribe, stitchChoicesState.get);
 const labels = useSyncExternalStore(selectionLabelsState.subscribe, selectionLabelsState.get);
 const type = useSyncExternalStore(typeRowsState.subscribe, typeRowsState.get);
 const loop = useSyncExternalStore(loopRowsState.subscribe, loopRowsState.get);
 const satinWidth = useDraftInput(type.satinWidth, text => typeRowsActions.commit('satinWidth', text));
 const motifSpacing = useDraftInput(type.motifSpacing, text => typeRowsActions.commit('motifSpacing', text));
 const motifSize = useDraftInput(type.motifSize, text => typeRowsActions.commit('motifSize', text));
 return (
  <><h4 id="stitchTitle">{labels.stitchTitle}</h4><label hidden={layout.typeHidden}>Stitch type<IconSelect id="type" groupLabel="Stitch type" value={choices.type} disabled={choices.typeDisabled} options={[{value: 'fill', label: 'Fill', icon: 'i-fill', disabled: choices.fillOff}, {value: 'run', label: 'Running stitch', icon: 'i-run'}, {value: 'satin', label: 'Satin column', icon: 'i-satin', disabled: choices.satinOff}, {value: 'motif', label: 'Motif loops', icon: 'i-cross'}, {value: 'sequin', label: 'Sequins', icon: 'i-ripple'}, {value: 'bead', label: 'Beads', icon: 'i-satin'}, {value: 'bling', label: 'Bling', icon: 'i-ripple'}]} onChoose={v => stitchChoiceActions.choose('type', v)} /></label><label hidden={layout.threadHidden}>Thread<select id="thread"><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label><label id="satinRow" hidden={rows.satinRow}>Satin width (mm)<input id="satinWidth" {...satinWidth} type="number" min="0.5" max="12" step="0.5" /></label><label id="motifSpacingRow" hidden={rows.motifSpacingRow}>Spacing (mm)<input id="motifSpacing" {...motifSpacing} type="number" min="1" max="20" step="0.5" /></label><label id="motifSizeRow" hidden={rows.motifSizeRow}>Size (mm)<input id="motifSize" {...motifSize} type="number" min="0.4" max="6" step="0.2" /></label><label id="motifShapeRow" hidden={rows.motifShapeRow}>Loop shape<select id="motifShape" value={loop.motifShape} onChange={e => loopRowsActions.choose('motifShape', e.target.value)}><option value="circle">Circle</option><option value="leaf">Leaf (along the path)</option></select></label><label id="motifWarpRow" hidden={rows.motifWarpRow}>Loop size warp<select id="motifWarp" title="Shrinks the motif loops from one edge of the shape to the other, or from the start of a motif path to its end (approximate depth cue)" value={loop.motifWarp} onChange={e => loopRowsActions.choose('motifWarp', e.target.value)}><option value="none">None</option><option value="x" disabled={loop.motifAlong}>Left to right</option><option value="y" disabled={loop.motifAlong}>Top to bottom</option><option value="along" disabled={!loop.motifAlong}>Along the path</option></select></label></>
 );
}
