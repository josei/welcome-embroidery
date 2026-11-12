import {useSyncExternalStore} from 'react';
import {hoopActions, hoopState} from '../hoopState.js';
import {useDecimalNumber} from './useDecimalInput';
import {HOOP_SIDE_RANGE} from '../fieldRanges.js';
// The stacked layout, where Layers and Properties panels stack: the same condition styles.css uses for them.
const STACKED_LAYOUT_QUERY = '(max-width: 900px), (max-height: 500px) and (pointer: coarse)';
function subscribeStacked(onChange: () => void) {
 const query = window.matchMedia(STACKED_LAYOUT_QUERY);
 query.addEventListener('change', onChange);
 return () => query.removeEventListener('change', onChange);
}
/** Whether the hoop row belongs in Properties (stacked phone and tablet layouts) rather than under the Layers list (desktop). */
export function useHoopInProperties(): boolean {
 return useSyncExternalStore(subscribeStacked, () => window.matchMedia(STACKED_LAYOUT_QUERY).matches);
}

// The hoop row under the objects list on desktop, or at the top of Properties on phones and tablets, rendered by React. Ids and labels match the markup it replaced, because app.js wires them by id.
export function HoopFields() {
 const hoop = useSyncExternalStore(hoopState.subscribe, hoopState.get);
 const width = useDecimalNumber(hoop.hoopW, text => hoopActions.commit('hoopW', text), HOOP_SIDE_RANGE);
 const height = useDecimalNumber(hoop.hoopH, text => hoopActions.commit('hoopH', text), HOOP_SIDE_RANGE);
 return (
  // Each dimension keeps its label, input and unit together (.hoop-dim); the two dimensions wrap as one .hoop-dims group, so the
  // Rotate button drops to its own line before any unit or label is split from its input.
  <div className="footer hoop-edit"><span>Hoop</span><select id="hoopPreset" aria-label="Hoop preset"
    title="Hoop presets: 110 × 110 mm, and Brother 4×4, 5×7 and 6×10 embroidery hoops" value={hoop.preset} onChange={e =>
    hoopActions.preset(
    e.target.value)}><option value="custom">Custom</option><option value="110x110">110 × 110 mm</option><option value="4x4in">4×4 in</option><option
      value="5x7in">5×7 in</option><option value="6x10in">6×10 in</option></select>
    <div className="hoop-dims"><span className="hoop-dim"><span aria-hidden="true">W</span><input id="hoopW" type="text" inputMode="decimal" min="10" max="400" step="1"
        aria-label="Hoop width (mm)" {...width.inputProps} />{width.note && <span className="clamp-note" role="status">{width.note}</span>}<span>mm</span></span><span className="hoop-dim"><span aria-hidden="true">H</span><input id="hoopH" type="text" inputMode="decimal" min="10" max="400" step="1"
          aria-label="Hoop height (mm)" {...height.inputProps} />{height.note && <span className="clamp-note" role="status">{height.note}</span>}<span>mm</span></span></div><button id="hoopRotate" type="button"
            title="Swap the hoop's width and height; the design stays where it is" onClick={(
    ) => hoopActions.rotate()}>Rotate hoop</button></div>
 );
}
