import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHORTCUT_TABLE, TOOL_KEYS, shortcutSections} from '../src/shortcutTable.js';

// Every key the keyboard handler compares against, read from its source: `e.key === 'x'`, `key === 'x'`, `e.code === 'Digit1'`.
const handlerSource = readFileSync(new URL('../src/keyboardShortcuts.js', import.meta.url), 'utf8');
const handlerKeys = new Set([...handlerSource.matchAll(/\b(?:e\.)?(?:key|code)\s*===\s*'([^']+)'/g)].map(m => m[1]));

test('the handler compares against a real set of keys (the scan is not empty)', () => {
  for (const key of ['Enter', 'Escape', 'Backspace', 'Home', 'End', '[', ']', 'ArrowLeft', 'ArrowDown', 'Digit1', '?']) {
    assert.ok(handlerKeys.has(key), `scan missed ${key}`);
  }
  assert.ok(handlerKeys.size >= 15, `only ${handlerKeys.size} keys found`);
});

test('every key the keyboard handler accepts is in the shortcut table', () => {
  const tableKeys = new Set(SHORTCUT_TABLE.flatMap(entry => entry.keys));
  const missing = [...handlerKeys].filter(key => !tableKeys.has(key));
  assert.deepEqual(missing, [], 'handler keys with no row in the shortcut table');
});

test('every key in the shortcut table appears in the shortcut sheet', () => {
  const sheet = shortcutSections(SHORTCUT_TABLE, false);
  const rows = sheet.flatMap(([, list]) => list);
  assert.equal(rows.length, SHORTCUT_TABLE.length, 'one sheet row per table entry');
  for (const entry of SHORTCUT_TABLE) {
    assert.ok(sheet.some(([heading]) => heading === entry.section), `no sheet heading for ${entry.section}`);
    for (const key of entry.keys) {
      assert.ok(rows.some(([, desc]) => desc === entry.desc), `${key} (${entry.desc}) is missing from the sheet`);
    }
  }
});

test('the sheet names the zoom, measure, knife, backspace, nudge and sewing-order keys', () => {
  const text = shortcutSections(SHORTCUT_TABLE, false).flatMap(([, rows]) => rows.map(([key, desc]) => `${key} ${desc}`)).join('\n');
  for (const word of ['Measure', 'Knife', 'Backspace', 'Zoom in / out', 'Fit everything', 'Zoom to selection', 'Fit the hoop', 'Nudge', 'Send backward', 'Bring to front']) {
    assert.match(text, new RegExp(word), word);
  }
  assert.match(text, /Resize from the top-left corner/);
});

test('tool keys press the toolbar buttons they name', () => {
  assert.equal(TOOL_KEYS.v, 'select');
  assert.equal(TOOL_KEYS.m, 'measure');
  assert.equal(TOOL_KEYS.k, 'knife');
  assert.equal(TOOL_KEYS.s, 'star');
});
