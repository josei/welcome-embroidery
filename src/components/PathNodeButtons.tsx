import {useSyncExternalStore} from 'react';
import {nodeActions, nodeButtonsState} from '../nodeButtonsState.js';

// The four path-node buttons on the canvas toolbar. Which are hidden comes from nodeButtonsState: each shows only when it applies.
export function PathNodeButtons() {
 const disabled = useSyncExternalStore(nodeButtonsState.subscribe, nodeButtonsState.get);
 return (
  <>
   <button
    className="icon-button"
    aria-label="Add node at midpoint of selected segment (or double-click a path)"
    title="Add node at midpoint of selected segment (or double-click a path)"
    data-tooltip="Add node at midpoint of selected segment (or double-click a path)"
    id="nodeAdd"
    hidden={disabled.add}
    onClick={() => nodeActions.add()}
   ><svg className="icon"><use href="#i-node-add"/></svg></button>
   <button
    className="icon-button"
    aria-label="Delete selected node (Delete key)"
    title="Delete selected node (Delete key)"
    data-tooltip="Delete selected node (Delete key)"
    id="nodeDel"
    hidden={disabled.del}
    onClick={() => nodeActions.del()}
   ><svg className="icon"><use href="#i-node-del"/></svg></button>
   <button
    className="icon-button"
    aria-label="Smooth node (Bézier handles)"
    title="Smooth node (Bézier handles)"
    data-tooltip="Smooth node (Bézier handles)"
    id="nodeSmooth"
    hidden={disabled.smooth}
    onClick={() => nodeActions.smooth()}
   ><svg className="icon"><use href="#i-node-smooth"/></svg></button>
   <button
    className="icon-button"
    aria-label="Corner node (remove handles)"
    title="Corner node (remove handles)"
    data-tooltip="Corner node (remove handles)"
    id="nodeCorner"
    hidden={disabled.corner}
    onClick={() => nodeActions.corner()}
   ><svg className="icon"><use href="#i-node-corner"/></svg></button>
  </>
 );
}
