import {useSyncExternalStore} from 'react';
import {zoomActions, zoomPercent} from '../zoomState.js';
import {handModeState} from '../canvasModeState.js';

// The zoom bar on the canvas: the percentage and the zoom in, out, 100%, hoop, everything and hand buttons.
// The percentage comes from zoomPercent; the buttons call the canvas zoom commands through zoomActions. The hand
// button's pressed state comes from handModeState, which the canvas also reads to pan on drag.
export function ZoomBar() {
 const percent = useSyncExternalStore(zoomPercent.subscribe, zoomPercent.get);
 const hand = useSyncExternalStore(handModeState.subscribe, handModeState.get);
 return (
  <div className="zoombar" role="toolbar" aria-label="Zoom">
   <button type="button" id="zoomOut" className="icon-button" aria-label="Zoom out (−)" title="Zoom out (−)" onClick={() => zoomActions.zoomOut()}>
    <svg className="icon"><use href="#i-minus"/></svg>
   </button>
   <button type="button" id="zoomPct" className="zoom-pct" title="Reset to 100% (Shift+0)" onClick={() => zoomActions.zoom100()}>
    {percent}
   </button>
   <button type="button" id="zoomIn" className="icon-button" aria-label="Zoom in (+)" title="Zoom in (+)" onClick={() => zoomActions.zoomIn()}>
    <svg className="icon"><use href="#i-new"/></svg>
   </button>
   <button
    type="button"
    id="handTool"
    className={hand ? 'icon-button active-tool' : 'icon-button'}
    aria-label="Hand tool: drag to pan"
    title="Hand tool: drag to pan"
    aria-pressed={hand}
    onClick={() => handModeState.set(!hand)}
   >
    <svg className="icon"><use href="#i-hand"/></svg>
   </button>
   <span className="sep"></span>
   <button type="button" id="zoomFit" className="zoom-text" title="Fit the hoop in view" onClick={() => zoomActions.fitHoop()}>
    Hoop
   </button>
   <button type="button" id="zoomAll" className="zoom-text" title="Fit everything (Shift+1)" onClick={() => zoomActions.fitAll()}>
    All
   </button>
  </div>
 );
}
