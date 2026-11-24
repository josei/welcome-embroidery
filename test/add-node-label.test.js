import test from 'node:test';
import assert from 'node:assert/strict';
import {ES} from '../src/i18n.js';

test('the add-node undo step is named "Add node" in English and "Añadir nodo" in Spanish', () => {
  assert.equal(ES['Add node'], 'Añadir nodo');
});
