import test from 'node:test';
import assert from 'node:assert/strict';
import {hoopFitMargin, currentFitMargin, PHONE_FIT_MARGIN, EDITOR_FIT_MARGIN} from '../src/fitMargin.js';

const phone = {smallSide: 377, touch: true, phoneLayout: true};

test('a touch phone layout fits the hoop with the small margin', () => {
  assert.equal(hoopFitMargin(phone), PHONE_FIT_MARGIN);
});

test('a touch tablet in portrait keeps the full margin even though its canvas is narrow', () => {
  assert.equal(hoopFitMargin({smallSide: 377, touch: true, phoneLayout: false}), EDITOR_FIT_MARGIN);
});

test('a mouse window keeps the canvas-size rule: a short canvas gets the small margin', () => {
  assert.equal(hoopFitMargin({smallSide: 500, touch: false, phoneLayout: false}), PHONE_FIT_MARGIN);
  assert.equal(hoopFitMargin({smallSide: 599, touch: false, phoneLayout: false}), PHONE_FIT_MARGIN);
});

test('a mouse window with a canvas of 600 px or more gets the full margin', () => {
  assert.equal(hoopFitMargin({smallSide: 600, touch: false, phoneLayout: false}), EDITOR_FIT_MARGIN);
  assert.equal(hoopFitMargin({smallSide: 800, touch: false, phoneLayout: true}), EDITOR_FIT_MARGIN);
});

test('the margin is chosen from the pointer and layout, reading matchMedia', () => {
  const queries = {};
  const matches = (q) => ({matches: !!queries[q]});
  globalThis.matchMedia = (q) => matches(q);
  try {
    // Touch tablet, portrait: narrow canvas, but not a phone layout.
    queries['(pointer: coarse)'] = true;
    assert.equal(currentFitMargin(377), EDITOR_FIT_MARGIN);
    // Touch phone: width breakpoint.
    queries['(max-width: 600px), (max-height: 500px)'] = true;
    assert.equal(currentFitMargin(377), PHONE_FIT_MARGIN);
    // Mouse window, short canvas: the old canvas-size rule still applies.
    delete queries['(pointer: coarse)'];
    delete queries['(max-width: 600px), (max-height: 500px)'];
    assert.equal(currentFitMargin(500), PHONE_FIT_MARGIN);
    assert.equal(currentFitMargin(700), EDITOR_FIT_MARGIN);
  } finally {
    delete globalThis.matchMedia;
  }
});
