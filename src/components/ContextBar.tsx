import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {toolActions, toolMode} from '../toolMode.js';
import {inputMode} from '../inputMode.js';
import {toolbarActions} from '../toolbarCommands.js';
import {focusStitchType} from '../focusStitchType.js';
import {shortcutFor} from '../shortcutTable.js';
import {shortcutLabel} from '../shortcutLabels.js';
import {t} from '../i18n.js';
import {zoomActions, zoomPercent} from '../zoomState.js';
import {handModeState} from '../canvasModeState.js';
import {selectionState} from '../selectionState.js';
import {multiSelectState} from '../multiSelectState.js';
import {interactionState} from '../interactionState.js';
import {togglePhoneSheet} from '../phoneSheetState.js';
import {ChromeTile} from './ChromeTile';

// The phone bars, built from one tile (ChromeTile). Three pieces, one per place on a phone:
// - ContextBar: the bar under the canvas. With nothing selected it holds the view tools (Hand, Hoop, All) and the zoom
//   stepper (− %  +). With an object selected it holds the object commands (Several, Duplicate, Delete, Properties) and
//   one % tile, whose menu carries the zoom commands the stepper would otherwise hold.
// - PhoneDock: the five drawing tools in one row at the foot of a portrait phone.
// - LandscapeRail: the same tools as a column of six tiles along the left edge of a landscape phone.
// The ids (zoomIn, zoomOut, zoomPct, handTool, zoomFit, zoomAll, barDuplicate, barDelete, barProperties, selectToggle) are
// the ones the rest of the editor and its tests address.

// A landscape phone (height 500 px or less, touch) draws the tool rail as a column along the canvas, so the Menu's Ellipse row
// (which the rail carries there) is left out. Same window as the landscape block in styles.css.
const LANDSCAPE_RAIL_QUERY = '(orientation: landscape) and (max-height: 500px) and (max-width: 1000px)';
const subscribeLandscapeRail = (listen: () => void) => {
 const media = window.matchMedia(LANDSCAPE_RAIL_QUERY);
 media.addEventListener('change', listen);
 return () => media.removeEventListener('change', listen);
};
export function useLandscapeRail(): boolean {
 return useSyncExternalStore(subscribeLandscapeRail, () => window.matchMedia(LANDSCAPE_RAIL_QUERY).matches);
}

const duplicateLabel = t('Duplicate selected object');
const deleteLabel = t('Delete selected object');
const propertiesLabel = t('Properties');
const fitHoopLabel = t('Fit hoop');
const fitAllLabel = t('Fit everything ({shortcut})', {shortcut: shortcutLabel([{shift: true, key: '1'}])});
const handLabel = t('Hand tool: drag to pan');
const zoomInLabel = t('Zoom in (+)');
const zoomOutLabel = t('Zoom out (−)');
const resetLabel = t('Zoom to 100%');

// The add buttons of the dock and the rail: each adds its shape through the same command the desktop uses. A keyboard add
// moves focus to the new object's Stitch type controls, as the desktop add does; lettering keeps focus where it is.
function addShape(kind: 'rect' | 'ellipse' | 'text', keyboard: boolean) {
 toolActions.press('select');
 toolbarActions.addShape(kind);
 if (keyboard && kind !== 'text') setTimeout(focusStitchType, 0);
}

// The zoom menu: the commands the stepper holds with nothing selected. It opens from the % tile above the bar, and closes
// on a choice, on Escape, or on a press anywhere else.
function ZoomMenu({percent, hand}: {percent: string; hand: boolean}) {
 const [open, setOpen] = useState(false);
 const wrap = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (!open) return;
  const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
  const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
  document.addEventListener('pointerdown', away);
  document.addEventListener('keydown', escape);
  return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
 }, [open]);
 const choose = (run: () => void) => () => { setOpen(false); run(); };
 return (
  <div className="zoom-menu-wrap" ref={wrap}>
   <ChromeTile id="zoomPct" name={t('Zoom')} expanded={open} onClick={() => setOpen(!open)}>{percent}</ChromeTile>
   {open ? (
    <div className="zoom-menu" role="menu" aria-label={t('Zoom')}>
     <button type="button" role="menuitem" onClick={choose(() => zoomActions.zoomIn())}>{t('Zoom in')}</button>
     <button type="button" role="menuitem" onClick={choose(() => zoomActions.zoomOut())}>{t('Zoom out')}</button>
     <button type="button" role="menuitem" onClick={choose(() => zoomActions.zoom100())}>{t('100%')}</button>
     <button type="button" role="menuitem" onClick={choose(() => zoomActions.fitHoop())}>{fitHoopLabel}</button>
     <button type="button" role="menuitem" onClick={choose(() => zoomActions.fitAll())}>{t('Fit everything')}</button>
     <button type="button" role="menuitemcheckbox" aria-checked={hand} onClick={choose(() => handModeState.set(!hand))}>{t('Hand')}</button>
    </div>
   ) : null}
  </div>
 );
}

