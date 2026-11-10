import {layoutState} from '../layoutState.js';
import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {pivotActions, pivotState} from '../pivotState.js';
import {transformActions, transformState} from '../transformState.js';
import {useDecimalNumber} from './useDecimalInput';
import {SHAPE_SIZE_RANGE} from '../fieldRanges.js';
import {radiusActions, radiusState} from '../radiusState.js';
// The transform panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function TransformPanel() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const radiusFields = useSyncExternalStore(radiusState.subscribe, radiusState.get);
 const radius = useDecimalNumber(radiusFields.radius, text => radiusActions.commit('radius', text), {min: 0, max: 500});
 const radiusTL = useDecimalNumber(radiusFields.radiusTL, text => radiusActions.commit('radiusTL', text), {min: 0, max: 500});
 const radiusTR = useDecimalNumber(radiusFields.radiusTR, text => radiusActions.commit('radiusTR', text), {min: 0, max: 500});
 const radiusBR = useDecimalNumber(radiusFields.radiusBR, text => radiusActions.commit('radiusBR', text), {min: 0, max: 500});
 const radiusBL = useDecimalNumber(radiusFields.radiusBL, text => radiusActions.commit('radiusBL', text), {min: 0, max: 500});
 const {pivot, picking} = useSyncExternalStore(pivotState.subscribe, pivotState.get);
 const fields = useSyncExternalStore(transformState.subscribe, transformState.get);
 const posX = useDecimalNumber(fields.posX, text => transformActions.commit('posX', text));
 const posY = useDecimalNumber(fields.posY, text => transformActions.commit('posY', text));
 const sizeW = useDecimalNumber(fields.sizeW, text => transformActions.commit('sizeW', text), SHAPE_SIZE_RANGE);
 const sizeH = useDecimalNumber(fields.sizeH, text => transformActions.commit('sizeH', text), SHAPE_SIZE_RANGE);
 const rotation = useDecimalNumber(fields.rotation, text => transformActions.commit('rotation', text), undefined, {unit: '°'});
 const info = picking ? t('Click the canvas to set the pivot.') : pivot ? t('Pivot at {x}, {y} mm', {x: pivot[0], y: pivot[1]}) : '';
 return (
  <section id="secTransform" data-sec="" hidden={layout.secTransform}><h4 className="section-heading">Transform · mm</h4><div className="xywh"><label>X<input id="posX" type="text" inputMode="decimal"
    step="0.1" {...posX.inputProps} />{posX.note && <span className="clamp-note" role="status">{posX.note}</span>}</label><label>Y<input id="posY" type="text" inputMode="decimal" step="0.1" {...posY.inputProps} />{posY.note && <span className="clamp-note" role="status">{posY.note}</span>}</label><label>W<input id="sizeW" type="text" inputMode="decimal" min="0.5"
      step="0.1" {...sizeW.inputProps} />{sizeW.note && <span className="clamp-note" role="status">{sizeW.note}</span>}</label><label>H<input id="sizeH" type="text" inputMode="decimal" min="0.5" step="0.1" {...sizeH.inputProps} />{sizeH.note && <span className="clamp-note" role="status">{sizeH.note}</span>}</label></div><label>{"Rotation (°)"}<input id="rotation" type="text" inputMode="decimal" step="1" {...rotation.inputProps} />{rotation.note && <span className="clamp-note" role="status">{rotation.note}</span>}</label><div className="pivot-row"><button type="button" id="pivotPick"
      aria-pressed={picking} onClick={(
    ) =>
    pivotActions.togglePick(
    )} title="Choose the point the rotation field turns the selection around">Set pivot</button><button type="button" id="pivotReset" hidden={!pivot} onClick={(
    ) =>
    pivotActions.reset(
    )}>Use center</button><span id="pivotInfo" className="sel-hint" role="status">{info}</span></div><div id="radiusRow"
      hidden={rows.radiusRow}><label>{"Corner radius (mm)"}<input id="radius" {...radius.inputProps} type="text" inputMode="decimal" min="0" max="500" step="0.5" />{radius.note && <span className="clamp-note" role="status">{radius.note}</span>}</label><div className="corner-radii" role="group"
      aria-label="Corner radii (mm)"><label>TL<input id="radiusTL" {...radiusTL.inputProps} type="text" inputMode="decimal" min="0" max="500" step="0.5" />{radiusTL.note && <span className="clamp-note" role="status">{radiusTL.note}</span>}</label><label>TR<input
        id="radiusTR" {...radiusTR.inputProps} type="text" inputMode="decimal" min="0" max="500" step="0.5" />{radiusTR.note && <span className="clamp-note" role="status">{radiusTR.note}</span>}</label><label>BR<input id="radiusBR" {...radiusBR.inputProps} type="text" inputMode="decimal"
          min="0" max="500" step="0.5" />{radiusBR.note && <span className="clamp-note" role="status">{radiusBR.note}</span>}</label><label>BL<input id="radiusBL" {...radiusBL.inputProps} type="text" inputMode="decimal" min="0" max="500"
            step="0.5" />{radiusBL.note && <span className="clamp-note" role="status">{radiusBL.note}</span>}</label></div></div></section>
 );
}
