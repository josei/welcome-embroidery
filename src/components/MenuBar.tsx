import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import type {KeyboardEvent as ReactKeyboardEvent} from 'react';
import {actionState} from '../actionState.js';
import {alignActions, alignState} from '../alignState.js';
import {clipboardState} from '../clipboardState.js';
import {selectionState} from '../selectionState.js';
import {selectionToolbarActions, selectionToolbarState} from '../selectionToolbarState.js';
import {copySelection, pasteClipboard, removeSelected} from '../selectionCommands.js';
import {moveSelection} from '../sewingOrder.js';
import {toolbarActions} from '../toolbarCommands.js';
import {hasFilePicker, projectSave, projectSaveAs} from '../projectIO.js';
import {t} from '../i18n.js';
import {shortcutLabel} from '../shortcutLabels.js';

// The menu bar's dropdowns. Each item runs the same command as its toolbar button, context-menu row or keyboard shortcut,
// and is disabled exactly when that command does not apply, using the same flags the toolbar uses. Nothing here is removed
// from the toolbar, inspector, context menu or shortcut sheet; the menus are one more route to the same commands.

/** One dropdown row. `key` is shown as the shortcut; `hint` is a second line of explanation (File uses it). */
interface Entry {
 id: string;
 label: string;
 key?: string;
 hint?: string;
 disabled?: boolean;
 run: () => void;
}
type Row = Entry | '-';

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
     {rows.map((row, i) => row === '-' ? <hr key={`sep${i}`} className="menu-sep" /> : (
      <button key={row.id} type="button" role="menuitem" id={row.id} disabled={row.disabled}
        className={row.key ? 'menu-item' : undefined} onClick={() => choose(row)}>
       <span>{row.label}</span>
       {row.key && <kbd>{row.key}</kbd>}
       {row.hint && <small>{row.hint}</small>}
      </button>
     ))}
    </div>
   )}
  </div>
 );
}

/** The File menu: Save and Save As, the same commands as the floppy icon and Ctrl+S / Ctrl+Shift+S. Each item says which
 * way it saves in this browser: to the file the user picks, or as a download. */
export function FileMenu() {
 const picker = hasFilePicker();
 const rows: Row[] = [
  {id: 'menuSave', label: t('Save'), hint: picker ? t('Writes to the file you chose') : t('Downloads the project file'), run: () => void projectSave()},
  {id: 'menuSaveAs', label: t('Save As'), hint: picker ? t('Choose a new file') : t('Download under a name you type'), run: () => void projectSaveAs()},
 ];
 return <Dropdown id="fileMenu" label={t('File')} rows={rows} />;
}

/** The Edit menu: history, the clipboard, duplicate and delete. */
export function EditMenu() {
 const actions = useSyncExternalStore(actionState.subscribe, actionState.get);
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const clip = useSyncExternalStore(clipboardState.subscribe, clipboardState.get);
 const noneSelected = selection.multi.size === 0;
 const rows: Row[] = [
  {id: 'menuUndo', label: t('Undo'), key: shortcutLabel([{mod: true, key: 'Z'}]), disabled: actions.undo, run: toolbarActions.undo},
  {id: 'menuRedo', label: t('Redo'), key: shortcutLabel([{mod: true, key: 'Y'}]), disabled: actions.redo, run: toolbarActions.redo},
  '-',
  {id: 'menuCut', label: t('Cut'), key: shortcutLabel([{mod: true, key: 'X'}]), disabled: noneSelected, run: () => { if (copySelection()) removeSelected(); }},
  {id: 'menuCopy', label: t('Copy'), key: shortcutLabel([{mod: true, key: 'C'}]), disabled: noneSelected, run: () => void copySelection()},
  {id: 'menuPaste', label: t('Paste'), key: shortcutLabel([{mod: true, key: 'V'}]), disabled: !clip.clipboard, run: pasteClipboard},
  '-',
  {id: 'menuDuplicate', label: t('Duplicate'), key: shortcutLabel([{mod: true, key: 'D'}]), disabled: actions.duplicate, run: toolbarActions.duplicate},
  {id: 'menuDelete', label: t('Delete'), key: 'Del', disabled: actions.remove, run: toolbarActions.remove},
 ];
 return <Dropdown id="editMenu" label={t('Edit')} rows={rows} />;
}

/** The Arrange menu: align and distribute, flip, sewing order (front and back) and the boolean shape operations. */
export function ArrangeMenu() {
 const align = useSyncExternalStore(alignState.subscribe, alignState.get);
 const toolbar = useSyncExternalStore(selectionToolbarState.subscribe, selectionToolbarState.get);
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const noneSelected = selection.multi.size === 0;
 const press = (name: string) => () => alignActions.press(name);
 const flip = (name: 'flipH' | 'flipV') => () => selectionToolbarActions.press(name);
 const bool = (name: 'subtract' | 'union' | 'intersect') => () => selectionToolbarActions.press(name);
 const rows: Row[] = [
  {id: 'menuAlignLeft', label: t('Align left'), disabled: align.align, run: press('left')},
  {id: 'menuAlignHCenter', label: t('Align horizontal centers'), disabled: align.align, run: press('hcenter')},
  {id: 'menuAlignRight', label: t('Align right'), disabled: align.align, run: press('right')},
  {id: 'menuAlignTop', label: t('Align top'), disabled: align.align, run: press('top')},
  {id: 'menuAlignVCenter', label: t('Align vertical centers'), disabled: align.align, run: press('vcenter')},
  {id: 'menuAlignBottom', label: t('Align bottom'), disabled: align.align, run: press('bottom')},
  '-',
  {id: 'menuDistributeH', label: t('Distribute horizontally'), disabled: align.distribute, run: press('horizontal')},
  {id: 'menuDistributeV', label: t('Distribute vertically'), disabled: align.distribute, run: press('vertical')},
  '-',
  {id: 'menuFlipH', label: t('Flip horizontally'), disabled: toolbar.flip, run: flip('flipH')},
  {id: 'menuFlipV', label: t('Flip vertically'), disabled: toolbar.flip, run: flip('flipV')},
  '-',
  {id: 'menuToFront', label: t('Bring to front'), key: 'End', disabled: noneSelected, run: () => moveSelection('front')},
  {id: 'menuToBack', label: t('Send to back'), key: 'Home', disabled: noneSelected, run: () => moveSelection('back')},
  '-',
  {id: 'menuSubtract', label: t('Subtract'), disabled: toolbar.subtract, run: bool('subtract')},
  {id: 'menuUnion', label: t('Union'), disabled: toolbar.union, run: bool('union')},
  {id: 'menuIntersect', label: t('Intersect'), disabled: toolbar.intersect, run: bool('intersect')},
 ];
 return <Dropdown id="arrangeMenu" label={t('Arrange')} rows={rows} />;
}
