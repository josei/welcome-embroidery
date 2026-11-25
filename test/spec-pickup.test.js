import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import config from '../playwright.config.js';

// Every *.spec.js in test/ must be matched by the Playwright config and not
// excluded by it, so that a spec can't be silently skipped.
const testDir = dirname(fileURLToPath(import.meta.url));
const specs = readdirSync(testDir).filter((f) => f.endsWith('.spec.js'));

const asList = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const hits = (patterns, name) => patterns.some((p) =>
  p instanceof RegExp ? p.test(name) : p === name);

function picked(name) {
  return hits(asList(config.testMatch), name) && !hits(asList(config.testIgnore), name);
}

test('every test/*.spec.js is picked up by playwright.config.js', () => {
  assert.ok(specs.length > 0, 'expected spec files in test/');
  const missed = specs.filter((f) => !picked(f));
  assert.deepEqual(missed, [], `specs not run by the Playwright config: ${missed.join(', ')}`);
});
