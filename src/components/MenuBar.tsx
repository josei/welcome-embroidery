import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {toolActions} from '../toolMode.js';
import {toolbarActions} from '../toolbarCommands';
import {multiSelectState} from '../multiSelectState';
import {nodeActions, nodeButtonsState} from '../nodeButtonsState.js';
import {actionState} from '../actionState.js';
import {addPhoto} from '../photoCommands';
import {setTraceDialogOpen} from '../traceDialogState.js';
import {closePhoneSheet, phoneSheetState, togglePhoneSheet} from '../phoneSheetState.js';
import {flushSync} from 'react-dom';
import type {KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent} from 'react';
import {alignActions, alignState} from '../alignState.js';
import {clipboardState} from '../clipboardState.js';
import {selectionState} from '../selectionState.js';
import {selectionToolbarActions, selectionToolbarState} from '../selectionToolbarState.js';
import {moveSelection} from '../sewingOrder.js';
import {hasFilePicker, newProject, projectSave, projectSaveAs} from '../projectIO.js';
import {t} from '../i18n.js';
import {runCommand} from '../commandRegistry';
import {setPaletteOpen} from '../commandPaletteState';
import {shortcutForCommand} from '../shortcutTable.js';
import {gridActions, gridState, GRID_SPACINGS} from '../gridState.js';
import {gridSnapActions, gridSnapState} from '../gridSnapState.js';
import {gridShownState, toggleGridShown} from '../gridState.js';
import {zoomActions} from '../zoomState';
import {toastActions} from '../toastState.js';
import {snapObjActions, snapObjState} from '../snapObjState.js';
import {statusActions, statusState} from '../statusState.js';
import {openExportDialog} from '../exportCommands';
import {setSettingsOpen} from '../settingsState';
import {agentLinkState} from '../agentLinkState';
import {viewActions, viewMode} from '../viewMode.js';
import {documentState, documentNow} from '../documentState.js';
import {menuReason, NEEDS_ONE, NEEDS_TWO, NEEDS_THREE} from '../menuReasons.js';
import {useTabletPortrait} from '../tabletLayoutState.js';

// The menu bar's dropdowns. Each item runs the same command as its toolbar button, context-menu row or keyboard shortcut,
// and is disabled exactly when that command does not apply, using the same flags the toolbar uses. Nothing here is removed
// from the toolbar, inspector, context menu or shortcut sheet; the menus are one more route to the same commands.

/** One dropdown row. `key` is shown as the shortcut; `hint` is a second line of explanation (File uses it). `reason` says why
 * the row is disabled; it is visible text, so it can be read without a hover (touch has none). Shown only when disabled. */
interface Entry {
 id: string;
 label: string;
 /** The icon-sprite symbol id (without `#`) shown before the label; phone rows use it. */
 icon?: string;
 className?: string;
 key?: string;
 hint?: string;
 disabled?: boolean;
 /** For a row that switches something on or off: whether it is on now (sets aria-pressed). */
 pressed?: boolean;
 reason?: string;
 /** Short state shown on the row's line, right-aligned: On, Off, a value or Shown now. */
 state?: string;
 run: () => void;
}
/** A label that heads a group of rows. A phone group that can fold has `section`: the heading is then a button that shows or
 * hides the rows under it. */
interface Heading {
 heading: string;
 section?: {id: string; open: boolean; toggle: () => void};
}
/** A line of visible text that is not a command, such as the save status in the phone menu. */
interface Note {
 note: string;
}
type Row = Entry | Heading | Note | '-';

