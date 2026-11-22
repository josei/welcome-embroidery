import {test} from 'node:test';
import assert from 'node:assert/strict';
import {designCountState, issueCount} from '../src/statusCount.js';

const ready = {errors: [], issues: [], count: 2514};
const outside = {errors: ['Logo extends 2.5 mm past the hoop.'], issues: [{id: 1, message: 'x'}], count: 2514};

test('a design with nothing outside the hoop shows the ready count as a figure, not in the warning colour', () => {
  assert.deepEqual(designCountState({plan: ready, compileError: '', }), {figure: true, error: false});
});

test('an object past the hoop keeps the count as a figure and marks it as an error', () => {
  assert.deepEqual(designCountState({plan: outside, compileError: '', }), {figure: true, error: true});
});

test('a failed compile is an error and has no figure', () => {
  assert.deepEqual(designCountState({plan: null, compileError: 'boom', }), {figure: false, error: true});
});

test('the stitch view shows the same figure and error state as the design view', () => {
  assert.deepEqual(designCountState({plan: outside, compileError: ''}), {figure: true, error: true});
});

test('the issues chip counts issues and sewing tips together', () => {
  assert.equal(issueCount({issues: [], tips: []}), 0);
  assert.equal(issueCount({issues: outside.issues, tips: ['a', 'b']}), 3);
});
