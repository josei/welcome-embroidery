import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import type {KeyboardEvent as ReactKeyboardEvent} from 'react';
import {actionState} from '../actionState.js';
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
import {setShortcutsOpen} from '../shortcutsState';
import {setSettingsOpen} from '../settingsState';
import {agentLinkState} from '../agentLinkState';
import {documentState} from '../documentState.js';
import {saveState} from '../saveState.js';
import {saveStatusWords} from '../saveMark.js';
import {viewActions, viewMode} from '../viewMode.js';

// The menu bar's dropdowns. Each item runs the same command as its toolbar button, context-menu row or keyboard shortcut,
// and is disabled exactly when that command does not apply, using the same flags the toolbar uses. Nothing here is removed
// from the toolbar, inspector, context menu or shortcut sheet; the menus are one more route to the same commands.

/** One dropdown row. `key` is shown as the shortcut; `hint` is a second line of explanation (File uses it). `reason` says why
 * the row is disabled; it is visible text, so it can be read without a hover (touch has none). Shown only when disabled. */
interface Entry {
 id: string;
 label: string;
 key?: string;
 hint?: string;
 disabled?: boolean;
 reason?: string;
 run: () => void;
}
/** A non-clickable label that heads a group of rows (the phone menu groups its sections this way). */
interface Heading {
 heading: string;
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
function Dropdown({id, label, rows}: {id: string; label: string; rows: Row[]}) {
 const [open, setOpen] = useState(false);
 const wrap = useRef<HTMLDivElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 // Where focus goes once the menu has rendered: set when a key opens it, cleared when it is used.
 const focusOnOpen = useRef<'first' | 'last' | null>(null);
 const enabledItems = () => Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
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
 const openWith = (where: 'first' | 'last' | null) => { focusOnOpen.current = where; setOpen(true); };
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
 return (
  <div className="file-menu" ref={wrap} onKeyDown={onKeyDown}>
   <button ref={trigger} type="button" id={id} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}List` : undefined}
    onClick={e => {
     // A click with no pointer (detail 0) came from the keyboard: Enter or Space opens the menu and focuses its first item.
     const keyboard = e.detail === 0;
     if (open) setOpen(false); else openWith(keyboard ? 'first' : null);
    }}>{label}</button>
   {open && (
    <div role="menu" id={`${id}List`} className="file-menu-list">
     {rows.map((row, i) => {
      if (row === '-') return <hr key={`sep${i}`} className="menu-sep" />;
      if ('heading' in row) return <div key={`head${i}`} role="presentation" className="menu-heading">{row.heading}</div>;
      if ('note' in row) return <div key={`note${i}`} role="status" className="menu-note">{row.note}</div>;
      return (
       <button key={row.id} type="button" role="menuitem" id={row.id} disabled={row.disabled}
        className={row.key ? 'menu-item' : undefined} onClick={() => choose(row)}>
        <span>{row.label}</span>
        {row.key && <kbd>{row.key}</kbd>}
        {row.hint && <small>{row.hint}</small>}
        {row.disabled && row.reason && <small className="menu-reason">{row.reason}</small>}
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

// Reasons for disabled rows. The selection-count ones match the thresholds toolbarSync uses for the toolbar buttons.
const NEEDS_ONE = 'Select an object first';
const NEEDS_TWO = 'Select two or more objects';
const NEEDS_THREE = 'Select three or more objects';

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
 return <Dropdown id="editMenu" label={t('Edit')} rows={useEditRows()} />;
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

/** At phone widths the top bar keeps only Menu, the name, undo, redo and Export, so every other command is listed here: New
 * design, the File commands (save, open, import, the save status), Edit, Arrange, the shortcut sheet and Settings. Each row runs
 * the same command as its top-bar button had, which is hidden at these widths (styles.css). */
const VIEW_ROWS = [
 {id: 'design', label: '2D'},
 {id: 'stitches', label: 'Stitches'},
 {id: 'preview', label: '3D'},
] as const;

export function PhoneMenu() {
 const edit = useEditRows();
 const arrange = useArrangeRows();
 const view = useSyncExternalStore(viewMode.subscribe, viewMode.get);
 const viewRows: Row[] = VIEW_ROWS.map(v => ({
  id: `menuView-${v.id}`, label: t(v.label), hint: view === v.id ? t('Shown now') : undefined, run: () => viewActions.choose(v.id),
 }));
 const {dirty} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const {savedAt, savedFileName} = useSyncExternalStore(saveState.subscribe, saveState.get);
 const agent = useSyncExternalStore(agentLinkState.subscribe, agentLinkState.get);
 // The save status is a line of text, not a command: it shows here because the bar has no room for it at phone widths.
 const settingsHint = agent.active ? t('Settings: agent connected') : agent.waiting ? t('Settings: waiting for agent') : undefined;
 // New design leads the list: the top bar hides its New button at phone widths, and it runs the same newProject as that button.
 const rows: Row[] = [
  {id: 'menuNew', label: t('New design'), key: shortcutForCommand('new'), run: () => newProject()},
  '-',
  {heading: t('File')},
  ...saveRows(),
  // The file inputs are hidden in the header; a click on them opens the same pickers as the Open and Import buttons did.
  {id: 'menuOpen', label: t('Open project or SVG'), run: () => document.getElementById('file')?.click()},
  {id: 'menuImport', label: t('Import JEF / VP3…'), run: () => document.getElementById('machineFile')?.click()},
  {note: saveStatusWords(dirty, savedAt, savedFileName, t)},
  '-',
  {heading: t('Edit')}, ...edit, '-', {heading: t('Arrange')}, ...arrange, '-',
  // Issue #457: at phone widths the 2D, Stitches and 3D tabs leave the canvas, so the View section here is their one home.
  {heading: t('View')}, ...viewRows, '-',
  {id: 'menuShortcuts', label: t('Keyboard shortcuts'), run: () => setShortcutsOpen(true)},
  {id: 'menuSettings', label: t('Settings'), hint: settingsHint, run: () => setSettingsOpen(true)},
 ];
 return <Dropdown id="phoneMenu" label={t('Menu')} rows={rows} />;
}
