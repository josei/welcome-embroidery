import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
import {pinActions, pinClearActions, pinClearState, pinState} from '../pinState.js';
import {pathRowsActions, pathRowsState} from '../pathRowsState.js';
import {photoRowsActions, photoRowsState} from '../photoRowsState.js';
import {useDraftInput} from './useDraftInput';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
function pinClass(pin: string | null, key: string) {
 return pin === key ? 'armed' : undefined;
}

export function StitchPathRows() {
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const pin = useSyncExternalStore(pinState.subscribe, pinState.get);
 const canClear = useSyncExternalStore(pinClearState.subscribe, pinClearState.get);
 const path = useSyncExternalStore(pathRowsState.subscribe, pathRowsState.get);
 const photo = useSyncExternalStore(photoRowsState.subscribe, photoRowsState.get);
 const photoSpacing = useDraftInput(photo.spacing, text => photoRowsActions.commit('spacing', text));
 const photoContrast = useDraftInput(photo.contrast, text => photoRowsActions.commit('contrast', text));
 return (
  <><div id="pathProps" hidden={rows.pathProps}><label>Closed shape <input id="pathClosed" type="checkbox" className="icon-check" data-icon="closed" checked={path.closed} disabled={path.disabled} onChange={e => pathRowsActions.choose('closed', e.target.checked)} title="Closed shape: joins the last point to the first, so the path can be filled" /></label><label>Smooth curve <input id="pathSmooth" type="checkbox" className="icon-check" data-icon="smooth" checked={path.smooth} disabled={path.disabled} onChange={e => pathRowsActions.choose('smooth', e.target.checked)} title="Smooth curve: rounds the corners of the path" /></label><button id="continueDig" type="button" title="Continue digitizing this path">Continue digitizing</button></div><div id="maskRow" className="btn-row" hidden={rows.maskRow}><button type="button" id="selectMask" title="Select the shape that clips this object so it can be moved or edited">Select mask</button></div><div id="photoBox" hidden={rows.photoBox}><label>Photo row spacing (mm)<input id="photoSpacing" {...photoSpacing} type="number" min="0.3" max="2" step="0.1" /></label><label>Photo contrast<input id="photoContrast" {...photoContrast} type="number" min="0.4" max="3" step="0.1" /></label><label>Invert picture <input id="photoInvert" type="checkbox" checked={photo.invert} onChange={e => photoRowsActions.choose('invert', e.target.checked)} /></label><label>Second thread (light tones)<select id="photoThread2"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label><label id="photoThread3Row" hidden={rows.photoThread3Row}>Third thread (mid-tones)<select id="photoThread3"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label><label id="photoThread4Row" hidden={rows.photoThread4Row}>Fourth thread (mid-dark)<select id="photoThread4"><option value="">None</option><option value="#527461">Forest</option><option value="#d9897e">Coral</option><option value="#d3ad61">Honey</option><option value="#89a377">Sage</option></select></label></div><div id="pinRow" className="btn-row" hidden={rows.pinRow}><button type="button" id="pinStart" className={pinClass(pin, 'startAt')} onClick={() => pinActions.press('startAt')} title="Click the canvas to choose where this object starts sewing">Start point</button><button type="button" id="pinEnd" className={pinClass(pin, 'endAt')} onClick={() => pinActions.press('endAt')} title="Click the canvas to choose where this object finishes sewing">End point</button><button type="button" id="pinCenter" className={pinClass(pin, 'rippleCenter')} onClick={() => pinActions.press('rippleCenter')} title="Click the canvas to choose the point the ripple shrinks towards" hidden={rows.pinCenter}>Ripple centre</button><button type="button" id="pinClear" disabled={!canClear} onClick={() => pinClearActions.clear()} title="Remove the start and end points">Clear</button></div><label id="fillReset" hidden={rows.fillReset}>This object overrides row spacing/angle <button id="fillResetBtn" type="button">Use defaults</button></label></>
 );
}
