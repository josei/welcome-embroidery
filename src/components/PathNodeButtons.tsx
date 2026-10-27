import {useSyncExternalStore} from 'react';
import {nodeActions, nodeButtonsState} from '../nodeButtonsState.js';

// The four path-node buttons in the tool row. Which of them are disabled comes from nodeButtonsState.
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
    disabled={disabled.add}
    onClick={() => nodeActions.add()}
   ><svg className="icon"><use href="#i-node-add"/></svg></button>
   <button
    className="icon-button"
    aria-label="Delete selected node (Delete key)"
    title="Delete selected node (Delete key)"
    data-tooltip="Delete selected node (Delete key)"
    id="nodeDel"
    disabled={disabled.del}
    onClick={() => nodeActions.del()}
   ><svg className="icon"><use href="#i-node-del"/></svg></button>
   <button
    className="icon-button"
    aria-label="Smooth node (Bézier handles)"
    title="Smooth node (Bézier handles)"
    data-tooltip="Smooth node (Bézier handles)"
    id="nodeSmooth"
    disabled={disabled.smooth}
    onClick={() => nodeActions.smooth()}
   ><svg className="icon"><use href="#i-node-smooth"/></svg></button>
   <button
    className="icon-button"
    aria-label="Corner node (remove handles)"
    title="Corner node (remove handles)"
    data-tooltip="Corner node (remove handles)"
    id="nodeCorner"
    disabled={disabled.corner}
    onClick={() => nodeActions.corner()}
   ><svg className="icon"><use href="#i-node-corner"/></svg></button>
  </>
 );
}
