import test from 'node:test';
import assert from 'node:assert/strict';
import {addLabel} from '../src/addLabel.js';
import {ES} from '../src/i18n.js';

test('each add step is named after the object as its layer row shows it', () => {
  assert.equal(addLabel({name: 'Rectangle'}), 'add Rectangle');
  assert.equal(addLabel({name: 'Ellipse'}), 'add Ellipse');
  assert.equal(addLabel({name: 'Polygon 5'}), 'add Polygon 5');
  assert.equal(addLabel({name: 'Star 6'}), 'add Star 6');
  assert.equal(addLabel({name: 'Drawn path'}), 'add Drawn path');
  assert.equal(addLabel({name: 'Line'}), 'add Line');
  assert.equal(addLabel({kind: 'text'}), 'add text');
});

test('an unnamed object falls back to its kind', () => {
  assert.equal(addLabel({name: '  ', kind: 'rect'}), 'add rect');
});

test('the add step has a Spanish translation for each name it can show', () => {
  assert.equal(ES['add {name}'], 'añadir {name}');
  assert.equal(ES['text'], 'texto');
  assert.equal(ES['Rectangle'], 'Rectángulo');
  assert.equal(ES['Ellipse'], 'Elipse');
  assert.equal(ES['Polygon'], 'Polígono');
  assert.equal(ES['Drawn path'], 'Trazado dibujado');
  assert.equal(ES['Line'], 'Línea');
});
