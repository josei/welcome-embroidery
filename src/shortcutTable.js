// @ts-check
// The keyboard shortcut table: every key the keyboard handler (keyboardShortcuts.js) accepts, with the sheet row that
// describes it. The handler reads TOOL_KEYS from here, and the shortcuts dialog is built from SHORTCUT_TABLE, so the
// two cannot drift apart. test/shortcutSheet.test.js checks that every key the handler compares against is in the table.
//
// Each entry: `keys` are the handler's key names (letters are lower case, as the handler compares them after
// toLowerCase; `Digit1` is an e.code). `label` is a shortcutLabel chord list, or a plain string for keys with no modifier.
// `desc` is the sheet text, translated when the dialog renders; `{shift}` and `{alt}` stand for the modifier names.
import {shortcutLabel} from './shortcutLabels.js';

/**
 * @typedef {import('./shortcutLabels.js').Part} Part
 * @typedef {object} ShortcutEntry
 * @property {string} section the sheet heading the row sits under
 * @property {string[]} keys the handler key names this row covers
 * @property {Part[] | string} label the key as shown
 * @property {string} desc what it does
 * @property {string} [press] for a tool key: the toolbar button id the key presses
 * @property {string} [button] for a non-tool key: the toolbar button id the key clicks (its tooltip shows this key)
 * @property {string} [command] the command id the key runs (see commandRegistry.ts). The command palette takes its
 *   shortcut label from this row, so a command and its key are declared in one place.
 */

const M = {mod: true};

/** @type {ShortcutEntry[]} */
export const SHORTCUT_TABLE = [
  {section: 'File', keys: ['s'], label: [{...M, key: 'S'}], desc: 'Save', command: 'save'},
  {section: 'File', keys: ['s'], label: [{...M, shift: true, key: 'S'}], desc: 'Save As', command: 'saveAs'},
  {section: 'File', keys: ['o'], label: [{...M, key: 'O'}], desc: 'Open', command: 'open'},
  {section: 'File', keys: ['n'], label: [{...M, key: 'N'}], desc: 'New', command: 'new'},
  {section: 'File', keys: ['e'], label: [{...M, shift: true, key: 'E'}], desc: 'Export', button: 'export', command: 'export'},

  {section: 'Tools', keys: ['v'], label: 'V', desc: 'Select', press: 'select', command: 'tool:select'},
  {section: 'Tools', keys: ['r'], label: 'R', desc: 'Rectangle', press: 'rect', command: 'tool:rect'},
  {section: 'Tools', keys: ['o'], label: 'O', desc: 'Ellipse', press: 'ellipse', command: 'tool:ellipse'},
  {section: 'Tools', keys: ['t'], label: 'T', desc: 'Lettering', press: 'letter', command: 'tool:letter'},
  {section: 'Tools', keys: ['n'], label: 'N', desc: 'Draw path', press: 'path', command: 'tool:path'},
  {section: 'Tools', keys: ['p'], label: 'P', desc: 'Pen with curves', press: 'pen', command: 'tool:pen'},
  {section: 'Tools', keys: ['l'], label: 'L', desc: 'Line', press: 'line', command: 'tool:line'},
  {section: 'Tools', keys: ['g'], label: 'G', desc: 'Polygon', press: 'polygon', command: 'tool:polygon'},
  {section: 'Tools', keys: ['s'], label: 'S', desc: 'Star', press: 'star', command: 'tool:star'},
  {section: 'Tools', keys: ['m'], label: 'M', desc: 'Measure', press: 'measure', command: 'tool:measure'},
  {section: 'Tools', keys: ['k'], label: 'K', desc: 'Knife: click two or more points along the cut, then Enter', press: 'knife', command: 'tool:knife'},
  {section: 'Tools', keys: ['i'], label: 'I', desc: 'Focus the Stitch type controls of the selected object'},
  {section: 'Tools', keys: ['Enter'], label: 'Enter', desc: 'Edit nodes / finish a path', command: 'editNodes'},
  {section: 'Tools', keys: ['Backspace'], label: 'Backspace', desc: 'Remove the last point while drawing a path'},
  {section: 'Tools', keys: ['Escape'], label: 'Esc', desc: 'Cancel, go back to select'},

  {section: 'Edit', keys: ['z'], label: [{...M, key: 'Z'}], desc: 'Undo', command: 'undo'},
  {section: 'Edit', keys: ['y'], label: [{...M, key: 'Y'}], desc: 'Redo', command: 'redo'},
  {section: 'Edit', keys: ['c'], label: [{...M, key: 'C'}], desc: 'Copy', command: 'copy'},
  {section: 'Edit', keys: ['x'], label: [{...M, key: 'X'}], desc: 'Cut', command: 'cut'},
  {section: 'Edit', keys: ['v'], label: [{...M, key: 'V'}], desc: 'Paste', command: 'paste'},
  {section: 'Edit', keys: ['d'], label: [{...M, key: 'D'}], desc: 'Duplicate', command: 'duplicate'},
  {section: 'Edit', keys: ['c'], label: [{...M, alt: true, key: 'C'}], desc: 'Copy style', command: 'copyStyle'},
  {section: 'Edit', keys: ['v'], label: [{...M, alt: true, key: 'V'}], desc: 'Paste style', command: 'pasteStyle'},
  {section: 'Edit', keys: ['Delete', 'Backspace'], label: 'Del / Backspace', desc: 'Delete', command: 'delete'},
  {section: 'Edit', keys: ['a'], label: [{...M, key: 'A'}], desc: 'Select all', command: 'selectAll'},
  {section: 'Edit', keys: ['g'], label: [{...M, key: 'G'}], desc: 'Group', command: 'group'},
  {section: 'Edit', keys: ['g'], label: [{...M, shift: true, key: 'G'}], desc: 'Ungroup', command: 'ungroup'},
  {section: 'Edit', keys: ['c'], label: [{...M, shift: true, key: 'C'}], desc: 'Convert to path', command: 'convertToPath'},
  {section: 'Edit', keys: ['k'], label: [{...M, key: 'K'}], desc: 'Command palette', command: 'openPalette'},
  {section: 'Edit', keys: ['y'], label: [{...M, shift: true, key: 'Y'}], desc: 'Repeat last action', command: 'repeatLast'},
  {section: 'Edit', keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], label: 'Arrow keys', desc: 'Nudge ({shift} = 5 mm, {alt} = 0.1 mm)'},
  {section: 'Edit', keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], label: [{...M, key: 'Arrows', appleKey: '←↑→↓'}],
    desc: 'Resize from the top-left corner ({shift} = 5 mm steps)'},
  {section: 'Edit', keys: ['ArrowLeft', 'ArrowRight'], label: [{...M, alt: true, key: '←'}, ' / →'], desc: 'Rotate (1° per press, {shift} = 15°)'},

  {section: 'Sewing order', keys: ['['], label: '[', desc: 'Send backward (sew earlier)', command: 'sendBackward'},
  {section: 'Sewing order', keys: [']'], label: ']', desc: 'Bring forward (sew later)', command: 'bringForward'},
  {section: 'Sewing order', keys: ['Home'], label: 'Home', desc: 'Send to back (sew first)', command: 'sendToBack'},
  {section: 'Sewing order', keys: ['End'], label: 'End', desc: 'Bring to front (sew last)', command: 'bringToFront'},

  {section: 'View', keys: ['Digit2'], label: [{shift: true, key: '2'}], desc: 'Zoom to selection', command: 'fitSelection'},
  {section: 'View', keys: ['Digit1'], label: [{shift: true, key: '1'}], desc: 'Fit everything', command: 'fitAll'},
  {section: 'View', keys: ['Digit0'], label: [{shift: true, key: '0'}], desc: 'Fit the hoop', command: 'zoom100'},
  {section: 'View', keys: ['+', '=', '-', '_'], label: '+ / −', desc: 'Zoom in / out', command: 'zoomIn'},
  {section: 'View', keys: ['?'], label: '?', desc: 'This list', command: 'shortcutSheet'},
];

