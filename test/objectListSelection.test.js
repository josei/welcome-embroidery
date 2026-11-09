import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionChange} from '../src/objectListSelection.js';

// Six visible rows in sewing order. Row 3 and row 4 are the two members of an open group, so both rows select both ids,
// and the group's header (row 2 here) lists the same two ids.
const rows = [['a'], ['b', 'c'], ['b', 'c'], ['d'], ['e'], ['f']];
const set = (...ids) => new Set(ids);
const sorted = ids => [...ids].sort();

test('a plain click replaces the selection with the clicked row', () => {
  const r = selectionChange(rows, set('a', 'd'), 'a', 4, 'plain');
  assert.deepEqual(r.ids, ['e']);
  assert.equal(r.primary, 'e');
  assert.equal(r.anchor, 'e');
});

test('a plain click on a group row selects its members', () => {
  const r = selectionChange(rows, set('a'), 'a', 1, 'plain');
  assert.deepEqual(sorted(r.ids), ['b', 'c']);
  assert.equal(r.anchor, 'b');
});

test('Shift selects every row from the anchor to the clicked row, in sewing order', () => {
  const r = selectionChange(rows, set('a'), 'a', 3, 'range');
  assert.deepEqual(sorted(r.ids), ['a', 'b', 'c', 'd']);
  assert.equal(r.primary, 'd');
  assert.equal(r.anchor, 'a', 'Shift does not move the anchor');
});

test('Shift works upward from the anchor too, and includes group rows', () => {
  const r = selectionChange(rows, set('f'), 'e', 1, 'range');
  assert.deepEqual(sorted(r.ids), ['b', 'c', 'd', 'e']);
  assert.equal(r.anchor, 'e');
});

test('Shift with no anchor yet acts as a plain click', () => {
  const r = selectionChange(rows, set('a'), null, 4, 'range');
  assert.deepEqual(r.ids, ['e']);
  assert.equal(r.anchor, 'e');
});

test('Ctrl adds an unselected row and leaves the other rows selected', () => {
  const r = selectionChange(rows, set('a', 'b', 'c'), 'a', 5, 'toggle');
  assert.deepEqual(sorted(r.ids), ['a', 'b', 'c', 'f']);
  assert.equal(r.primary, 'f');
  assert.equal(r.anchor, 'f');
});

test('Ctrl removes a selected row and leaves the other rows selected', () => {
  const r = selectionChange(rows, set('a', 'd', 'e'), 'e', 3, 'toggle');
  assert.deepEqual(sorted(r.ids), ['a', 'e']);
  assert.equal(r.anchor, 'd');
});

test('Ctrl on a selected group row removes all its members', () => {
  const r = selectionChange(rows, set('a', 'b', 'c', 'd'), 'a', 2, 'toggle');
  assert.deepEqual(sorted(r.ids), ['a', 'd']);
});

test('Ctrl on the only selected row changes nothing', () => {
  assert.equal(selectionChange(rows, set('e'), 'e', 4, 'toggle'), null);
});

test('a click on a row that does not exist changes nothing', () => {
  assert.equal(selectionChange(rows, set('a'), 'a', 9, 'plain'), null);
});
