import test from 'node:test';
import assert from 'node:assert/strict';
import {designName} from '../src/designName.js';

test('the canvas name reads empty with no objects, then the object and stitch counts', () => {
  assert.equal(designName([], {}), 'Design canvas, empty');
  assert.equal(designName([{id: 'a'}], {}), 'Design canvas, 1 object');
  assert.equal(designName([{id: 'a'}], {a: 573}), 'Design canvas, 1 object, 573 stitches');
  assert.equal(designName([{id: 'a'}, {id: 'b'}], {a: 1, b: 2}), 'Design canvas, 2 objects, 3 stitches');
  assert.equal(designName([{id: 'a'}], {a: 1}), 'Design canvas, 1 object, 1 stitch');
});

test('counts for objects no longer in the document are ignored', () => {
  assert.equal(designName([{id: 'a'}], {a: 5, gone: 99}), 'Design canvas, 1 object, 5 stitches');
});
