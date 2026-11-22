import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeAddDisabled} from '../src/nodeAddRule.js';

test('Add node is enabled only on a path while node editing is on', () => {
  assert.equal(nodeAddDisabled('path', true), false);
  assert.equal(nodeAddDisabled('path', false), true);
  assert.equal(nodeAddDisabled('rect', true), true);
  assert.equal(nodeAddDisabled(undefined, true), true);
});
