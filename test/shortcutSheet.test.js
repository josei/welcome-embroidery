import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readdirSync} from 'node:fs';
import {SHORTCUT_TABLE, TOOL_KEYS, shortcutFor, shortcutSections} from '../src/shortcutTable.js';

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

test('every tool and add button in the table has a tooltip that reads its shortcut from the table', () => {
  // The components name each button's key with shortcutFor('<id>') in its tooltip; collect those ids from the sources.
  const componentDir = new URL('../src/components/', import.meta.url);
  const tooltipIds = new Set(readdirSync(componentDir).filter(f => f.endsWith('.tsx'))
    .flatMap(f => [...readFileSync(new URL(f, componentDir), 'utf8').matchAll(/shortcutFor\('([^']+)'\)/g)].map(m => m[1])));
  const buttonIds = SHORTCUT_TABLE.flatMap(entry => [entry.press, entry.button]).filter(Boolean);
  assert.ok(buttonIds.length >= 10, 'the table names the tool and button rows');
  const missing = buttonIds.filter(id => !tooltipIds.has(id));
  assert.deepEqual(missing, [], 'table buttons whose tooltip does not read the table');
});

test('a tooltip shortcut and the shortcut sheet show the same key', () => {
  const sheet = new Map(shortcutSections(SHORTCUT_TABLE, false).flatMap(([, rows]) => rows.map(([label, desc]) => [desc, label])));
  for (const entry of SHORTCUT_TABLE) {
    const id = entry.press ?? entry.button;
    if (!id) continue;
    assert.equal(shortcutFor(id, false), sheet.get(entry.desc), `${id}: tooltip and sheet disagree`);
  }
});

test('rectangle, ellipse and lettering show R, O and T; export has a shortcut', () => {
  assert.equal(shortcutFor('rect', false), 'R');
  assert.equal(shortcutFor('ellipse', false), 'O');
  assert.equal(shortcutFor('letter', false), 'T');
  assert.equal(shortcutFor('export', false), 'Ctrl+Shift+E');
  assert.equal(shortcutFor('export', true), '⇧⌘E');
  assert.throws(() => shortcutFor('nope'), /no shortcut/);
});
