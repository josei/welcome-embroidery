import {useSyncExternalStore} from 'react';
import {snapObjActions, snapObjState} from '../snapObjState.js';

// The snap-to-other-objects toggle in the toolbar. Its active state comes from snapObjState.
export function SnapObjectButton() {
 const on = useSyncExternalStore(snapObjState.subscribe, snapObjState.get);
 return (
  <button className={on ? 'icon-button active-tool' : 'icon-button'} aria-label="Snap to other objects (nodes, midpoints, edges, centres)" title="Snap to other objects (nodes, midpoints, edges, centres)" data-tooltip="Snap to other objects" id="snapObj" onClick={() => snapObjActions.toggle()}><svg className="icon"><use href="#i-snap-obj"/></svg></button>
 );
}