// A dropdown: a header button that opens a list of entries. Keyboard: Enter, Space or ArrowDown on the header opens it and
// focuses the first enabled item (ArrowUp, the last); ArrowUp and ArrowDown move between enabled items and wrap; Home and End
// go to the first and last; Enter runs an item and closes the menu; Escape closes it and returns focus to the header; Tab
// closes it and moves on; ArrowLeft and ArrowRight move to the neighbouring header, opening its menu if this one was open.
// Closes on an outside press, Escape, or after an entry runs.
// The phone Menu also closes on a downward swipe of at least TITLE_SWIPE_PX on its title row.
const TITLE_SWIPE_PX = 60;
function Dropdown({id, label, rows, iconOnly, onOpen, sharedReasons}: {id: string; label: string; rows: Row[]; iconOnly?: boolean; onOpen?: () => void; sharedReasons?: boolean}) {
 const [open, setOpen] = useState(false);
 // The row the pointer or focus is on, when it is disabled. Shared-reason menus show its reason in one line under the list.
 const [notedId, setNotedId] = useState<string | null>(null);
 const wrap = useRef<HTMLDivElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 // Where focus goes once the menu has rendered: set when a key opens it, cleared when it is used.
 const focusOnOpen = useRef<'first' | 'last' | null>(null);
 // With shared reasons a disabled row stays focusable, so keyboard users reach its reason; it just cannot be activated.
 const enabledItems = () => Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>(sharedReasons ? '[role="menuitem"]' : '[role="menuitem"]:not(:disabled)') ?? []);
 useEffect(() => {
  if (!open) return;
  const want = focusOnOpen.current;
  focusOnOpen.current = null;
  if (want) { const items = enabledItems(); (want === 'first' ? items[0] : items[items.length - 1])?.focus(); }
  const away = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
  const escape = (e: KeyboardEvent) => {
   if (e.key !== 'Escape') return;
   setOpen(false);
   trigger.current?.focus();
  };
  document.addEventListener('pointerdown', away);
  document.addEventListener('keydown', escape);
  return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
 }, [open]);
 // The phone Menu is full height with no grab handle, so a downward drag on its title row closes it.
 // A drag from the list or the search field scrolls or does nothing. The row captures the pointer so the release is seen wherever it lands.
 const titleDrag = useRef<{id: number; y: number} | null>(null);
 const titleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
  if (e.button !== 0) return;
  titleDrag.current = {id: e.pointerId, y: e.clientY};
  e.currentTarget.setPointerCapture?.(e.pointerId);
 };
 const titleUp = (e: ReactPointerEvent<HTMLDivElement>) => {
  const drag = titleDrag.current;
  titleDrag.current = null;
  if (!drag || drag.id !== e.pointerId || e.type !== 'pointerup' || e.clientY - drag.y < TITLE_SWIPE_PX) return;
  setOpen(false);
  trigger.current?.focus();
 };
 // Opening a menu closes any phone sheet (Layers or Properties), so only one of them is ever open.
 const openWith = (where: 'first' | 'last' | null) => { closePhoneSheet(); onOpen?.(); focusOnOpen.current = where; setOpen(true); };
 // Runs an item: the menu closes and focus goes back to the header, so keyboard users stay where they were.
 const choose = (row: Entry) => { setOpen(false); trigger.current?.focus(); row.run(); };
 function onKeyDown(e: ReactKeyboardEvent) {
  // Keys this menu moves focus with stop here, so the canvas shortcuts (arrows nudge, Home/End reorder) do not also act on the
  // selection. Other keys pass through, so Ctrl+Z and the rest still work with a menu open. Tab closes the menu and moves on.
  if (e.key === 'Tab') {
   if (!open) return;
   flushSync(() => setOpen(false));
   trigger.current?.focus();
   return;
  }
  if (e.key === 'Escape') {
   if (!open) return;
   e.stopPropagation();
   setOpen(false);
   trigger.current?.focus();
   return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
   const headers = Array.from(wrap.current?.parentElement?.querySelectorAll<HTMLButtonElement>(':scope > .file-menu > button[aria-haspopup]') ?? []);
   const here = headers.indexOf(trigger.current!);
   const next = headers[(here + (e.key === 'ArrowRight' ? 1 : -1) + headers.length) % headers.length];
   if (!next || next === trigger.current) return;
   e.preventDefault();
   e.stopPropagation();
   setOpen(false);
   next.focus();
   if (open) next.click(); // a click without a pointer opens that menu with its first item focused
   return;
  }
  if (!open) {
   if (e.target !== trigger.current) return;
   if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    openWith(e.key === 'ArrowDown' ? 'first' : 'last');
   }
   return;
  }
  const items = enabledItems();
  if (!items.length) return;
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  let target: number | null = null;
  if (e.key === 'ArrowDown') target = at < 0 ? 0 : (at + 1) % items.length;
  else if (e.key === 'ArrowUp') target = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
  else if (e.key === 'Home') target = 0;
  else if (e.key === 'End') target = items.length - 1;
  if (target !== null) { e.preventDefault(); e.stopPropagation(); items[target].focus(); }
 }
 // One reason line for a shared-reason menu (Edit): it is drawn on the row the pointer or focus is on, else the first disabled row.
 const disabledRows = rows.filter((r): r is Entry => typeof r === 'object' && 'id' in r && Boolean(r.disabled && r.reason));
 const reasonRowId = sharedReasons ? (disabledRows.find(r => r.id === notedId) ?? disabledRows[0])?.id : undefined;
 return (
  <div className="file-menu" ref={wrap} onKeyDown={onKeyDown}>
   <button ref={trigger} type="button" id={id} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}List` : undefined}
    className={iconOnly ? 'icon-button menu-trigger' : undefined} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}
    onClick={e => {
     // A click with no pointer (detail 0) came from the keyboard: Enter or Space opens the menu and focuses its first item.
     const keyboard = e.detail === 0;
     // Opening the phone Menu closes any Layers or Properties sheet, so the list is not under a sheet.
     if (open) setOpen(false); else { if (id === 'phoneMenu') closePhoneSheet(); openWith(keyboard ? 'first' : null); }
    }}>{iconOnly ? <svg className="icon" aria-hidden="true"><use href="#i-menu" /></svg> : label}</button>
   {open && (
    <div role="menu" id={`${id}List`} className="file-menu-list">
     {id === 'phoneMenu' && (
      <div role="presentation" className="menu-title" data-menu-title="" onPointerDown={titleDown} onPointerUp={titleUp} onPointerCancel={titleUp}>{label}</div>
     )}
     {rows.map((row, i) => {
      if (row === '-') return <hr key={`sep${i}`} className="menu-sep" />;
      if ('heading' in row && row.section) {
       // A folding group's heading is a menu item, so arrow keys reach it. Enter or a tap folds or unfolds the group and keeps the Menu open.
       return (
        <button key={`head${i}`} type="button" role="menuitem" id={row.section.id} aria-expanded={row.section.open} className="menu-heading menu-section" onClick={row.section.toggle}>
         <svg className="icon menu-icon" aria-hidden="true"><use href={row.section.open ? '#i-chevron' : '#i-chevron-right'} /></svg>
         <span>{row.heading}</span>
        </button>
       );
      }
      if ('heading' in row) return <div key={`head${i}`} role="presentation" className="menu-heading">{row.heading}</div>;
      if ('note' in row) return <div key={`note${i}`} role="status" className="menu-note">{row.note}</div>;
      const shared = Boolean(sharedReasons) && row.disabled;
      return (
       <button key={row.id} type="button" role="menuitem" id={row.id} disabled={row.disabled && !sharedReasons}
        aria-disabled={shared || undefined} title={shared ? row.reason : undefined}
        onFocus={() => { if (shared) setNotedId(row.id); }} onPointerEnter={() => { if (shared) setNotedId(row.id); }}
        className={[row.key || row.icon ? 'menu-item' : '', row.className].filter(Boolean).join(' ') || undefined} aria-pressed={row.pressed}
        onClick={() => { if (!row.disabled) choose(row); }}>
        {row.icon && <svg className="icon menu-icon" aria-hidden="true"><use href={`#${row.icon}`} /></svg>}
        <span>{row.label}</span>
        {row.key && <kbd>{row.key}</kbd>}
        {row.state && <small className="menu-state">{row.state}</small>}
        {row.hint && <small>{row.hint}</small>}
        {(sharedReasons ? row.id === reasonRowId : row.disabled && row.reason) && <small className="menu-reason">{row.reason}</small>}
       </button>
      );
     })}
    </div>
   )}
  </div>
 );
}

