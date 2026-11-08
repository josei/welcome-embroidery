import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
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

// A dropdown: a header button that opens a list of entries. Closes on an outside press, Escape, or after an entry runs.
function Dropdown({id, label, rows}: {id: string; label: string; rows: Row[]}) {
 const [open, setOpen] = useState(false);
 const wrap = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (!open) return;
  const away = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
  const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
  document.addEventListener('pointerdown', away);
  document.addEventListener('keydown', escape);
  return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
 }, [open]);
 return (
  <div className="file-menu" ref={wrap}>
   <button type="button" id={id} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{label}</button>
   {open && (
    <div role="menu" id={`${id}List`} className="file-menu-list">
     {rows.map((row, i) => row === '-' ? <hr key={`sep${i}`} className="menu-sep" /> : (
      <button key={row.id} type="button" role="menuitem" id={row.id} disabled={row.disabled}
        className={row.key ? 'menu-item' : undefined} onClick={() => { setOpen(false); row.run(); }}>
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
  {id: 'menuSaveAs', label: t('Save As…'), hint: picker ? t('Choose a new file') : t('Download under a name you type'), run: () => void projectSaveAs()},
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
