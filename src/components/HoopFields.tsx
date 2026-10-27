import {useSyncExternalStore} from 'react';
import {hoopActions, hoopState} from '../hoopState.js';
import {useDraftInput} from './useDraftInput';
// The hoop row under the objects list, rendered by React. Ids and labels match the markup it replaced, because app.js wires them by id.
export function HoopFields() {
 const hoop = useSyncExternalStore(hoopState.subscribe, hoopState.get);
 const width = useDraftInput(hoop.hoopW, text => hoopActions.commit('hoopW', text));
 const height = useDraftInput(hoop.hoopH, text => hoopActions.commit('hoopH', text));
 return (
  <div className="footer hoop-edit"><span>Hoop</span><select id="hoopPreset" aria-label="Hoop preset" title="Hoop presets: the default, and Brother 4×4, 5×7 and 6×10 embroidery hoops" value={hoop.preset} onChange={e => hoopActions.preset(e.target.value)}><option value="custom">Custom</option><option value="110x110">Default</option><option value="100x100">4×4 in</option><option value="180x130">5×7 in</option><option value="260x160">6×10 in</option></select><input id="hoopW" type="number" min="10" max="400" step="1" aria-label="Hoop width (mm)" {...width} /><span>×</span><input id="hoopH" type="number" min="10" max="400" step="1" aria-label="Hoop height (mm)" {...height} /><span>mm</span><button id="hoopRotate" type="button" title="Swap the hoop's width and height; the design stays where it is" onClick={() => hoopActions.rotate()}>Rotate hoop</button></div>
 );
}