/** Save and Save As, the same commands as the floppy icon and Ctrl+S / Ctrl+Shift+S. Each item says which way it saves in this
 * browser: to the file the user picks, or as a download. The File menu and the phone Menu both list them. */
function saveRows(): Row[] {
 const picker = hasFilePicker();
 return [
  {id: 'menuSave', label: t('Save'), hint: picker ? t('Writes to the file you chose') : t('Downloads the project file'), run: () => void projectSave()},
  {id: 'menuSaveAs', label: t('Save As'), hint: picker ? t('Choose a new file') : t('Download under a name you type'), run: () => void projectSaveAs()},
 ];
}

/** The File menu: Save and Save As, then the command palette. Shown at desktop widths; the phone Menu lists the same rows. */
export function FileMenu() {
 const rows: Row[] = [
  ...saveRows(),
  '-',
  {id: 'menuCommandPalette', label: t('Command palette'), key: shortcutForCommand('openPalette'), run: () => setPaletteOpen(true)},
 ];
 return <Dropdown id="fileMenu" label={t('File')} rows={rows} />;
}

/** What the reason lookups need from the selection and the document. Re-renders when either changes. */
function useReasonContext() {
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 useSyncExternalStore(documentState.subscribe, documentState.get);
 const objects = (documentNow().doc.objects ?? []) as ReasonObjects;
 const picked = [...selection.multi].map(id => objects.find(o => o.id === id)).filter((o): o is ReasonObjects[number] => Boolean(o));
 const ordered = picked.slice().sort((a, b) => objects.indexOf(a) - objects.indexOf(b));
 return {count: selection.multi.size, selNode: selection.selNode, primary: objects.find(o => o.id === selection.selected), top: ordered.at(-1), picked};
}
type ReasonObjects = Array<{id?: string; kind?: string; groupId?: unknown; clipId?: unknown; mask?: unknown; along?: unknown; closed?: boolean; handles?: unknown[]}>;

