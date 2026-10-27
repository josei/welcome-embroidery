import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {pivotActions, pivotState} from '../pivotState.js';
// The transform panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function TransformPanel() {
 const {pivot, picking} = useSyncExternalStore(pivotState.subscribe, pivotState.get);
 const info = picking ? t('Click the canvas to set the pivot.') : pivot ? t('Pivot at {x}, {y} mm', {x: pivot[0], y: pivot[1]}) : '';
 return (
  <section id="secTransform" data-sec="" hidden><h4>Transform · mm</h4><div className="xywh"><label>X<input id="posX" type="number" step="0.1" /></label><label>Y<input id="posY" type="number" step="0.1" /></label><label>W<input id="sizeW" type="number" min="0.5" step="0.1" /></label><label>H<input id="sizeH" type="number" min="0.5" step="0.1" /></label></div><label>Rotation (°)<input id="rotation" type="number" step="1" defaultValue="0" /></label><div className="pivot-row"><button type="button" id="pivotPick" aria-pressed={picking} onClick={() => pivotActions.togglePick()} title="Choose the point the rotation field turns the selection around">Set pivot</button><button type="button" id="pivotReset" hidden={!pivot} onClick={() => pivotActions.reset()}>Use centre</button><span id="pivotInfo" className="sel-hint" role="status">{info}</span></div><div id="radiusRow" hidden><label>Corner radius (mm)<input id="radius" type="number" min="0" max="500" step="0.5" defaultValue="0" /></label><div className="corner-radii" role="group" aria-label="Corner radii (mm)"><label>TL<input id="radiusTL" type="number" min="0" max="500" step="0.5" defaultValue="0" /></label><label>TR<input id="radiusTR" type="number" min="0" max="500" step="0.5" defaultValue="0" /></label><label>BR<input id="radiusBR" type="number" min="0" max="500" step="0.5" defaultValue="0" /></label><label>BL<input id="radiusBL" type="number" min="0" max="500" step="0.5" defaultValue="0" /></label></div></div></section>
 );
}
