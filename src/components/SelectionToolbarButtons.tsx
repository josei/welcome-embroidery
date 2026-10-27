import {useSyncExternalStore} from 'react';
import {selectionToolbarActions, selectionToolbarState} from '../selectionToolbarState.js';

// The subtract, union and intersect buttons. Which are disabled comes from selectionToolbarState.
export function BooleanButtons() {
 const state = useSyncExternalStore(selectionToolbarState.subscribe, selectionToolbarState.get);
 return (
  <>
   <button
    className="icon-button"
    aria-label="Subtract the others from the lowest shape"
    title="Subtract the others from the lowest shape"
    data-tooltip="Subtract the others from the lowest shape"
    id="subtract"
    disabled={state.subtract}
    onClick={() => selectionToolbarActions.press('subtract')}
   ><svg className="icon"><use href="#i-subtract"/></svg></button>
   <button
    className="icon-button"
    aria-label="Union of selected shapes"
    title="Union of selected shapes"
    data-tooltip="Union of selected shapes"
    id="union"
    disabled={state.union}
    onClick={() => selectionToolbarActions.press('union')}
   ><svg className="icon"><use href="#i-union"/></svg></button>
   <button
    className="icon-button"
    aria-label="Intersection of selected shapes"
    title="Intersection of selected shapes"
    data-tooltip="Intersection of selected shapes"
    id="intersect"
    disabled={state.intersect}
    onClick={() => selectionToolbarActions.press('intersect')}
   ><svg className="icon"><use href="#i-intersect"/></svg></button>
  </>
 );
}

// The flip buttons. Both are disabled together, from selectionToolbarState.
export function FlipButtons() {
 const state = useSyncExternalStore(selectionToolbarState.subscribe, selectionToolbarState.get);
 return (
  <>
   <button
    className="icon-button tb-start"
    aria-label="Flip horizontally"
    title="Flip horizontally"
    data-tooltip="Flip horizontally"
    id="flipH"
    disabled={state.flip}
    onClick={() => selectionToolbarActions.press('flipH')}
   ><svg className="icon"><use href="#i-flip-h"/></svg></button>
   <button
    className="icon-button"
    aria-label="Flip vertically"
    title="Flip vertically"
    data-tooltip="Flip vertically"
    id="flipV"
    disabled={state.flip}
    onClick={() => selectionToolbarActions.press('flipV')}
   ><svg className="icon"><use href="#i-flip-v"/></svg></button>
  </>
 );
}
