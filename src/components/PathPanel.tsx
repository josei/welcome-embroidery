import {layoutState} from '../layoutState.js';
import {useState, useSyncExternalStore} from 'react';
import {useDecimalNumber} from './useDecimalInput';
import {toolActions, toolMode} from '../toolMode.js';
import {stitchPanelState} from '../stitchPanelState.js';
import {shapePathActions} from '../shapePathState.js';
import {shortcutFor} from '../shortcutTable.js';
import {t} from '../i18n.js';
// The shape and path tools panel, rendered by React. Ids match the markup it replaced, because tests and layout address them.
export function PathPanel() {
 // The knife's tooltip names the key from the shortcut table.
 const knifeTip = t('Knife ({shortcut}): click two points to cut the selected closed shape along the line between them', {shortcut: shortcutFor('knife')});
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const tool = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 const panel = useSyncExternalStore(stitchPanelState.subscribe, stitchPanelState.get);
 // Each number field keeps its committed text here, so each button runs with a value that is inside the field's range.
 const [holeArea, setHoleArea] = useState('1');
 const [islandArea, setIslandArea] = useState('1');
 const [offsetMm, setOffsetMm] = useState('1');
 const [strokeW, setStrokeW] = useState('3');
 const [simpTol, setSimpTol] = useState('0.2');
 const [roundMm, setRoundMm] = useState('2');
 const smallHole = useDecimalNumber(holeArea, setHoleArea, {min: 0.1, max: 20}, {unit: 'mm²'});
 const smallIsland = useDecimalNumber(islandArea, setIslandArea, {min: 0.1, max: 20}, {unit: 'mm²'});
 const offsetField = useDecimalNumber(offsetMm, setOffsetMm);
 const strokeField = useDecimalNumber(strokeW, setStrokeW, {min: 0.5, max: 40});
 const simpField = useDecimalNumber(simpTol, setSimpTol, {min: 0.05, max: 10});
 const roundField = useDecimalNumber(roundMm, setRoundMm, {min: 0.5, max: 200});
 return (
  <details id="secPath" className="sec-fold" data-sec="" hidden={layout.secPath}><summary>Shape &amp;
    path tools</summary><div className="shape-path-tools"><button type="button" id="redworkOutline" onClick={() =>
    shapePathActions.redworkOutline(
    )} title="Adds a redwork run that follows the outline of the selected closed shape, out and back"
      data-tooltip="Adds a redwork run that follows the outline of the selected closed shape, out and back">Redwork outline</button><button
        type="button" id="appliqueGroup" onClick={(
    ) =>
    shapePathActions.appliqueFromSelection(
    )} title="With two or more closed shapes selected: the bottom-most stays the fabric, and each other shape becomes an appliqué on it"
      data-tooltip="With two or more closed shapes selected: the bottom-most stays the fabric, and each other shape becomes an appliqué on it">Appliqué
        from selection</button><button type="button" id="knife" aria-pressed={tool === 'knife'} className={tool ===
    'knife' ? 'active-tool' : undefined} onClick={() =>
    toolActions.press(
    'knife')} title={knifeTip} data-tooltip={knifeTip}>Knife</button><button type="button"
        id="redworkGroup" onClick={(
    ) =>
    shapePathActions.redworkGroup(
    )} title="Makes each selected path a redwork run, out and back, and groups them by thread so each thread sews as one block"
      data-tooltip="Makes each selected path a redwork run, out and back, and groups them by thread so each thread sews as one block">Redwork by
        color</button><button type="button" id="removeSmallHoles" onClick={(
    ) =>
    shapePathActions.removeSmallHoles(holeArea)} title="Drops every hole under the hole limit from the selected closed paths"
      data-tooltip="Drops every hole under the hole limit from the selected closed paths">Remove small holes</button><label>{"Hole limit (mm²)"}<input id="smallHoleArea" type="text" inputMode="decimal" min="0.1" max="20" step="0.1" {...smallHole.inputProps}
      title="Holes smaller than this area (0.1-20 mm²) are removed" />{smallHole.note && <span className="clamp-note" role="status">{smallHole.note}</span>}</label><button type="button" id="removeSmallIslands" onClick={(
    ) =>
    shapePathActions.removeSmallIslands(islandArea)} title="Deletes every selected closed shape under the island limit (outline less holes)"
      data-tooltip="Deletes every selected closed shape under the island limit (outline less holes)">Remove small islands</button><label>{"Island limit (mm²)"}<input id="smallIslandArea" type="text" inputMode="decimal" min="0.1" max="20" step="0.1" {...smallIsland.inputProps}
      title="Closed shapes smaller than this area (0.1-20 mm², outline less holes) are deleted" />{smallIsland.note && <span className="clamp-note" role="status">{smallIsland.note}</span>}</label></div>
<div className="tool-grid"><label>{"Offset (mm)"}<input id="offsetMm" type="text" inputMode="decimal" step="0.5" {...offsetField.inputProps} />{offsetField.note && <span className="clamp-note" role="status">{offsetField.note}</span>}</label><button id="offsetBtn" onClick={() =>
  shapePathActions.offset(offsetMm)} disabled={panel.pathOffset} title="Grow (positive) or shrink (negative) the selected closed shape">Offset</button>
<label>{"Stroke width (mm)"}<input id="strokeW" type="text" inputMode="decimal" min="0.5" max="40" step="0.5" {...strokeField.inputProps} />{strokeField.note && <span className="clamp-note" role="status">{strokeField.note}</span>}</label><button id="strokeBtn" onClick={() =>
  shapePathActions.strokeToShape(strokeW)} disabled={panel.pathStroke} title="Turn the selected path into a filled shape of this width">Stroke → shape</button>
<label>{"Simplify (mm)"}<input id="simpTol" type="text" inputMode="decimal" min="0.05" max="10" step="0.05" {...simpField.inputProps} />{simpField.note && <span className="clamp-note" role="status">{simpField.note}</span>}</label><button id="simpBtn" onClick={() =>
  shapePathActions.simplify(simpTol)} disabled={panel.pathSimplify} title="Remove nodes that change the path by less than this">Simplify</button></div>
<div className="tool-grid"><label>{"Round corners (mm)"}<input id="roundMm" type="text" inputMode="decimal" min="0.5" max="200" step="0.5" {...roundField.inputProps} />{roundField.note && <span className="clamp-note" role="status">{roundField.note}</span>}</label><button id="roundBtn" onClick={() =>
  shapePathActions.roundCorners(roundMm)} title="Round the corners: rectangles get a corner radius, paths get arcs at their corner nodes (selected nodes only, when some are selected)">Round
    corners</button></div>
<div className="btn-row"><button id="reverseBtn" onClick={() =>
  shapePathActions.reverse()} disabled={panel.pathReverse} title="Reverse the path direction">Reverse</button><button id="splitBtn" onClick={() =>
  shapePathActions.split(
  )} disabled={panel.pathSplit} title="Split the selected path at the selected node">Split at node</button><button id="joinBtn" onClick={() =>
  shapePathActions.join()} disabled={panel.pathJoin} title="Join the selected open paths end to end">Join</button><button id="selectSame" onClick={() =>
  shapePathActions.selectSameThread()} title="Select every object with this thread color">Select same thread</button></div>
</details>
 );
}
