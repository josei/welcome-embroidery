// The line, measure, polygon and star tool buttons, rendered by React. The active tool comes from toolMode.
import {useSyncExternalStore} from 'react';
import {toolActions, toolMode} from '../toolMode.js';
import {gridSnapActions, gridSnapState} from '../gridSnapState.js';
import {toolbarActions} from '../toolbarCommands.js';
import {focusStitchType} from '../focusStitchType.js';
import {shortcutFor} from '../shortcutTable.js';
import {t} from '../i18n.js';

function toolClass(current: string, name: string) {
 return current === name ? 'icon-button active-tool' : 'icon-button';
}

export function ToolButtons() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 // Each tooltip reads its key from the shortcut table, the same value the shortcut sheet shows.
 const lineTip = t('Line ({shortcut}, drag)', {shortcut: shortcutFor('line')});
 const measureTip = t('Measure ({shortcut})', {shortcut: shortcutFor('measure')});
 const polygonTip = t('Polygon ({shortcut}, drag from center)', {shortcut: shortcutFor('polygon')});
 const starTip = t('Star ({shortcut}, drag from center)', {shortcut: shortcutFor('star')});
 return (
  <><button aria-pressed={current === 'line'} className={toolClass(current, 'line')} onClick={() =>
    toolActions.press(
    'line')} aria-label={lineTip} title={lineTip} data-tooltip={lineTip} id="line"><svg className="icon"><use
      href="#i-line"/></svg><span className="rail-label">{t('Line')}</span></button><button aria-pressed={current === 'measure'} className={toolClass(
    current, 'measure')} onClick={() =>
    toolActions.press(
    'measure')} id="measure" aria-label={measureTip} title={measureTip} data-tooltip={measureTip}><svg className="icon"><use
      href="#i-measure"/></svg><span className="rail-label">{t('Measure')}</span></button><button aria-pressed={current === 'polygon'} className={toolClass(
    current, 'polygon')} onClick={() =>
    toolActions.press(
    'polygon')} aria-label={polygonTip} title={polygonTip} data-tooltip={polygonTip}
      id="polygon"><svg className="icon"><use href="#i-polygon"/></svg><span className="rail-label">{t('Polygon')}</span></button><button aria-pressed={current === 'star'} className={toolClass(
    current, 'star')} onClick={() =>
    toolActions.press(
    'star')} aria-label={starTip} title={starTip} data-tooltip={starTip} id="star"><svg
      className="icon"><use href="#i-star"/></svg><span className="rail-label">{t('Star')}</span></button></>
 );
}

// The select and pen buttons, each in its place in the tool row. The active class comes from toolMode.
export function SelectTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 const tip = t('Select ({shortcut})', {shortcut: shortcutFor('select')});
 return (
  <button aria-pressed={current === 'select'} className={toolClass(current, 'select')} onClick={() =>
    toolActions.press(
    'select')} aria-label={tip} title={tip} data-tooltip={tip} id="select"><svg className="icon"><use href="#i-select"/></svg><span className="rail-label">{t('Choose')}</span></button>
 );
}

export function PenTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 const tip = t('Pen with curves ({shortcut}, drag for handles)', {shortcut: shortcutFor('pen')});
 return (
  <button aria-pressed={current === 'pen'} className={toolClass(current, 'pen')} onClick={() =>
    toolActions.press(
    'pen')} aria-label={tip} title={tip}
      data-tooltip={tip} id="pen"><svg className="icon"><use href="#i-pen"/></svg><span className="rail-label">{t('Pen')}</span></button>
 );
}

// The draw path button. Its label follows the tool: while a path is being drawn it says how to finish it.
export function PathTool() {
 const current = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 const label = current === 'path' ? 'Finish path (Enter · click first point to close · Esc cancels)'
   : t('Draw path ({shortcut})', {shortcut: shortcutFor('path')});
 return (
  <button aria-pressed={current === 'path'} className={toolClass(current, 'path')} onClick={() =>
    toolActions.press('path')} aria-label={label} title={label} data-tooltip={label} id="path"><svg className="icon"><use href="#i-path"/></svg><span className="rail-label">{t('Path')}</span></button>
 );
}

// The add rectangle, ellipse and lettering buttons. Each adds its shape through the same canvas command as before.
// Adding is a one-shot action, so it is never armed: aria-pressed is always false. It still leaves any drawing tool
// first, so the Select button is the pressed one after the object is placed. `tip` is the tooltip, which names the key.
export function AddShapeButton({kind, id, label, icon, tip, short}: {kind: 'rect' | 'ellipse' | 'text'; id: string; label: string; icon: string; tip: string; short: string}) {
 return (
  <button aria-pressed={false} className="icon-button" id={id} aria-label={label} title={tip} data-tooltip={tip} onClick={event => {
    toolActions.press('select');
    toolbarActions.addShape(kind);
    // A keyboard add (detail 0) moves focus to the new shape's Stitch type controls, so the next key works on it. Lettering
    // keeps focus in place: its own box opens from there (see the lettering test). Deferred until React draws the inspector.
    if (event.detail === 0 && kind !== 'text') setTimeout(focusStitchType, 0);
  }}>
   <svg className="icon"><use href={`#i-${icon}`}/></svg><span className="rail-label">{short}</span>
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
