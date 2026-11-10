import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scrubValue, steppedValue, stepMultiplier} from '../src/numericFields.js';

const NONE = {shiftKey: false, altKey: false};
const SHIFT = {shiftKey: true, altKey: false};
const ALT = {shiftKey: false, altKey: true};

test('Shift multiplies the field step by 10 and Alt by 0.1; Ctrl is not a multiplier', () => {
  assert.equal(stepMultiplier(NONE), 1);
  assert.equal(stepMultiplier(SHIFT), 10);
  assert.equal(stepMultiplier(ALT), 0.1);
  assert.equal(stepMultiplier({shiftKey: false, altKey: false, ctrlKey: true}), 1);
});

test('satin width at 2 mm with a 0.5 step: Up 2.5, Shift+Up 7, Alt+Up 2.05', () => {
  assert.equal(String(steppedValue(2, 1, 0.5, NONE)), '2.5');
  assert.equal(String(steppedValue(2, 1, 0.5, SHIFT)), '7');
  assert.equal(String(steppedValue(2, 1, 0.5, ALT)), '2.05');
  assert.equal(String(steppedValue(2, -1, 0.5, NONE)), '1.5');
});

test('stepping clamps to the field min and max', () => {
  assert.equal(steppedValue(0.6, -1, 0.5, SHIFT, {min: 0.5, max: 7}), 0.5);
  assert.equal(steppedValue(6.8, 1, 0.5, SHIFT, {min: 0.5, max: 7}), 7);
});

test('scrubbing moves by whole pixel steps, coarser with Shift, clamped to the range', () => {
  assert.equal(String(scrubValue(2, 10, 5, 0.5, NONE)), '3');
  assert.equal(String(scrubValue(2, -10, 5, 0.5, NONE)), '1');
  assert.equal(String(scrubValue(2, 10, 5, 0.5, SHIFT)), '12');
  assert.equal(String(scrubValue(2, -100, 5, 0.5, NONE, {min: 0.5, max: 7})), '0.5');
});
