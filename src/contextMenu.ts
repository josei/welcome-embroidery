// The context menu on the canvas: the same items, shortcuts and disabled states as before, built from the current
// selection, document and clipboard. Each item runs the action the toolbar or the keyboard runs.
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {clipboardNow} from './clipboardState.js';
import {enterEdit} from './canvasText.js';
import {moveSelection} from './sewingOrder.js';
import {copySelection, pasteClipboard, removeSelected, selectAll, selectedObject} from './selectionCommands.js';
import type {SelectionObject} from './selectionCommands.js';
import {duplicateSelection, groupSelection, ungroupSelection} from './toolbarCommands.js';

/** What the context menu needs from the editor beyond the shared commands. */
export interface ContextMenuApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
  copyStyle(): void;
  pasteStyle(): void;
  fitHoop(): void;
  fitAll(): void;
  fitSelection(): void;
}

/** One context-menu row; a '-' row is a separator. */
export interface MenuItem {
  label: string;
  key?: string;
  disabled?: boolean;
  run?: () => void;
}

let api: ContextMenuApi | null = null;

function wired(): ContextMenuApi {
  if (!api) throw Error('The context menu is not wired.');
  return api;
}

/** Wires the context menu, once. app.js calls it after the canvas exists. */
export function configureContextMenu(next: ContextMenuApi) {
  api = next;
}

/** A context-menu row, or '-' for a separator. */
export type MenuRow = MenuItem | '-';

/** The menu for the current selection. The canvas calls it with the object and point under the pointer. */
export function menuItems(_o: unknown, _p: unknown): MenuRow[] {
  const selected = selState().multi;
  const has = Boolean(selected.size);
  const one = selected.size === 1;
  const objects = documentNow().doc.objects as SelectionObject[];
  const picked = objects.filter(v => selected.has(v.id));
  const canGroup = selected.size > 1;
  const grouped = picked.some(v => v.groupId);
  const primary = selectedObject();
  const kindPath = one && primary?.kind === 'path';
  if (!has) {
    return [
      {label: 'Paste', key: 'Ctrl+V', disabled: !clipboardNow().clipboard, run: pasteClipboard},
      {label: 'Select all', key: 'Ctrl+A', run: selectAll},
      '-',
      {label: 'Fit hoop in view', key: 'Shift+0', run: () => wired().fitHoop()},
      {label: 'Fit everything', key: 'Shift+1', run: () => wired().fitAll()},
    ];
  }
  return [
    {label: one && primary?.kind === 'text' ? 'Edit text' : kindPath ? 'Edit nodes' : 'Edit nodes (convert to path)', key: 'Enter', disabled: !one ||
      primary?.kind === 'stitch_layer', run: () => primary && enterEdit(primary)},
    {label: 'Convert to path', key: 'Ctrl+Shift+C', disabled: !picked.some(v => v.kind !== 'path' && v.kind !== 'stitch_layer'), run: () =>
      wired().edit([{op: 'to_path', ids: picked.filter(v => v.kind !== 'path' && v.kind !== 'stitch_layer').map(v => v.id)}])}, '-',
    {label: 'Cut', key: 'Ctrl+X', run: () => { if (copySelection()) removeSelected(); }}, {label: 'Copy', key: 'Ctrl+C', run: copySelection},
      {label: 'Paste', key: 'Ctrl+V', disabled: !clipboardNow().clipboard, run: pasteClipboard}, {label: 'Duplicate', key: 'Ctrl+D', run: duplicateSelection},
      {label: 'Copy style', key: 'Ctrl+Alt+C', disabled: !one, run: () => wired().copyStyle()},
      {label: 'Paste style', key: 'Ctrl+Alt+V', disabled: !clipboardNow().styleClip, run: () => wired().pasteStyle()},
      {label: 'Delete', key: 'Del', run: removeSelected}, '-',
    {label: 'Group', key: 'Ctrl+G', disabled: !canGroup, run: groupSelection},
      {label: 'Ungroup', key: 'Ctrl+Shift+G', disabled: !grouped, run: ungroupSelection}, '-',
    {label: 'Sew first (to back)', key: 'Home', run: () => moveSelection('back')}, {label: 'Sew earlier', key: '[', run: () => moveSelection('backward')},
      {label: 'Sew later', key: ']', run: () => moveSelection('forward')}, {label: 'Sew last (to front)', key: 'End', run: () => moveSelection('front')}, '-',
    {label: picked.every(v => v.locked) ? 'Unlock' : 'Lock', run: () =>
      wired().edit(picked.map(v => ({op: 'set_object', id: v.id, locked: !picked.every(w => w.locked)})))},
      {label: 'Hide', run: () => wired().edit(picked.map(v => ({op: 'set_object', id: v.id, visible: false})))}, '-',
    {label: 'Zoom to selection', key: 'Shift+2', run: () => wired().fitSelection()}, {label: 'Select all', key: 'Ctrl+A', run: selectAll},
  ];
}
