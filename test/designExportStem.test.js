import test from 'node:test';
import assert from 'node:assert/strict';
import {designExportStem} from '../src/appHelpers.js';

const text = (text) => ({kind: 'text', text});

test('a design whose only lettering is WE exports as WE', () => {
  assert.equal(designExportStem({name: 'Untitled design', objects: [text('WE')]}), 'WE');
});

test('the default follows the lettering as it changes, and clears back to Untitled design', () => {
  assert.equal(designExportStem({name: 'Untitled design', objects: [text('Anna')]}), 'Anna');
  assert.equal(designExportStem({name: 'Untitled design', objects: []}), 'Untitled design');
});

test('a name the user gave the document is kept over the lettering', () => {
  assert.equal(designExportStem({name: 'Spring wreath', objects: [text('WE')]}), 'Spring wreath');
});

test('whitespace in lettering is collapsed and unsafe characters are replaced', () => {
  assert.equal(designExportStem({name: 'Untitled design', objects: [text('  Hi   there  '), text('a/b')]}), 'Hi there a_b');
});
