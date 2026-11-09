import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_MEMORY, RECENT_LIMIT, filterCommands, recentCommands, rememberRun, repeatPlan} from '../src/commandPaletteLogic.js';
import {SHORTCUT_TABLE, shortcutForCommand} from '../src/shortcutTable.js';

const commands = [
  {id: 'undo', label: 'Undo'},
  {id: 'duplicate', label: 'Duplicate'},
  {id: 'group', label: 'Group'},
  {id: 'alignLeft', label: 'Align left'},
  {id: 'tool:rect', label: 'Rectangle tool'},
  {id: 'copy', label: 'Copy'},
];

test('filtering is case-insensitive and matches a substring anywhere in the label', () => {
  assert.deepEqual(filterCommands(commands, 'DUP').map(c => c.id), ['duplicate']);
  assert.deepEqual(filterCommands(commands, 'ign').map(c => c.id), ['alignLeft']);
  assert.deepEqual(filterCommands(commands, 'tool').map(c => c.id), ['tool:rect']);
  assert.deepEqual(filterCommands(commands, '  left ').map(c => c.id), ['alignLeft'], 'surrounding spaces are ignored');
});

test('an empty query lists every command in order, and a miss lists none', () => {
  assert.equal(filterCommands(commands, '').length, commands.length);
  assert.equal(filterCommands(commands, 'zzz').length, 0);
});

test('Recent keeps the last five runs, most recent first, without repeats', () => {
  let memory = EMPTY_MEMORY;
  for (const id of ['undo', 'copy', 'group', 'undo', 'duplicate', 'alignLeft', 'tool:rect']) {
    memory = rememberRun(memory, id, false);
  }
  assert.equal(RECENT_LIMIT, 5);
  assert.deepEqual(memory.recent, ['tool:rect', 'alignLeft', 'duplicate', 'undo', 'group']);
  assert.deepEqual(recentCommands(commands, memory.recent).map(c => c.id), ['tool:rect', 'alignLeft', 'duplicate', 'undo', 'group'].filter(id => commands.some(c => c.id === id)));
});

test('a recent id with no command in the list is skipped', () => {
  assert.deepEqual(recentCommands(commands, ['gone', 'copy']).map(c => c.id), ['copy']);
});

test('only a command that recorded an undo entry becomes the repeat target', () => {
  let memory = rememberRun(EMPTY_MEMORY, 'duplicate', true);
  memory = rememberRun(memory, 'copy', false);
  assert.equal(memory.lastEdit, 'duplicate', 'copy is not an edit, so duplicate stays the target');
  memory = rememberRun(memory, 'group', true);
  assert.equal(memory.lastEdit, 'group');
});

test('repeat-last-action says so when there is no previous edit, and reports a target that no longer applies', () => {
  assert.deepEqual(repeatPlan(EMPTY_MEMORY, () => true), {kind: 'none'});
  const memory = rememberRun(EMPTY_MEMORY, 'group', true);
  assert.deepEqual(repeatPlan(memory, () => true), {kind: 'run', id: 'group'});
  assert.deepEqual(repeatPlan(memory, () => false), {kind: 'disabled', id: 'group'});
});

test('repeating keeps the remembered command as the same one', () => {
  let memory = rememberRun(EMPTY_MEMORY, 'duplicate', true);
  const plan = repeatPlan(memory, () => true);
  assert.equal(plan.kind, 'run');
  memory = rememberRun(memory, plan.id, true);
  assert.equal(memory.lastEdit, 'duplicate');
  assert.equal(memory.recent[0], 'duplicate');
});

test('a command shows the shortcut from the shortcut table, and a command with no key shows none', () => {
  assert.equal(shortcutForCommand('copy', false), 'Ctrl+C');
  assert.equal(shortcutForCommand('copy', true), '⌘C');
  assert.equal(shortcutForCommand('repeatLast', true), '⇧⌘Y');
  assert.equal(shortcutForCommand('openPalette', true), '⌘K');
  assert.equal(shortcutForCommand('tool:rect', true), 'R');
  assert.equal(shortcutForCommand('zoomOut', true), '');
});

test('every table command is unique to one row, so no palette entry has two keys', () => {
  const ids = SHORTCUT_TABLE.map(e => e.command).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
});