/**
 * The shortcut for a toolbar button, read from the table: its tooltip and the shortcut sheet both use this value.
 * Throws for a button with no row, so a tooltip cannot silently lose its key.
 * @param {string} id the toolbar button id (a tool's `press` or a button's `button`)
 * @param {boolean} [apple] override the detected platform (tests use this)
 * @returns {string}
 */
export function shortcutFor(id, apple) {
  const entry = SHORTCUT_TABLE.find(e => e.press === id || e.button === id);
  if (!entry) throw new Error(`no shortcut in the table for ${id}`);
  return typeof entry.label === 'string' ? entry.label : shortcutLabel(entry.label, apple);
}

/**
 * The shortcut label of a command, read from its table row, or '' when the command has no key. Apple platforms get
 * the ⌘ ⌥ ⇧ glyphs, as the sheet does.
 * @param {string} command
 * @param {boolean} [apple] override the detected platform (tests use this)
 * @returns {string}
 */
export function shortcutForCommand(command, apple) {
  const entry = SHORTCUT_TABLE.find(e => e.command === command);
  if (!entry) return '';
  return typeof entry.label === 'string' ? entry.label : shortcutLabel(entry.label, apple);
}

/** Tool key (lower case) to the toolbar button it presses, built from the table. */
/** @type {Record<string, string>} */
export const TOOL_KEYS = Object.fromEntries(
  SHORTCUT_TABLE.filter(e => e.press).map(e => [e.keys[0], /** @type {string} */ (e.press)]),
);

/**
 * The dialog's sections, in table order: each is [heading, rows], and each row is [key label, description].
 * @param {ShortcutEntry[]} table
 * @param {boolean} [apple] override the detected platform (tests use this)
 * @returns {Array<[string, Array<[string, string]>]>}
 */
export function shortcutSections(table, apple) {
  /** @type {Array<[string, Array<[string, string]>]>} */
  const sections = [];
  for (const entry of table) {
    const label = typeof entry.label === 'string' ? entry.label : shortcutLabel(entry.label, apple);
    const row = /** @type {[string, string]} */ ([label, entry.desc]);
    const found = sections.find(([heading]) => heading === entry.section);
    if (found) found[1].push(row); else sections.push([entry.section, [row]]);
  }
  return sections;
}
