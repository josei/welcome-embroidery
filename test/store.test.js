import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/store.js';
import {viewMode} from '../src/viewMode.js';

test('a store keeps its value and tells listeners about changes, and stops after unsubscribe', () => {
 const store = createStore('design');
 const seen = [];
 const off = store.subscribe(() => seen.push(store.get()));
 store.set('stitches');
 store.set('stitches');
 store.set('preview');
 off();
 store.set('design');
 assert.equal(store.get(), 'design');
 assert.deepEqual(seen, ['stitches', 'preview']);
});

test('the view mode starts on Design', () => {
 assert.equal(viewMode.get(), 'design');
});
