import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {GRID_SPACINGS, gridActions, gridState} from '../gridState.js';
// The grid spacing for snapping, as a chip the width of the toolbar buttons. The chip draws a small grid whose cells are the
// chosen spacing (finer for smaller spacings), shows the value under it, and cycles to the next spacing when clicked.
// The select keeps the value for the keyboard, the form and the tests, so it stays with the same id.
export function GridControl() {
 const {value} = useSyncExternalStore(gridState.subscribe, gridState.get);
 const index = Math.max(0, GRID_SPACINGS.indexOf(value));
 const next = GRID_SPACINGS[(index + 1) % GRID_SPACINGS.length];
 // The cell is 3 px at 0.1 mm, and grows by about 2.4 px for each doubling of the spacing.
 const cell = Math.round(3 + 2.4 * Math.log2(Number(value) / 0.1));
 const title = t('Grid spacing: {n} mm. Click to change.', {n: value});
 return (
  <>
   <select id="grid" className="sr-only" tabIndex={-1} value={value} onChange={e => gridActions.choose(e.target.value)}>
    {GRID_SPACINGS.map(v => <option key={v} value={v}>{t('Grid {n} mm', {n: v})}</option>)}
   </select>
   <button
    type="button"
    id="gridCycle"
    className="grid-chip"
    title={title}
    aria-label={title}
    data-tooltip={title}
    data-next={next}
    onClick={() => gridActions.choose(next)}
   >
    <span className="grid-tile" style={{'--cell': `${cell}px`} as React.CSSProperties} aria-hidden="true" />
    <span className="grid-label">{value}</span>
   </button>
  </>
 );
}
