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
  const small = {w: 30, h: 20};
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
