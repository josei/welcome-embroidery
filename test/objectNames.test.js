import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyName, letteringLayerName, letteringName} from '../src/objectNames.js';
import {initialDocument,applyOperations} from '../src/engine.js';

test('copies are numbered from the base name, not stacked as "copy copy"', () => {
  assert.equal(copyName('Rectangle', 'rect', ['Rectangle']), 'Rectangle 2');
  assert.equal(copyName('Rectangle 2', 'rect', ['Rectangle', 'Rectangle 2']), 'Rectangle 3');
  assert.equal(copyName('Rectangle copy copy', 'rect', ['Rectangle']), 'Rectangle 2');
  assert.equal(copyName('', 'rect', []), 'rect 2');
  assert.equal(copyName(undefined, 'ellipse', []), 'ellipse 2');
  assert.equal(copyName('Rectangle 2', 'rect', ['Rectangle 2', 'Rectangle 3']), 'Rectangle 4');
});

test('copy, paste and duplicate in a row never repeat a name', () => {
  const doc = initialDocument();
  doc.objects = [];
  applyOperations(doc, [{op: 'add_shape', id: 'box', kind: 'rect', x: 0, y: 0, width: 10, height: 8, thread: '#527461'}]);
  const names = () => doc.objects.map(o => o.name);
  const first = doc.objects[0].name;
  applyOperations(doc, [{op: 'duplicate', id: 'box', newId: 'c1', dx: 3, dy: 3}]);
  applyOperations(doc, [{op: 'duplicate', id: 'c1', newId: 'c2', dx: 3, dy: 3}]);
  applyOperations(doc, [{op: 'duplicate', id: 'box', newId: 'c3', dx: 3, dy: 3}]);
  assert.equal(new Set(names()).size, names().length, `repeated names: ${names()}`);
  assert.notEqual(first, undefined);
  assert.deepEqual(names().slice(1), [`${first} 2`, `${first} 3`, `${first} 4`]);
});

test('lettering is named its type, then its first line of text in quotes', () => {
  assert.equal(letteringName('Hola'), 'Text "Hola"');
  assert.equal(letteringName('Hola\nsegunda'), 'Text "Hola"');
  assert.equal(letteringName(''), 'Text');
  assert.equal(letteringName(undefined), 'Text');
});

test('the starter lettering is named by the same rule as new lettering', () => {
  const starter = initialDocument().objects.find(o => o.kind === 'text');
  assert.equal(starter.name, letteringName(starter.text));
  assert.equal(starter.name, 'Text "Bloom"');
});

test('typed text renames lettering only while its name is still the automatic one', () => {
  const doc = initialDocument();
  doc.objects = [];
  applyOperations(doc, [{op: 'add_text', id: 't', text: 'Text', name: 'Text', x: 0, y: 0, height: 10}]);
  assert.equal(doc.objects[0].name, 'Text');
  applyOperations(doc, [{op: 'set_object', id: 't', text: 'Hola'}]);
  assert.equal(doc.objects[0].name, 'Text "Hola"');
  applyOperations(doc, [{op: 'set_object', id: 't', text: 'Adiós'}]);
  assert.equal(doc.objects[0].name, 'Text "Adiós"');
  applyOperations(doc, [{op: 'set_object', id: 't', name: 'Greeting'}]);
  applyOperations(doc, [{op: 'set_object', id: 't', text: 'Buenas'}]);
  assert.equal(doc.objects[0].name, 'Greeting', 'a name typed in Layers survives a text change');
});

test('in English, lettering rows show the name as stored', () => {
  assert.equal(letteringLayerName('Text'), 'Text');
  assert.equal(letteringLayerName('Text "Hola"'), 'Text "Hola"');
  assert.equal(letteringLayerName('Greeting'), 'Greeting');
});

// The UI language is fixed when i18n loads, so the Spanish case runs in its own process.
test('in Spanish, lettering rows show Texto "Hola" while the stored name stays English', () => {
  const script = `
    globalThis.location = {search: '?lang=es'};
    const {letteringLayerName, letteringName} = await import(${JSON.stringify(new URL('../src/objectNames.js', import.meta.url).href)});
    console.log(JSON.stringify([letteringName('Hola'), letteringLayerName(letteringName('Hola')), letteringLayerName('Text'), letteringLayerName('Greeting')]));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {encoding: 'utf8'});
  assert.deepEqual(JSON.parse(out), ['Text "Hola"', 'Texto "Hola"', 'Texto', 'Greeting']);
});
