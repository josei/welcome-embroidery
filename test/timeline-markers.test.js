import test from 'node:test';
import assert from 'node:assert/strict';
import {groupColourMarkers} from '../src/timelineMarkers.js';

// Spans as the simulation bar builds them: the first is the start of the plan, the rest begin at a colour change.
const spans = starts => starts.map((start, i) => ({thread: '#000000', start, seconds: i * 10}));

test('a clustered set of colour changes is one marker that selects the first change', () => {
  const groups = groupColourMarkers(spans([0, 100, 101, 102, 900]), 1000, 800);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].start, 100, 'the cluster opens at its first change');
  assert.equal(groups[0].count, 3, 'the three close changes share one marker');
  assert.equal(groups[1].start, 900);
  assert.equal(groups[1].count, 1);
});

test('no two marker centres are closer than a button is wide', () => {
  const starts = Array.from({length: 200}, (_, i) => i * 7 + 1);
  const width = 360;
  const groups = groupColourMarkers(spans([0, ...starts]), 1500, width);
  for (let i = 1; i < groups.length; i++) {
    const gap = groups[i].at * width - groups[i - 1].at * width;
    assert.ok(gap >= 24 - 1e-9, `markers ${i - 1} and ${i} are ${gap.toFixed(1)} px apart`);
  }
  assert.equal(groups.reduce((n, g) => n + g.count, 0), starts.length, 'every change is in a group');
});

test('changes far enough apart keep their own markers', () => {
  const groups = groupColourMarkers(spans([0, 100, 500, 900]), 1000, 800);
  assert.deepEqual(groups.map(g => g.count), [1, 1, 1]);
});

test('without a measured track nothing is grouped', () => {
  const groups = groupColourMarkers(spans([0, 100, 101]), 1000, 0);
  assert.deepEqual(groups.map(g => g.count), [1, 1]);
});
