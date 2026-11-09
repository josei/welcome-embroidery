// The command registry: every command a menu, toolbar button or shortcut runs, by id, with its label and the rule that
// decides whether it applies. The command palette lists these, the menus and keyboard handler run them through runCommand,
// and the shortcut label of each comes from the single shortcut table (shortcutTable.js), never from a second list here.
import {createStore} from './store.js';
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {selectAll, copySelection, pasteClipboard, removeSelected, selectedObject, orderedIds} from './selectionCommands.js';
import {moveSelection} from './sewingOrder.js';
import {groupSelection, ungroupSelection, duplicateSelection, undoDocument, redoDocument} from './toolbarCommands.js';
import {actionState} from './actionState.js';
import {alignActions, alignState} from './alignState.js';
import {selectionToolbarActions, selectionToolbarState} from './selectionToolbarState.js';
import {clipboardState} from './clipboardState.js';
import {copyStyle, pasteStyle} from './styleClipboard.js';
import {projectSaveAs} from './projectIO.js';
import {setShortcutsOpen} from './shortcutsState.js';
import {enterEdit} from './canvasText.js';
import {editor} from './editorContext.js';
import {t} from './i18n.js';
import {shortcutForCommand} from './shortcutTable.js';
import {setPaletteOpen} from './commandPaletteState.js';
import {EMPTY_MEMORY, filterCommands, recentCommands, rememberRun, repeatPlan} from './commandPaletteLogic.js';
import type {PaletteMemory} from './commandPaletteLogic.js';

/** One command. `label` is the English text; the palette translates it. `enabled` decides whether it applies now. */
export interface PaletteCommand {
  id: string;
  label: string;
  run: () => void;
  enabled: () => boolean;
  /** Undo and redo move through the history rather than record an entry, so they never become the repeat target. */
  historyStep?: boolean;
  /**
   * The command explains itself when it does not apply (for example "Copy a style first"), so a shortcut still runs it
   * to get that message. The palette and menus still show it disabled and never run it.
   */
  explainsWhenDisabled?: boolean;
}

/** A command as the palette shows it: translated label, shortcut from the table, and whether it can run now. */
export interface PaletteRow {
  id: string;
  label: string;
  shortcut: string;
  enabled: boolean;
}

/** Presses a toolbar button by id: the shortcut and menu paths share the button's own handler. */
function press(id: string) {
  (document.getElementById(id) as HTMLElement | null)?.click();
}

const hasSelection = () => selState().multi.size > 0;
const oneSelected = () => selState().multi.size === 1;
const always = () => true;

/** Converts the selected shapes to paths, leaving paths and stitch layers as they are. */
function convertSelectionToPath() {
  const ids = orderedIds().filter(id => {
    const object = documentNow().doc.objects.find((v: {id: string}) => v.id === id);
    return object?.kind !== 'path' && object?.kind !== 'stitch_layer';
  });
  if (ids.length) editor.edit([{op: 'to_path', ids}]);
}

const tool = (id: string, label: string): PaletteCommand => ({id: `tool:${id}`, label, run: () => press(id), enabled: always});
const align = (name: string, label: string): PaletteCommand => ({
  id: `align:${name}`, label, run: () => alignActions.press(name), enabled: () => !alignState.get().align,
});
const distribute = (name: string, label: string): PaletteCommand => ({
  id: `distribute:${name}`, label, run: () => alignActions.press(name), enabled: () => !alignState.get().distribute,
});
// The action flags say when a command is unavailable (true = disabled), as the menus and toolbar read them.
// Flips use the toolbar's flip flag, the same one the Arrange menu reads.
const flip = (name: 'flipH' | 'flipV', label: string): PaletteCommand => ({
  id: name, label, run: () => selectionToolbarActions.press(name), enabled: () => !selectionToolbarState.get().flip,
});
const boolean = (name: 'subtract' | 'union' | 'intersect', label: string): PaletteCommand => ({
  id: name, label, run: () => selectionToolbarActions.press(name), enabled: () => !selectionToolbarState.get()[name],
});
const order = (id: string, label: string, to: 'backward' | 'forward' | 'back' | 'front'): PaletteCommand => ({
  id, label, run: () => moveSelection(to), enabled: hasSelection,
});

