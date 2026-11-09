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
 */

const M = {mod: true};

/** @type {ShortcutEntry[]} */
export const SHORTCUT_TABLE = [
  {section: 'File', keys: ['s'], label: [{...M, key: 'S'}], desc: 'Save'},
  {section: 'File', keys: ['s'], label: [{...M, shift: true, key: 'S'}], desc: 'Save As'},
  {section: 'File', keys: ['o'], label: [{...M, key: 'O'}], desc: 'Open'},
  {section: 'File', keys: ['n'], label: [{...M, key: 'N'}], desc: 'New'},

  {section: 'Tools', keys: ['v'], label: 'V', desc: 'Select', press: 'select'},
  {section: 'Tools', keys: ['r'], label: 'R', desc: 'Rectangle', press: 'rect'},
  {section: 'Tools', keys: ['o'], label: 'O', desc: 'Ellipse', press: 'ellipse'},
  {section: 'Tools', keys: ['t'], label: 'T', desc: 'Lettering', press: 'letter'},
  {section: 'Tools', keys: ['n'], label: 'N', desc: 'Draw path', press: 'path'},
  {section: 'Tools', keys: ['p'], label: 'P', desc: 'Pen with curves', press: 'pen'},
  {section: 'Tools', keys: ['l'], label: 'L', desc: 'Line', press: 'line'},
  {section: 'Tools', keys: ['g'], label: 'G', desc: 'Polygon', press: 'polygon'},
  {section: 'Tools', keys: ['s'], label: 'S', desc: 'Star', press: 'star'},
  {section: 'Tools', keys: ['m'], label: 'M', desc: 'Measure', press: 'measure'},
  {section: 'Tools', keys: ['k'], label: 'K', desc: 'Knife: click two or more points along the cut, then Enter', press: 'knife'},
  {section: 'Tools', keys: ['Enter'], label: 'Enter', desc: 'Edit nodes / finish a path'},
  {section: 'Tools', keys: ['Backspace'], label: 'Backspace', desc: 'Remove the last point while drawing a path'},
  {section: 'Tools', keys: ['Escape'], label: 'Esc', desc: 'Cancel, go back to select'},

  {section: 'Edit', keys: ['z', 'y'], label: [{...M, key: 'Z'}, ' / ', {...M, key: 'Y'}], desc: 'Undo / redo'},
  {section: 'Edit', keys: ['c', 'x', 'v'], label: [{...M, key: 'C'}, ' / X / V'], desc: 'Copy, cut, paste'},
  {section: 'Edit', keys: ['d'], label: [{...M, key: 'D'}], desc: 'Duplicate'},
  {section: 'Edit', keys: ['c', 'v'], label: [{...M, alt: true, key: 'C'}, ' / ', {...M, alt: true, key: 'V'}], desc: 'Copy / paste style'},
  {section: 'Edit', keys: ['Delete', 'Backspace'], label: 'Del / Backspace', desc: 'Delete'},
  {section: 'Edit', keys: ['a'], label: [{...M, key: 'A'}], desc: 'Select all'},
  {section: 'Edit', keys: ['g'], label: [{...M, key: 'G'}, ' / ', {...M, shift: true, key: 'G'}], desc: 'Group / ungroup'},
  {section: 'Edit', keys: ['c'], label: [{...M, shift: true, key: 'C'}], desc: 'Convert to path'},
  {section: 'Edit', keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], label: 'Arrow keys', desc: 'Nudge ({shift} = 5 mm, {alt} = 0.1 mm)'},
  {section: 'Edit', keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], label: [{...M, key: 'Arrows', appleKey: '←↑→↓'}],
    desc: 'Resize from the top-left corner ({shift} = 5 mm steps)'},
  {section: 'Edit', keys: ['ArrowLeft', 'ArrowRight'], label: [{...M, alt: true, key: '←'}, ' / →'], desc: 'Rotate (1° per press, {shift} = 15°)'},

  {section: 'Sewing order', keys: ['['], label: '[', desc: 'Send backward (sew earlier)'},
  {section: 'Sewing order', keys: [']'], label: ']', desc: 'Bring forward (sew later)'},
  {section: 'Sewing order', keys: ['Home'], label: 'Home', desc: 'Send to back (sew first)'},
  {section: 'Sewing order', keys: ['End'], label: 'End', desc: 'Bring to front (sew last)'},

  {section: 'View', keys: ['Digit2'], label: [{shift: true, key: '2'}], desc: 'Zoom to selection'},
  {section: 'View', keys: ['Digit1'], label: [{shift: true, key: '1'}], desc: 'Fit everything'},
  {section: 'View', keys: ['Digit0'], label: [{shift: true, key: '0'}], desc: 'Fit the hoop'},
  {section: 'View', keys: ['+', '=', '-', '_'], label: '+ / −', desc: 'Zoom in / out'},
  {section: 'View', keys: ['?'], label: '?', desc: 'This list'},
];

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