/** The Edit menu's rows: history, the clipboard, duplicate, select all and delete. */
export function useEditRows(): Row[] {
 const actions = useSyncExternalStore(actionState.subscribe, actionState.get);
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const clip = useSyncExternalStore(clipboardState.subscribe, clipboardState.get);
 const noneSelected = selection.multi.size === 0;
 const rows: Row[] = [
  {id: 'menuUndo', label: t('Undo'), key: shortcutForCommand('undo'), disabled: actions.undo, reason: t('Nothing to undo'), run: () => runCommand('undo')},
  {id: 'menuRedo', label: t('Redo'), key: shortcutForCommand('redo'), disabled: actions.redo, reason: t('Nothing to redo'), run: () => runCommand('redo')},
  '-',
  {id: 'menuCut', label: t('Cut'), key: shortcutForCommand('cut'), disabled: noneSelected, reason: t(NEEDS_ONE), run: () => runCommand('cut')},
  {id: 'menuCopy', label: t('Copy'), key: shortcutForCommand('copy'), disabled: noneSelected, reason: t(NEEDS_ONE), run: () => runCommand('copy')},
  {id: 'menuPaste', label: t('Paste'), key: shortcutForCommand('paste'), disabled: !clip.clipboard, reason: t('Copy something first'), run: () => runCommand('paste')},
  '-',
  {id: 'menuDuplicate', label: t('Duplicate'), key: shortcutForCommand('duplicate'), disabled: actions.duplicate, reason: t(NEEDS_ONE), run: () => runCommand('duplicate')},
  {id: 'menuSelectAll', label: t('Select all'), key: shortcutForCommand('selectAll'), run: () => runCommand('selectAll')},
  '-',
  {id: 'menuCommandPalette', label: t('Command palette'), key: shortcutForCommand('openPalette'), run: () => setPaletteOpen(true)},
  {id: 'menuRepeat', label: t('Repeat last action'), key: shortcutForCommand('repeatLast'), run: () => runCommand('repeatLast')},
  '-',
  {id: 'menuDelete', label: t('Delete'), key: 'Del', disabled: actions.remove, reason: t(NEEDS_ONE), run: () => runCommand('delete')},
 ];
 return rows;
}

/** The Edit menu. */
export function EditMenu() {
 return <Dropdown id="editMenu" label={t('Edit')} rows={useEditRows()} sharedReasons />;
}