/** Every command the palette lists, in the order it shows them when the query is empty. */
export const COMMANDS: PaletteCommand[] = [
  {id: 'save', label: 'Save', run: () => press('save'), enabled: always},
  {id: 'saveAs', label: 'Save As', run: () => void projectSaveAs(), enabled: always},
  {id: 'open', label: 'Open', run: () => press('open'), enabled: always},
  {id: 'new', label: 'New', run: () => press('new'), enabled: always},
  {id: 'export', label: 'Export', run: () => press('export'), enabled: () => (documentNow().doc.objects ?? []).length > 0},
  {id: 'undo', label: 'Undo', run: undoDocument, enabled: () => !actionState.get().undo, historyStep: true},
  {id: 'redo', label: 'Redo', run: redoDocument, enabled: () => !actionState.get().redo, historyStep: true},
  {id: 'cut', label: 'Cut', run: () => { if (copySelection()) removeSelected(); }, enabled: hasSelection},
  {id: 'copy', label: 'Copy', run: () => void copySelection(), enabled: hasSelection},
  {id: 'paste', label: 'Paste', run: pasteClipboard, enabled: () => clipboardState.get().clipboard !== null},
  {id: 'duplicate', label: 'Duplicate', run: duplicateSelection, enabled: () => !actionState.get().duplicate},
  {id: 'delete', label: 'Delete', run: removeSelected, enabled: () => !actionState.get().remove},
  {id: 'selectAll', label: 'Select all', run: selectAll, enabled: always},
  {id: 'group', label: 'Group', run: groupSelection, enabled: () => !actionState.get().group},
  {id: 'ungroup', label: 'Ungroup', run: ungroupSelection, enabled: () => !actionState.get().ungroup},
  {id: 'convertToPath', label: 'Convert to path', run: convertSelectionToPath, enabled: hasSelection},
  {id: 'copyStyle', label: 'Copy style', run: copyStyle, enabled: oneSelected, explainsWhenDisabled: true},
  {id: 'pasteStyle', label: 'Paste style', run: pasteStyle, enabled: () => clipboardState.get().styleClip !== null, explainsWhenDisabled: true},
  {id: 'editNodes', label: 'Edit nodes', run: () => enterEdit(selectedObject()), enabled: oneSelected},
  flip('flipH', 'Flip horizontally'),
  flip('flipV', 'Flip vertically'),
  align('left', 'Align left'),
  align('hcenter', 'Align horizontal centers'),
  align('right', 'Align right'),
  align('top', 'Align top'),
  align('vcenter', 'Align vertical centers'),
  align('bottom', 'Align bottom'),
  distribute('horizontal', 'Distribute horizontally'),
  distribute('vertical', 'Distribute vertically'),
  order('sendBackward', 'Send backward', 'backward'),
  order('bringForward', 'Bring forward', 'forward'),
  order('sendToBack', 'Send to back', 'back'),
  order('bringToFront', 'Bring to front', 'front'),
  boolean('subtract', 'Subtract'),
  boolean('union', 'Union'),
  boolean('intersect', 'Intersect'),
  {id: 'fitAll', label: 'Fit everything', run: () => editor.canvas.fitAll(), enabled: always},
  {id: 'fitSelection', label: 'Zoom to selection', run: () => editor.canvas.fitSelection(), enabled: always},
  {id: 'zoom100', label: 'Zoom to 100%', run: () => editor.canvas.zoomTo100(), enabled: always},
  {id: 'zoomIn', label: 'Zoom in', run: () => editor.canvas.zoomAt(1.25), enabled: always},
  {id: 'zoomOut', label: 'Zoom out', run: () => editor.canvas.zoomAt(1 / 1.25), enabled: always},
  tool('select', 'Select tool'),
  tool('rect', 'Rectangle tool'),
  tool('ellipse', 'Ellipse tool'),
  tool('letter', 'Lettering tool'),
  tool('path', 'Draw path tool'),
  tool('pen', 'Pen with curves tool'),
  tool('line', 'Line tool'),
  tool('polygon', 'Polygon tool'),
  tool('star', 'Star tool'),
  tool('measure', 'Measure tool'),
  tool('knife', 'Knife tool'),
  {id: 'shortcutSheet', label: 'Keyboard shortcuts', run: () => setShortcutsOpen(true), enabled: always},
  {id: 'openPalette', label: 'Command palette', run: () => setPaletteOpen(true), enabled: always},
  {id: 'repeatLast', label: 'Repeat last action', run: repeatLastAction, enabled: always},
];


const byId = (id: string) => COMMANDS.find(command => command.id === id);

/** Whether the command applies now. An unknown id never does. */
export function isEnabled(id: string): boolean {
  const command = byId(id);
  return command !== undefined && command.enabled();
}

/** Remembered runs: the Recent group and the repeat target. Read it with commandMemory.get(). */
export const commandMemory = createStore<PaletteMemory>(EMPTY_MEMORY);

/**
 * Runs a command by id, from a menu, the palette or a shortcut. A command that does not apply does nothing. A run is
 * remembered in Recent, and it becomes the repeat target when it recorded an undo entry.
 */
export function runCommand(id: string): boolean {
  // Repeat-last-action is not remembered itself: the command it re-runs is, and a repeat with nothing to repeat leaves Recent alone.
  if (id === 'repeatLast') { repeatLastAction(); return true; }
  const command = byId(id);
  if (!command) return false;
  const applies = command.enabled();
  if (!applies && !command.explainsWhenDisabled) return false;
  const before = documentNow().history;
  command.run();
  // A disabled command that explained itself was not really run, so it does not enter Recent.
  if (!applies) return true;
  const recorded = !command.historyStep && documentNow().history !== before;
  commandMemory.set(rememberRun(commandMemory.get(), id, recorded));
  return true;
}

/** Re-runs the last command that recorded an undo entry, or says why it cannot. */
export function repeatLastAction() {
  const plan = repeatPlan(commandMemory.get(), isEnabled);
  if (plan.kind === 'none') {
    editor.toast(t('No previous action to repeat.'));
    return;
  }
  if (plan.kind === 'disabled') {
    editor.toast(t('Nothing to repeat: {command} does not apply to the current selection.', {command: t(byId(plan.id)?.label ?? plan.id)}));
    return;
  }
  runCommand(plan.id);
}

/** The palette's rows for a query: the Recent group (only when the query is empty) and the matching commands. */
export function paletteRows(query: string): {recent: PaletteRow[]; all: PaletteRow[]} {
  const view = (command: PaletteCommand): PaletteRow => ({
    id: command.id,
    label: t(command.label),
    shortcut: shortcutForCommand(command.id),
    enabled: command.enabled(),
  });
  const remembered = recentCommands(COMMANDS, commandMemory.get().recent).map(view);
  const all = filterCommands(COMMANDS.map(view), query);
  return {recent: query.trim() ? [] : remembered, all};
}
