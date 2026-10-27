// The line, measure, polygon and star tool buttons, rendered by React. The active tool comes from toolMode.
import {useSyncExternalStore} from 'react';
import {toolActions, toolMode} from '../toolMode.js';

function toolClass(current: string, name: string) {
 return current === name ? 'icon-button active-tool' : 'icon-button';
}

export function ToolButtons() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 return (
  <><button className={toolClass(current, 'line')} onClick={() => toolActions.press('line')} aria-label="Line (L, drag)" title="Line (L, drag)" data-tooltip="Line (L, drag)" id="line"><svg className="icon"><use href="#i-line"/></svg></button><button className={toolClass(current, 'measure')} onClick={() => toolActions.press('measure')} id="measure" aria-label="Measure (M)" title="Measure (M)" data-tooltip="Measure (M)"><svg className="icon"><use href="#i-measure"/></svg></button><button className={toolClass(current, 'polygon')} onClick={() => toolActions.press('polygon')} aria-label="Polygon (G, drag from center)" title="Polygon (G, drag from center)" data-tooltip="Polygon (G, drag from center)" id="polygon"><svg className="icon"><use href="#i-polygon"/></svg></button><button className={toolClass(current, 'star')} onClick={() => toolActions.press('star')} aria-label="Star (S, drag from center)" title="Star (S, drag from center)" data-tooltip="Star (S, drag from center)" id="star"><svg className="icon"><use href="#i-star"/></svg></button></>
 );
}

// The select and pen buttons, each in its place in the tool row. The active class comes from toolMode.
export function SelectTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 return (
  <button className={toolClass(current, 'select')} onClick={() => toolActions.press('select')} aria-label="Select (V)" title="Select (V)" data-tooltip="Select (V)" id="select"><svg className="icon"><use href="#i-select"/></svg></button>
 );
}

export function PenTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 return (
  <button className={toolClass(current, 'pen')} onClick={() => toolActions.press('pen')} aria-label="Pen with curves (P, drag for handles)" title="Pen with curves (P, drag for handles)" data-tooltip="Pen with curves (P, drag for handles)" id="pen"><svg className="icon"><use href="#i-pen"/></svg></button>
 );
}