export function ContextBar() {
 const percent = useSyncExternalStore(zoomPercent.subscribe, zoomPercent.get);
 const hand = useSyncExternalStore(handModeState.subscribe, handModeState.get);
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const several = useSyncExternalStore(multiSelectState.subscribe, multiSelectState.get);
 const hasSelection = selection.selected !== null || selection.multi.size > 0;
 return (
  <div className="context-bar" role="toolbar" aria-label={t('Canvas')}>
   <div className="context-tiles">
    {hasSelection ? (
     <>
      <ChromeTile id="selectToggle" icon="select-add" label={t('Several')} name={t('Tap objects to add them to the selection')} selected={several}
       pressed={several} onClick={() => multiSelectState.set(!several)} />
      <ChromeTile id="barDuplicate" icon="copy" label={t('Duplicate')} name={duplicateLabel} onClick={() => toolbarActions.duplicate()} />
      <ChromeTile id="barDelete" icon="delete" label={t('Delete')} name={deleteLabel} onClick={() => toolbarActions.remove()} />
      <ChromeTile id="barProperties" icon="sliders" label={propertiesLabel} name={propertiesLabel} onClick={() => togglePhoneSheet('properties')} />
     </>
    ) : (
     <>
      <ChromeTile id="handTool" icon="hand" label={t('Hand')} name={handLabel} selected={hand} pressed={hand} onClick={() => handModeState.set(!hand)} />
      <ChromeTile id="zoomFit" icon="fit" label={t('Hoop')} name={fitHoopLabel} onClick={() => zoomActions.fitHoop()} />
      <ChromeTile id="zoomAll" icon="fit-all" label={t('All')} name={fitAllLabel} onClick={() => zoomActions.fitAll()} />
     </>
    )}
   </div>
   <div className="context-zoom">
    {hasSelection ? (
     <ZoomMenu percent={percent} hand={hand} />
    ) : (
     <>
      <ChromeTile id="zoomOut" icon="minus" name={zoomOutLabel} onClick={() => zoomActions.zoomOut()} />
      <ChromeTile id="zoomPct" name={resetLabel} onClick={() => zoomActions.zoom100()}>{percent}</ChromeTile>
      <ChromeTile id="zoomIn" icon="zoom-in" name={zoomInLabel} onClick={() => zoomActions.zoomIn()} />
     </>
    )}
   </div>
  </div>
 );
}

// The tool tile's word and name. On a touch screen a path being drawn says "Done", since tapping the tile again finishes it.
function pathTile(current: string, touch: boolean) {
 const finishing = current === 'path';
 const tip = finishing ? 'Finish path (Enter · click first point to close · Esc cancels)' : t('Draw path ({shortcut})', {shortcut: shortcutFor('path')});
 if (finishing && touch) return {word: t('Done'), name: t('Finish path')};
 return {word: t('Path'), name: finishing ? t('Finish path') : tip};
}

function useTool() {
 return useSyncExternalStore(toolMode.subscribe, toolMode.get);
}

// Whether a lettering box is open over the canvas. While it is, the Text tile is the selected one, and the Select tile is not,
// so the dock never shows two tiles selected at once.
function useEditingText() {
 return useSyncExternalStore(interactionState.subscribe, interactionState.get).canvasText != null;
}

export function PhoneDock() {
 const current = useTool();
 const editingText = useEditingText();
 const selectOn = current === 'select' && !editingText;
 const touch = useSyncExternalStore(inputMode.subscribe, inputMode.get) === 'touch';
 const path = pathTile(current, touch);
 return (
  <div className="phone-dock tool-row tool-rail" role="toolbar" aria-label={t('Tools')}>
   <ChromeTile id="select" icon="select" label={t('Select')} name={t('Select ({shortcut})', {shortcut: shortcutFor('select')})}
    selected={selectOn} pressed={selectOn} onClick={() => toolActions.press('select')} />
   <ChromeTile id="rect" icon="rect" label={t('Rectangle')} name={t('Add rectangle ({shortcut})', {shortcut: shortcutFor('rect')})}
    onClick={event => addShape('rect', event.detail === 0)} />
   <ChromeTile id="path" icon="path" label={path.word} name={path.name} selected={current === 'path'} pressed={current === 'path'}
    onClick={() => toolActions.press('path')} />
   <ChromeTile id="letter" icon="text" label={t('Text')} name={t('Add lettering ({shortcut})', {shortcut: shortcutFor('letter')})}
    selected={editingText} pressed={editingText} onClick={event => addShape('text', event.detail === 0)} />
   <ChromeTile id="line" icon="line" label={t('Line')} name={t('Line ({shortcut}, drag)', {shortcut: shortcutFor('line')})}
    selected={current === 'line'} pressed={current === 'line'} onClick={() => toolActions.press('line')} />
  </div>
 );
}

export function LandscapeRail() {
 const current = useTool();
 const editingText = useEditingText();
 const selectOn = current === 'select' && !editingText;
 return (
  <div className="tool-rail landscape-rail" role="toolbar" aria-label={t('Tools')}>
   <ChromeTile id="select" icon="select" label={t('Select')} name={t('Select ({shortcut})', {shortcut: shortcutFor('select')})}
    selected={selectOn} pressed={selectOn} onClick={() => toolActions.press('select')} />
   <ChromeTile id="rect" icon="rect" label={t('Rectangle')} name={t('Add rectangle ({shortcut})', {shortcut: shortcutFor('rect')})}
    onClick={event => addShape('rect', event.detail === 0)} />
   <ChromeTile id="ellipse" icon="ellipse" label={t('Ellipse')} name={t('Add ellipse ({shortcut})', {shortcut: shortcutFor('ellipse')})}
    onClick={event => addShape('ellipse', event.detail === 0)} />
   <ChromeTile id="path" icon="path" label={t('Path')} name={t('Draw path ({shortcut})', {shortcut: shortcutFor('path')})}
    selected={current === 'path'} pressed={current === 'path'} onClick={() => toolActions.press('path')} />
   <ChromeTile id="letter" icon="text" label={t('Text')} name={t('Add lettering ({shortcut})', {shortcut: shortcutFor('letter')})}
    selected={editingText} pressed={editingText} onClick={event => addShape('text', event.detail === 0)} />
   <ChromeTile id="line" icon="line" label={t('Line')} name={t('Line ({shortcut}, drag)', {shortcut: shortcutFor('line')})}
    selected={current === 'line'} pressed={current === 'line'} onClick={() => toolActions.press('line')} />
  </div>
 );
}

