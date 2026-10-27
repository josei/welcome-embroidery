import {useSyncExternalStore} from 'react';
import {selectionLabelsState} from '../selectionLabelsState.js';
// The hint shown when nothing is selected. It hides as soon as something is, through selectionLabelsState.
export function SelectionHint() {
 const {hintHidden} = useSyncExternalStore(selectionLabelsState.subscribe, selectionLabelsState.get);
 return (
  <p id="selHint" className="sel-hint" hidden={hintHidden}>{"Nothing selected. Click an object, drag a box around several, or pick a tool on the left."}</p>
 );
}
