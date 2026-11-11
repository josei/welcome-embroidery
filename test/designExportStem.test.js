import {execFileSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {designExportStem, safeProjectFilename} from '../src/appHelpers.js';

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

// The UI language is fixed when i18n loads, so the Spanish case runs in its own process.
test('in Spanish, an unnamed design still exports as its lettering, and an empty one as the translated default', () => {
  const script = `
    globalThis.location = {search: '?lang=es'};
    const {designExportStem, safeProjectFilename} = await import(${JSON.stringify(new URL('../src/appHelpers.js', import.meta.url).href)});
    const named = designExportStem({name: 'Untitled design', objects: [{kind: 'text', text: 'WE'}]});
    const empty = designExportStem({name: 'Untitled design', objects: []});
    const kept = designExportStem({name: 'Spring wreath', objects: [{kind: 'text', text: 'WE'}]});
    const save = safeProjectFilename('Untitled design');
    console.log(JSON.stringify([named, empty, kept, save]));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {encoding: 'utf8'});
  assert.deepEqual(JSON.parse(out), ['WE', 'Diseño sin título', 'Spring wreath', 'Diseño sin título.welcome']);
});
