import {stitchRowsState} from '../stitchRowsState.js';
import {useSyncExternalStore} from 'react';
// Part of the stitch panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function StitchAccordionRows() {
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 return (
  <><label id="accordionStartRow" hidden={rows.accordionStartRow}>Accordion start (mm)<input id="accordionStart" type="number" min="0.25" max="1.2" step="0.05" placeholder="off" title="Row spacing at the top of the fill, changing linearly to the end spacing. Set both or neither." /></label><label id="accordionEndRow" hidden={rows.accordionEndRow}>Accordion end (mm)<input id="accordionEnd" type="number" min="0.25" max="1.2" step="0.05" placeholder="off" title="Row spacing at the bottom of the fill (rows pattern only)." /></label><label id="accordionEaseRow" hidden={rows.accordionEaseRow}>Accordion curve<select id="accordionEase" title="Linear changes the row spacing evenly; ease in and out is slowest at both ends; ease in is slowest at the top, ease out at the bottom"><option value="linear">Linear</option><option value="ease">Ease in and out</option><option value="easeIn">Ease in</option><option value="easeOut">Ease out</option></select></label><div id="guideRow" className="btn-row" hidden={rows.guideRow}><button type="button" id="guideDraw" title="Click points on the canvas for the line the rows follow, then press this button again">Draw guide</button><button type="button" id="guideClear" title="Remove the guide line">Clear guide</button></div><label id="crossRow" hidden={rows.crossRow}>Cross size (mm)<input id="crossSize" type="number" min="1" max="8" step="0.5" defaultValue="2.5" /></label></>
 );
}
