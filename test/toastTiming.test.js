import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toastActions, toastState} from '../src/toastState.js';

const shown = () => toastState.get().visible.map(entry => entry.text);

test('a second confirmation replaces the first, and the toast clears itself after three seconds', t => {
  t.mock.timers.enable({apis: ['setTimeout', 'Date']});
  toastActions.push('Rectangle added, 24 × 16 mm');
  toastActions.push('Ellipse added, 24 × 16 mm');
  assert.deepEqual(shown(), ['Ellipse added, 24 × 16 mm'], 'only the newer confirmation is on screen');
  t.mock.timers.tick(2999);
  assert.deepEqual(shown(), ['Ellipse added, 24 × 16 mm'], 'still up just before three seconds');
  t.mock.timers.tick(1);
  assert.deepEqual(shown(), [], 'gone after three seconds');
});
