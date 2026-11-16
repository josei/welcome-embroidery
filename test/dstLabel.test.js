import test from 'node:test';
import assert from 'node:assert/strict';
import {designLabel} from '../src/appHelpers.js';
import {encode} from '../src/encoders.js';
import {compile} from '../src/engine.js';
import {initialDocument} from '../src/engine.js';

test('an untitled design labelled with its lettering shows that lettering', () => {
  assert.equal(designLabel({name: 'Untitled design', objects: [{kind: 'text', text: 'WE'}]}), 'WE');
});

test('a design the user named keeps that name', () => {
  assert.equal(designLabel({name: 'Spring wreath', objects: [{kind: 'text', text: 'WE'}]}), 'Spring wreath');
});

test('accents are folded so the label stays printable ASCII', () => {
  assert.equal(designLabel({name: 'Diseño sin título', objects: []}), 'Diseno sin titulo');
});

test('the DST header carries the label passed by the export, or the document name without one', () => {
  const doc = initialDocument();
  doc.objects = doc.objects.filter(o => o.kind !== 'text');
  const plan = compile(doc);
  const header = (label) => new TextDecoder('ascii').decode(encode(plan, 'dst', '#527461', 110, doc, label).slice(0, 512));
  assert.ok(header('WE').startsWith('LA:WE '), header('WE').slice(0, 20));
  assert.ok(header(undefined).startsWith('LA:Untitled design'), header(undefined).slice(0, 20));
});