/** The Arrange menu's rows: align and distribute, flip, sewing order (front and back) and the boolean shape operations. */
export function useArrangeRows(): Row[] {
 const align = useSyncExternalStore(alignState.subscribe, alignState.get);
 const toolbar = useSyncExternalStore(selectionToolbarState.subscribe, selectionToolbarState.get);
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const noneSelected = selection.multi.size === 0;
 const press = (name: string) => () => alignActions.press(name);
 const flip = (name: 'flipH' | 'flipV') => () => selectionToolbarActions.press(name);
 const bool = (name: 'subtract' | 'union' | 'intersect') => () => selectionToolbarActions.press(name);
 const rows: Row[] = [
  {id: 'menuAlignLeft', label: t('Align left'), disabled: align.align, reason: t(NEEDS_ONE), run: press('left')},
  {id: 'menuAlignHCenter', label: t('Align horizontal centers'), disabled: align.align, reason: t(NEEDS_ONE), run: press('hcenter')},
  {id: 'menuAlignRight', label: t('Align right'), disabled: align.align, reason: t(NEEDS_ONE), run: press('right')},
  {id: 'menuAlignTop', label: t('Align top'), disabled: align.align, reason: t(NEEDS_ONE), run: press('top')},
  {id: 'menuAlignVCenter', label: t('Align vertical centers'), disabled: align.align, reason: t(NEEDS_ONE), run: press('vcenter')},
  {id: 'menuAlignBottom', label: t('Align bottom'), disabled: align.align, reason: t(NEEDS_ONE), run: press('bottom')},
  '-',
  {id: 'menuDistributeH', label: t('Distribute horizontally'), disabled: align.distribute, reason: t(NEEDS_THREE), run: press('horizontal')},
  {id: 'menuDistributeV', label: t('Distribute vertically'), disabled: align.distribute, reason: t(NEEDS_THREE), run: press('vertical')},
  '-',
  {id: 'menuFlipH', label: t('Flip horizontally'), disabled: toolbar.flip, reason: t(NEEDS_ONE), run: flip('flipH')},
  {id: 'menuFlipV', label: t('Flip vertically'), disabled: toolbar.flip, reason: t(NEEDS_ONE), run: flip('flipV')},
  '-',
  {id: 'menuToFront', label: t('Bring to front'), key: 'End', disabled: noneSelected, reason: t(NEEDS_ONE), run: () => moveSelection('front')},
  {id: 'menuToBack', label: t('Send to back'), key: 'Home', disabled: noneSelected, reason: t(NEEDS_ONE), run: () => moveSelection('back')},
  '-',
  {id: 'menuSubtract', label: t('Subtract'), disabled: toolbar.subtract, reason: t(NEEDS_TWO), run: bool('subtract')},
  {id: 'menuUnion', label: t('Union'), disabled: toolbar.union, reason: t(NEEDS_TWO), run: bool('union')},
  {id: 'menuIntersect', label: t('Intersect'), disabled: toolbar.intersect, reason: t(NEEDS_TWO), run: bool('intersect')},
 ];
 return rows;
}

/** The Arrange menu. */
export function ArrangeMenu() {
 return <Dropdown id="arrangeMenu" label={t('Arrange')} rows={useArrangeRows()} />;
}

/** The state word a toggle row shows, so its on or off state is visible text as well as the pressed flag. */
function onOff(on: boolean): string {
 return on ? t('On') : t('Off');
}

/** The View rows for grid and snap: Grid (dots on the canvas), the grid spacing, Snap and Snap to objects. The toggles carry
 * aria-pressed, so a screen reader hears their state. Used by the phone Menu and the compact desktop View menu. */
export function useGridSnapRows(): Row[] {
 const shown = useSyncExternalStore(gridShownState.subscribe, gridShownState.get);
 const snapOn = useSyncExternalStore(gridSnapState.subscribe, gridSnapState.get);
 const grid = useSyncExternalStore(gridState.subscribe, gridState.get);
 const snapObjects = useSyncExternalStore(snapObjState.subscribe, snapObjState.get);
 return [
  {id: 'menuGrid', label: t('Grid'), icon: 'i-grid', state: onOff(shown), pressed: shown, run: toggleGridShown},
  {id: 'menuGridSpacing', label: t('Grid spacing'), icon: 'i-grid-space', state: `${grid.value} mm`, run: () => {
    const spacings = GRID_SPACINGS;
    gridActions.choose(spacings[(spacings.indexOf(grid.value) + 1) % spacings.length]);
  }},
  {id: 'menuSnap', label: t('Snap'), icon: 'i-magnet', state: onOff(snapOn), pressed: snapOn, run: () => gridSnapActions.toggle()},
  {id: 'menuSnapObjects', label: t('Snap to objects'), icon: 'i-snap-obj', state: onOff(snapObjects), pressed: snapObjects, run: () => snapObjActions.toggle()},
 ];
}

