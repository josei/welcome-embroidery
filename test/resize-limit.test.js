import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MIN_RESIZE_SIZE,clampResizeScale} from '../src/resizeLimit.js';

test('the minimum side is 8 units', () => {
  assert.equal(MIN_RESIZE_SIZE, 8);
});

test('a scale that keeps the side at or above 8 units is left alone', () => {
  assert.equal(clampResizeScale(0.5, 40), 0.5);
  assert.equal(clampResizeScale(1.8, 40), 1.8);
  assert.equal(clampResizeScale(0.2, 40), 0.2);
});

test('shrinking past 8 units stops at exactly 8 units', () => {
  assert.equal(clampResizeScale(0.02, 40) * 40, 8);
  assert.equal(clampResizeScale(0.1, 30) * 30, 8);
});

test('a drag past the opposite edge (negative scale) stops at 8 units and does not flip', () => {
  const s = clampResizeScale(-1.5, 40);
  assert.ok(s > 0, 'scale stays positive, so the object is not mirrored');
  assert.equal(s * 40, 8);
});

test('no resize produces a side smaller than 8 units when the side starts at 8 or more', () => {
  for (const size of [8, 30, 40, 200]) {
    for (const scale of [-3, -0.5, 0, 0.001, 0.02, 0.5, 2]) {
      assert.ok(clampResizeScale(scale, size) * size >= MIN_RESIZE_SIZE - 1e-9, `size ${size}, scale ${scale}`);
    }
  }
});

test('a side already under 8 units is held at its current size, never enlarged', () => {
  assert.equal(clampResizeScale(1, 4), 1);
  assert.equal(clampResizeScale(0.75, 4), 1);
  assert.equal(clampResizeScale(-1, 4), 1);
  assert.equal(clampResizeScale(0.9, 5), 1);
});

test('no resize of a side under 8 units increases its size', () => {
  for (const size of [1, 4, 5, 7.5]) {
    for (const scale of [-3, -0.5, 0, 0.001, 0.5, 0.9, 1]) {
      assert.ok(clampResizeScale(scale, size) <= 1, `size ${size}, scale ${scale}`);
    }
  }
});

test('a zero-size side has no proportion to keep, so the scale is returned unchanged', () => {
  assert.equal(clampResizeScale(0.5, 0), 0.5);
});
