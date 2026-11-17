import test from 'node:test';
import assert from 'node:assert/strict';
import {applyOperations, compile, initialDocument, threadPlan} from '../src/engine.js';

// Every thread figure the editor shows (the Layers heading, the Document panel and the simulation bar) comes from threadTotals.

function blank() {
  const d = initialDocument();
  d.objects = [];
  return d;
}

test('thread length is the sum of the thread blocks, and the colours and changes count those blocks', () => {
  const d = blank();
  applyOperations(d, [
    {op: 'add_path', id: 'a', x: 0, y: 0, points: [[-20, 0], [20, 0]]}, {op: 'set_object', id: 'a', stitch: 'run', thread: '#c0392b'},
    {op: 'add_path', id: 'b', x: 0, y: 60, points: [[-15, 0], [15, 0]]}, {op: 'set_object', id: 'b', stitch: 'run', thread: '#2471a3'},
    {op: 'add_path', id: 'c', x: 0, y: 120, points: [[-10, 0], [10, 0]]}, {op: 'set_object', id: 'c', stitch: 'run', thread: '#c0392b'},
  ]);
  const plan = compile(d);
  const blocks = threadPlan(plan);
  const sum = blocks.reduce((n, b) => n + b.mm, 0);
  assert.equal(blocks.length, 3, 'red, blue, then red again: three blocks');
  assert.equal(plan.threads.lengthMm, sum, 'the displayed length is the sum over the threads');
  assert.equal(plan.threads.colours, 2, 'two colours are used');
  assert.equal(plan.threads.changes, 2, 'two colour changes between three blocks');
});
