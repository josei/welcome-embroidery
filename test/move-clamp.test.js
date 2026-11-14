import test from 'node:test';
import assert from 'node:assert/strict';
import {clampMoveDelta, visibleCanvasRect} from '../src/moveClamp.js';

// Client pixels. A portrait phone is 390 x 844: the top bar takes 52 px, and the tool dock covers the bottom 64 px from y 780.
// A landscape phone is 844 x 390: the tool rail covers the left 104 px.
const PORTRAIT = {area: {left: 0, top: 52, right: 390, bottom: 780}, dock: {left: 0, top: 780, right: 390, bottom: 844}};
const LANDSCAPE = {area: {left: 0, top: 0, right: 844, bottom: 390}, rail: {left: 0, top: 0, right: 104, bottom: 390}};

test('the dock leaves the canvas above it on a portrait phone', () => {
  assert.deepEqual(visibleCanvasRect(PORTRAIT.area, [PORTRAIT.dock]), {left: 0, top: 52, right: 390, bottom: 780});
});

test('the rail leaves the canvas to its right on a landscape phone', () => {
  assert.deepEqual(visibleCanvasRect(LANDSCAPE.area, [LANDSCAPE.rail]), {left: 104, top: 0, right: 844, bottom: 390});
});

// The canvas passes getBoundingClientRect(), which returns a DOMRect: its edges are prototype getters, not own properties.
class RectLike {
  constructor(left, top, width, height) { this._l = left; this._t = top; this._w = width; this._h = height; }
  get left() { return this._l; }
  get top() { return this._t; }
  get right() { return this._l + this._w; }
  get bottom() { return this._t + this._h; }
}

test('the dock is respected when the canvas rect is a DOMRect-style object', () => {
  const area = new RectLike(0, 52, 390, 728);
  const dock = new RectLike(0, 780, 390, 64);
  assert.deepEqual(visibleCanvasRect(area, [dock]), {left: 0, top: 52, right: 390, bottom: 780});
});

test('the rail is respected when the canvas rect is a DOMRect-style object', () => {
  const area = new RectLike(0, 0, 844, 390);
  const rail = new RectLike(0, 0, 104, 390);
  assert.deepEqual(visibleCanvasRect(area, [rail]), {left: 104, top: 0, right: 844, bottom: 390});
});

test('an obstruction off the canvas leaves the canvas whole', () => {
  assert.deepEqual(visibleCanvasRect(PORTRAIT.area, [{left: 0, top: 0, right: 390, bottom: 40}]), PORTRAIT.area);
});

// World to client mapping used by the canvas: the svg is 390 px wide at client x 0, and world (0,0) sits at its centre.
const mapping = (svgRect) => ({scale: 4, center: [0, 0], svgRect});
const svgPortrait = {left: 0, top: 52, width: 390, height: 728};

function screenBox(box, delta, m) {
  const x = (v) => m.svgRect.left + (v - m.center[0]) * m.scale + m.svgRect.width / 2;
  const y = (v) => m.svgRect.top + (v - m.center[1]) * m.scale + m.svgRect.height / 2;
  return {l: x(box[0] + delta[0]), t: y(box[1] + delta[1]), r: x(box[2] + delta[0]), b: y(box[3] + delta[1])};
}

test('a portrait drag down stops the object above the dock', () => {
  const m = mapping(svgPortrait), box = [-5, -5, 5, 5];
  const visible = PORTRAIT.area;
  const d = clampMoveDelta({box, delta: [0, 500], ...m, visible});
  const s = screenBox(box, d, m);
  assert.ok(s.b <= visible.bottom + 1e-9, `bottom ${s.b} should be above the dock at ${visible.bottom}`);
  assert.ok(s.b > visible.bottom - 1e-6, 'the object reaches the edge rather than stopping short');
});

test('a landscape drag left stops the object at the rail', () => {
  const svgLandscape = {left: 0, top: 0, width: 844, height: 390};
  const m = mapping(svgLandscape), box = [-5, -5, 5, 5];
  const railVisible = visibleCanvasRect(LANDSCAPE.area, [LANDSCAPE.rail]);
  const d = clampMoveDelta({box, delta: [-500, 0], ...m, visible: railVisible});
  const s = screenBox(box, d, m);
  assert.ok(s.l >= railVisible.left - 1e-9, `left ${s.l} should stay right of the rail at ${railVisible.left}`);
  assert.ok(s.l < railVisible.left + 1e-6, 'the object reaches the rail rather than stopping short');
});

test('a drag that keeps the object on the canvas is left alone', () => {
  const m = mapping(svgPortrait), box = [-5, -5, 5, 5];
  assert.deepEqual(clampMoveDelta({box, delta: [3, -2], ...m, visible: PORTRAIT.area}), [3, -2]);
});

test('an object larger than the visible canvas keeps its leading edge in view', () => {
  const m = mapping(svgPortrait), box = [0, 0, 400, 400];
  const d = clampMoveDelta({box, delta: [-100, 0], ...m, visible: PORTRAIT.area});
  const s = screenBox(box, d, m);
  assert.ok(s.l >= PORTRAIT.area.left - 1e-9, 'the left edge is kept in view');
});
