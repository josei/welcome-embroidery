import {layoutState} from '../layoutState.js';
import {useSyncExternalStore} from 'react';
import {moveSelection, sortByColour} from '../sewingOrder.js';
// The sewing order panel, rendered by React. Ids match the markup it replaced, because the keyboard shortcuts and the
// context menu act on the same ids; each button moves the selection through the document or sorts it by colour.
export function SewingOrder() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 return (
  <details id="secOrder" className="sec-fold" data-sec="" hidden={layout.secOrder}><summary>Sewing order</summary>
   <div className="btn-row">
    <button id="ordBack" title="Sew first" onClick={() => moveSelection('back')}>To back</button>
    <button id="ordBackward" title="Sew earlier" onClick={() => moveSelection('backward')}>Earlier</button>
    <button id="ordForward" title="Sew later" onClick={() => moveSelection('forward')}>Later</button>
    <button id="ordFront" title="Sew last" onClick={() => moveSelection('front')}>To front</button>
    <button id="ordSort" title="Group objects by thread color to minimize color changes" onClick={() => sortByColour()}>
     Sort by color
    </button>
   </div>
  </details>
 );
}
