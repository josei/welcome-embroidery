import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {referenceActions, referenceFieldsState} from '../referenceFieldsState.js';
import {useDraftInput} from './useDraftInput';
// The reference image panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function ReferencePicture() {
 const fields = useSyncExternalStore(referenceFieldsState.subscribe, referenceFieldsState.get);
 const refX = useDraftInput(fields.refX, text => referenceActions.commit('refX', text));
 const refY = useDraftInput(fields.refY, text => referenceActions.commit('refY', text));
 const refW = useDraftInput(fields.refW, text => referenceActions.commit('refW', text));
 const refH = useDraftInput(fields.refH, text => referenceActions.commit('refH', text));
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 return (
  <details id="secRef" className="sec-fold"><summary>Reference image</summary><p id="refEmpty" className="sel-hint" hidden={rows.refEmpty}>Load a picture to draw over: it is shown under your shapes (never sewn), so you can trace it by hand with the drawing tools.</p><input id="refFile" type="file" accept="image/*" hidden /><div className="btn-row"><button type="button" id="refLoad">Load picture…</button><button type="button" id="refRemove" hidden={rows.refRemove}>Remove</button></div><div id="refControls" hidden={rows.refControls}><label>Opacity (%)<input id="refOpacity" type="range" min="5" max="100" step="5" defaultValue="50" /></label><label>Show the picture <input id="refVisible" type="checkbox" defaultChecked={true} /></label><label>Lock its position <input id="refLocked" type="checkbox" /></label><div className="xywh"><label>X<input id="refX" type="number" step="0.5" {...refX} /></label><label>Y<input id="refY" type="number" step="0.5" {...refY} /></label><label>W<input id="refW" type="number" min="1" step="0.5" {...refW} /></label><label>H<input id="refH" type="number" min="1" step="0.5" {...refH} /></label></div><div className="btn-row"><button type="button" id="refFit">Fit to hoop</button><button type="button" id="refMove" title="Drag the picture on the canvas to position it">Move on canvas</button></div></div></details>
 );
}
