import test from 'node:test';
import assert from 'node:assert/strict';
import {copyName} from '../src/objectNames.js';
import {initialDocument,applyOperations} from '../src/engine.js';

test('copies are numbered from the base name, not stacked as "copy copy"', () => {
  assert.equal(copyName('Rectangle', 'rect', ['Rectangle']), 'Rectangle 2');
  assert.equal(copyName('Rectangle 2', 'rect', ['Rectangle', 'Rectangle 2']), 'Rectangle 3');
  assert.equal(copyName('Rectangle copy copy', 'rect', ['Rectangle']), 'Rectangle 2');
  assert.equal(copyName('', 'rect', []), 'rect 2');
  assert.equal(copyName(undefined, 'ellipse', []), 'ellipse 2');
  assert.equal(copyName('Rectangle 2', 'rect', ['Rectangle 2', 'Rectangle 3']), 'Rectangle 4');
});

test('copy, paste and duplicate in a row never repeat a name', () => {
  const doc = initialDocument();
  doc.objects = [];
  applyOperations(doc, [{op: 'add_shape', id: 'box', kind: 'rect', x: 0, y: 0, width: 10, height: 8, thread: '#527461'}]);
  const names = () => doc.objects.map(o => o.name);
  const first = doc.objects[0].name;
  applyOperations(doc, [{op: 'duplicate', id: 'box', newId: 'c1', dx: 3, dy: 3}]);
  applyOperations(doc, [{op: 'duplicate', id: 'c1', newId: 'c2', dx: 3, dy: 3}]);
  applyOperations(doc, [{op: 'duplicate', id: 'box', newId: 'c3', dx: 3, dy: 3}]);
  assert.equal(new Set(names()).size, names().length, `repeated names: ${names()}`);
  assert.notEqual(first, undefined);
  assert.deepEqual(names().slice(1), [`${first} 2`, `${first} 3`, `${first} 4`]);
});
