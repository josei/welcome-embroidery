import test from 'node:test';
import assert from 'node:assert/strict';
import {newShapeSpot} from '../src/newShapePlacement.js';

const hoop = {w: 100, h: 100};
const rect = (id, x, y, w, h) => ({id, kind: 'rect', x, y, w, h});
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('the first shape goes at the hoop centre, as before', () => {
  assert.deepEqual(newShapeSpot([], hoop, 24, 16), {x: -12, y: -8, overlaps: false});
});

test('three successive adds with no drag land in three places, none covering another', () => {
  const objects = [];
  const spots = [];
  for (const kind of ['rect', 'ellipse', 'rect']) {
    const s = newShapeSpot(objects, hoop, 24, 16);
    assert.equal(s.overlaps, false);
    spots.push(s);
    objects.push(rect(String(objects.length), s.x, s.y, 24, 16));
  }
  const keys = new Set(spots.map(s => `${s.x},${s.y}`));
  assert.equal(keys.size, 3);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.equal(overlap(objects[i], objects[j]), false);
});

test('when no free slot is inside the hoop, the shape goes at the centre and reports overlap', () => {
  const small = {w: 40, h: 30};
  const objects = [rect('a', -12, -8, 24, 16)];
  const s = newShapeSpot(objects, small, 24, 16);
  assert.equal(s.overlaps, true);
  assert.deepEqual([s.x, s.y], [-12, -8]);
});

test('a new shape stays inside the hoop', () => {
  const objects = [rect('a', -12, -8, 24, 16)];
  const s = newShapeSpot(objects, hoop, 24, 16);
  assert.ok(s.x >= -50 && s.y >= -50 && s.x + 24 <= 50 && s.y + 16 <= 50);
});

test('lettering-sized box with artwork at the centre lands in free space, not on it', () => {
  const art = [rect('flower', -12, -8, 24, 16), rect('stem', -2, 8, 4, 20)];
  const s = newShapeSpot(art, hoop, 30, 10);
  assert.equal(s.overlaps, false);
  const box = {x: s.x, y: s.y, w: 30, h: 10};
  for (const o of art) assert.equal(overlap(box, o), false);
});

test('lettering with no free space reports overlap and goes back at the centre', () => {
  const tight = {w: 40, h: 30};
  const objects = [rect('a', -20, -15, 40, 30)];
  const s = newShapeSpot(objects, tight, 30, 10);
  assert.equal(s.overlaps, true);
  assert.deepEqual([s.x, s.y], [-15, -5]);
});

const inside = (s, w, h, v) => s.x >= v.x0 && s.y >= v.y0 && s.x + w <= v.x1 && s.y + h <= v.y1;

test('with a visible area, the first shape goes inside it even when the hoop centre is off screen', () => {
  const view = {x0: 20, y0: -30, x1: 60, y1: 30};
  const s = newShapeSpot([], hoop, 24, 16, view);
  assert.equal(s.overlaps, false);
  assert.ok(inside(s, 24, 16, view), `spot ${JSON.stringify(s)} is outside ${JSON.stringify(view)}`);
});

test('with a visible area, successive shapes stay inside it and clear of each other', () => {
  const wide = {w: 200, h: 200};
  const view = {x0: -10, y0: -40, x1: 70, y1: 40};
  const objects = [];
  for (let i = 0; i < 4; i++) {
    const s = newShapeSpot(objects, wide, 24, 16, view);
    assert.equal(s.overlaps, false);
    assert.ok(inside(s, 24, 16, view), `shape ${i} at ${JSON.stringify(s)} is outside the view`);
    objects.push(rect(String(i), s.x, s.y, 24, 16));
  }
  for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) assert.equal(overlap(objects[i], objects[j]), false);
});

test('with a visible area and no free slot in it, the shape goes inside the visible part and reports overlap', () => {
  const view = {x0: -20, y0: -20, x1: 20, y1: 20};
  const objects = [rect('a', -20, -20, 40, 40)];
  const s = newShapeSpot(objects, hoop, 24, 16, view);
  assert.equal(s.overlaps, true);
  assert.ok(inside(s, 24, 16, view), `spot ${JSON.stringify(s)} is outside the view`);
});

test('a visible area larger than the hoop does not place a shape outside the hoop', () => {
  const s = newShapeSpot([], hoop, 24, 16, {x0: -500, y0: -500, x1: 500, y1: 500});
  assert.deepEqual([s.x, s.y], [-12, -8]);
});

test('a new shape is never placed edge to edge with a neighbour of another size', () => {
  const objects = [rect('tall', -12, -8, 24, 16)];
  const s = newShapeSpot(objects, hoop, 26, 8);
  assert.equal(s.overlaps, false);
  const box = {x: s.x, y: s.y, w: 26, h: 8};
  for (const o of objects) {
    const gapX = Math.max(o.x - (box.x + box.w), box.x - (o.x + o.w));
    const gapY = Math.max(o.y - (box.y + box.h), box.y - (o.y + o.h));
    assert.ok(Math.max(gapX, gapY) >= 4, `gap to ${o.id} is ${Math.max(gapX, gapY)} mm`);
  }
});

test('new lettering on a phone or tablet portrait keeps at least 5 mm inside the hoop rim', () => {
  const s = newShapeSpot([], {w: 130, h: 180}, 30, 10);
  assert.ok(s.y >= -90 + 5, `top edge ${s.y} is inside the rim by at least 5 mm`);
  assert.ok(s.y + 10 <= 90 - 5, 'bottom edge is inside the rim by at least 5 mm');
});

test('a free slot never sits within 5 mm of the hoop rim, even when the view reaches the rim', () => {
  const s = newShapeSpot([], {w: 100, h: 100}, 30, 10, {x0: -50, y0: -50, x1: 50, y1: 50});
  assert.ok(s.y >= -45 && s.y + 10 <= 45 && s.x >= -45 && s.x + 30 <= 45);
});
