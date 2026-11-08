// The line, measure, polygon and star tool buttons, rendered by React. The active tool comes from toolMode.
import {useSyncExternalStore} from 'react';
import {toolActions, toolMode} from '../toolMode.js';
import {gridSnapActions, gridSnapState} from '../gridSnapState.js';
import {toolbarActions} from '../toolbarCommands.js';

function toolClass(current: string, name: string) {
 return current === name ? 'icon-button active-tool' : 'icon-button';
}

export function ToolButtons() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 return (
  <><button aria-pressed={current === 'line'} className={toolClass(current, 'line')} onClick={() =>
    toolActions.press(
    'line')} aria-label="Line (L, drag)" title="Line (L, drag)" data-tooltip="Line (L, drag)" id="line"><svg className="icon"><use
      href="#i-line"/></svg></button><button aria-pressed={current === 'measure'} className={toolClass(
    current, 'measure')} onClick={() =>
    toolActions.press(
    'measure')} id="measure" aria-label="Measure (M)" title="Measure (M)" data-tooltip="Measure (M)"><svg className="icon"><use
      href="#i-measure"/></svg></button><button aria-pressed={current === 'polygon'} className={toolClass(
    current, 'polygon')} onClick={() =>
    toolActions.press(
    'polygon')} aria-label="Polygon (G, drag from center)" title="Polygon (G, drag from center)" data-tooltip="Polygon (G, drag from center)"
      id="polygon"><svg className="icon"><use href="#i-polygon"/></svg></button><button aria-pressed={current === 'star'} className={toolClass(
    current, 'star')} onClick={() =>
    toolActions.press(
    'star')} aria-label="Star (S, drag from center)" title="Star (S, drag from center)" data-tooltip="Star (S, drag from center)" id="star"><svg
      className="icon"><use href="#i-star"/></svg></button></>
 );
}

// The select and pen buttons, each in its place in the tool row. The active class comes from toolMode.
export function SelectTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 return (
  <button aria-pressed={current === 'select'} className={toolClass(current, 'select')} onClick={() =>
    toolActions.press(
    'select')} aria-label="Select (V)" title="Select (V)" data-tooltip="Select (V)" id="select"><svg className="icon"><use href="#i-select"/></svg></button>
 );
}

export function PenTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 return (
  <button aria-pressed={current === 'pen'} className={toolClass(current, 'pen')} onClick={() =>
    toolActions.press(
    'pen')} aria-label="Pen with curves (P, drag for handles)" title="Pen with curves (P, drag for handles)"
      data-tooltip="Pen with curves (P, drag for handles)" id="pen"><svg className="icon"><use href="#i-pen"/></svg></button>
 );
}

// The draw path button. Its label follows the tool: while a path is being drawn it says how to finish it.
export function PathTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 const label = current === 'path' ? 'Finish path (Enter · click first point to close · Esc cancels)' : 'Draw path (N)';
 return (
  <button aria-pressed={current === 'path'} className={toolClass(current, 'path')} onClick={() =>
    toolActions.press('path')} aria-label={label} title={label} data-tooltip={label} id="path"><svg className="icon"><use href="#i-path"/></svg></button>
 );
}

// The add rectangle, ellipse and lettering buttons. Each adds its shape through the same canvas command as before.
// Adding is a one-shot action, not a tool, so the button has no pressed state. It still leaves any drawing tool first,
// so the Select button is the pressed one after the object is placed.
export function AddShapeButton({kind, id, label, icon}: {kind: 'rect' | 'ellipse' | 'text'; id: string; label: string; icon: string}) {
 return (
  <button className="icon-button" id={id} aria-label={label} title={label} data-tooltip={label} onClick={() => {
    toolActions.press('select');
    toolbarActions.addShape(kind);
  }}>
   <svg className="icon"><use href={`#i-${icon}`}/></svg>
  </button>
 );
}

// The snap-to-the-grid toggle. Its active state comes from gridSnapState; its click flips the setting and says what changed.
export function GridSnapButton() {
 const on = useSyncExternalStore(gridSnapState.subscribe, gridSnapState.get);
 return (
  <button className={on ?
    'icon-button active-tool' : 'icon-button'} aria-label="Snap to grid" title="Snap to grid" data-tooltip="Snap to grid" id="snap" onClick={() =>
    gridSnapActions.toggle()}>
   <svg className="icon"><use href="#i-snap"/></svg>
  </button>
 );
}