/** The desktop-menu View menu, shown at compact widths (see useCompactLayout) where the grid chips are not on the canvas. */
export function ViewMenu() {
 return <Dropdown id="viewMenu" label={t('View')} rows={useGridSnapRows()} />;
}

/** The phone and tablet Menu: an icon button in the top bar opens a full-height sheet. It has a Command palette search field,
 * then View (Layers, Properties and the 2D, Stitches and 3D switch; a portrait tablet leaves these out, since they stay on
 * screen there), then the desktop menu groups in the desktop order (File, Edit, Arrange), then the drawing tools, nodes,
 * grid and zoom, and Settings and Help. Each group after View folds: its heading shows or hides its rows. Each row has an icon
 * and a short label. Keyboard shortcuts are not listed on phones. Every row runs the same command as its desktop counterpart.
 * On a phone the Menu is the only navigation: the canvas bar's commands and the More tools panel are listed here too. */
const VIEW_ROWS = [
 {id: 'design', label: '2D', icon: 'i-rect'},
 {id: 'stitches', label: 'Stitches', icon: 'i-run'},
 {id: 'preview', label: '3D', icon: 'i-spiral'},
] as const;

/** The Edit rows a phone lists: the desktop Edit menu's rows minus the palette (which the search field opens). */
const PHONE_EDIT_ICONS: Record<string, string> = {
 menuUndo: 'i-undo', menuRedo: 'i-redo', menuCut: 'i-cut', menuCopy: 'i-copy', menuPaste: 'i-paste', menuDuplicate: 'i-dup',
 menuSelectAll: 'i-select-all', menuRepeat: 'i-repeat', menuDelete: 'i-delete',
};

/** The icon each Arrange row shows on a phone. Front and back have their own sprites, so no two rows share one. */
const PHONE_ARRANGE_ICONS: Record<string, string> = {
 menuAlignLeft: 'i-al-left', menuAlignHCenter: 'i-al-hcenter', menuAlignRight: 'i-al-right', menuAlignTop: 'i-al-top',
 menuAlignVCenter: 'i-al-vcenter', menuAlignBottom: 'i-al-bottom', menuDistributeH: 'i-dist-h', menuDistributeV: 'i-dist-v',
 menuFlipH: 'i-flip-h', menuFlipV: 'i-flip-v', menuToFront: 'i-to-front', menuToBack: 'i-to-back',
 menuSubtract: 'i-subtract', menuUnion: 'i-union', menuIntersect: 'i-intersect',
};

/** Where Help goes. The editor has no help pages of its own, so it opens the project's README. */
const HELP_URL = 'https://github.com/josei/welcome-embroidery#readme';

