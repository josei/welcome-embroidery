import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDocument} from '../src/document.js';
import {exportStem} from '../src/appHelpers.js';

test('the starter design is not named after the sample, so exports do not inherit its name', () => {
  assert.notEqual(initialDocument().name, 'Botanical badge');
  assert.equal(exportStem(initialDocument().name), 'Untitled design');
});

test('a document renamed by the user exports under its own name', () => {
  assert.equal(exportStem('Spring wreath'), 'Spring wreath');
});