export function PhoneMenu() {
 const photoInput = useRef<HTMLInputElement>(null);
 const tablet = useTabletPortrait();
 const edit = useEditRows()
  .filter((r): r is Entry => typeof r === 'object' && 'id' in r && r.id in PHONE_EDIT_ICONS)
  .map(r => ({...r, key: undefined, icon: PHONE_EDIT_ICONS[r.id]}));
 const arrange = useArrangeRows()
  .map(r => typeof r === 'object' && 'id' in r ? {...r, key: undefined, icon: PHONE_ARRANGE_ICONS[r.id]} : r);
 const view = useSyncExternalStore(viewMode.subscribe, viewMode.get);
 const gridRows = useGridSnapRows();
 const sheet = useSyncExternalStore(phoneSheetState.subscribe, phoneSheetState.get);
 const status = useSyncExternalStore(statusState.subscribe, statusState.get);
 const agent = useSyncExternalStore(agentLinkState.subscribe, agentLinkState.get);
 const actions = useSyncExternalStore(actionState.subscribe, actionState.get);
 const nodes = useSyncExternalStore(nodeButtonsState.subscribe, nodeButtonsState.get);
 const selectAdd = useSyncExternalStore(multiSelectState.subscribe, multiSelectState.get);
 const reasonCtx = useReasonContext();
 // Which groups are unfolded. Exactly one starts open each time the Menu opens: Arrange when something is selected, since its
 // rows act on the selection, otherwise File, so New, Open and Export are one tap away on a fresh profile. A tap on a heading
 // shows or hides its rows. A folded group keeps its heading.
 const defaultUnfolded = (selected: boolean): Record<string, boolean> => (selected ? {Arrange: true} : {File: true});
 const [unfolded, setUnfolded] = useState<Record<string, boolean>>(() => defaultUnfolded(reasonCtx.count > 0));
 const group = (name: string, groupRows: Row[]): Row[] => {
  const open = Boolean(unfolded[name]);
  const id = `menuSection-${name.replace(/\W+/g, '-')}`;
  return [{heading: t(name), section: {id, open, toggle: () => setUnfolded(u => ({...u, [name]: !open}))}}, ...(open ? groupRows : [])];
 };
 // The reason a disabled row gives. Every disabled row has one; the generic line is only a fallback.
 const why = (id: string) => menuReason(id, reasonCtx) ?? t(NEEDS_ONE);
 const viewRows: Row[] = VIEW_ROWS.map(v => ({
  id: `menuView-${v.id}`, label: t(v.label), icon: v.icon, state: view === v.id ? t('Shown now') : undefined, run: () => viewActions.choose(v.id),
 }));
 // A portrait tablet always shows Layers, Properties and the 2D, Stitches and 3D switch on screen, so the Menu leaves them out.
 const panelAndViewRows: Row[] = tablet ? [] : [
  {heading: t('View')},
  {id: 'menuLayers', label: t('Layers'), icon: 'i-layers', state: sheet === 'layers' ? t('Shown now') : undefined, run: () => togglePhoneSheet('layers')},
  {id: 'menuProperties', label: t('Properties'), icon: 'i-sliders', state: sheet === 'properties' ? t('Shown now') : undefined, run: () => togglePhoneSheet('properties')},
  ...viewRows,
 ];
 // The drawing tools the canvas bar and More tools panel held on a phone. They run the same commands as those controls.
 const toolRows: Entry[] = [
  {id: 'menuSelectAdd', label: t('Tap to add to selection'), icon: 'i-select-add', pressed: selectAdd, state: onOff(selectAdd), run: () => multiSelectState.set(!selectAdd)},
  {id: 'menuEllipse', label: t('Ellipse'), icon: 'i-ellipse', run: () => { toolActions.press('select'); toolbarActions.addShape('ellipse'); }},
  {id: 'menuPolygon', label: t('Polygon'), icon: 'i-polygon', run: () => toolActions.press('polygon')},
  {id: 'menuStar', label: t('Star'), icon: 'i-star', run: () => toolActions.press('star')},
  {id: 'menuPen', label: t('Pen'), icon: 'i-pen', run: () => toolActions.press('pen')},
  {id: 'menuTrace', label: t('Trace'), icon: 'i-trace', run: () => setTraceDialogOpen(true)},
  {id: 'menuPhoto', label: t('Photo stitch'), icon: 'i-photo', run: () => photoInput.current?.click()},
 ];
 // Path-node commands. Each one needs a path with a node selected, and says which of those is missing.
 const nodeRows: Entry[] = [
  {id: 'menuEditNodes', label: t('Edit nodes'), icon: 'i-node-edit', disabled: actions.editNodes, reason: why('menuEditNodes'), run: () => toolbarActions.editNodes()},
  {id: 'menuNodeAdd', label: t('Add node'), icon: 'i-node-add', disabled: nodes.add, reason: why('menuNodeAdd'), run: () => nodeActions.add()},
  {id: 'menuNodeDelete', label: t('Delete node'), icon: 'i-node-del', disabled: nodes.del, reason: why('menuNodeDelete'), run: () => nodeActions.del()},
  {id: 'menuNodeSmooth', label: t('Smooth node'), icon: 'i-node-smooth', disabled: nodes.smooth, reason: why('menuNodeSmooth'), run: () => nodeActions.smooth()},
  {id: 'menuNodeCorner', label: t('Corner node'), icon: 'i-node-corner', disabled: nodes.corner, reason: why('menuNodeCorner'), run: () => nodeActions.corner()},
 ];
 const arrangeBarRows: Entry[] = [
  {id: 'menuGroup', label: t('Group'), icon: 'i-group', disabled: actions.group, reason: why('menuGroup'), run: () => toolbarActions.group()},
  {id: 'menuUngroup', label: t('Ungroup'), icon: 'i-ungroup', disabled: actions.ungroup, reason: why('menuUngroup'), run: () => toolbarActions.ungroup()},
  {id: 'menuClip', label: t('Clip'), icon: 'i-clip', disabled: actions.clip, reason: why('menuClip'), run: () => selectionToolbarActions.clip()},
  {id: 'menuUnclip', label: t('Release clip'), icon: 'i-unclip', disabled: actions.unclip, reason: why('menuUnclip'), run: () => selectionToolbarActions.unclip()},
  {id: 'menuTextOnPath', label: t('Text on path'), icon: 'i-text-path', disabled: actions.textOnPath, reason: why('menuTextOnPath'), run: () => selectionToolbarActions.textOnPath()},
  {id: 'menuTextOffPath', label: t('Detach text'), icon: 'i-text-detach', disabled: actions.textOffPath, reason: why('menuTextOffPath'), run: () => selectionToolbarActions.textOffPath()},
 ];
 const settingsHint = agent.active ? t('Settings: agent connected') : agent.waiting ? t('Settings: waiting for agent') : undefined;
 const rows: Row[] = [
  {id: 'menuCommandPalette', label: t('Command palette'), icon: 'i-search', className: 'menu-search', run: () => setPaletteOpen(true)},
  ...panelAndViewRows,
  ...group('File', [
   // The file inputs are hidden in the header; a click on them opens the same pickers as the Open and Import buttons did.
   {id: 'menuNew', label: t('New'), icon: 'i-new', run: () => newProject()},
   {id: 'menuOpen', label: t('Open'), icon: 'i-open', run: () => document.getElementById('file')?.click()},
   {id: 'menuImport', label: t('Import'), icon: 'i-import', run: () => document.getElementById('machineFile')?.click()},
   ...saveRows().filter((r): r is Entry => typeof r === 'object' && 'id' in r)
    .map(r => ({...r, label: r.id === 'menuSave' ? t('Save') : t('Save As'), icon: r.id === 'menuSave' ? 'i-save' : 'i-save-as', hint: undefined})),
   {id: 'menuExport', label: t('Export'), icon: 'i-export', run: () => openExportDialog()},
  ]),
  ...group('Edit', edit),
  ...group('Tools', toolRows),
  ...group('Nodes', nodeRows),
  ...group('Arrange', [...arrange, ...arrangeBarRows]),
  ...group('Grid and zoom', [
   ...gridRows,
   {id: 'menuFitHoop', label: t('Fit hoop'), icon: 'i-fit', run: () => zoomActions.fitHoop()},
  ]),
  ...group('Settings and Help', [
   {id: 'menuSettings', label: t('Settings'), icon: 'i-gear', hint: settingsHint, run: () => setSettingsOpen(true)},
   {id: 'menuMessages', label: t('Messages'), icon: 'i-msg', run: () => toastActions.setLogOpen(true)},
   ...(status.issuesHidden ? [] : [{id: 'menuIssues', label: status.issuesText, icon: 'i-issues', run: () => statusActions.issues()}]),
   {id: 'menuHelp', label: t('Help'), icon: 'i-help', run: () => window.open(HELP_URL, '_blank', 'noopener')},
  ]),
 ];
 return (
  <>
   <Dropdown id="phoneMenu" label={t('Menu')} iconOnly rows={rows} onOpen={() => setUnfolded(defaultUnfolded(reasonCtx.count > 0))} />
   <input ref={photoInput} type="file" accept="image/*" hidden id="menuPhotoFile" onChange={event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void addPhoto(file);
   }} />
  </>
 );
}
