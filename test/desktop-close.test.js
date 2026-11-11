import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/store.js';

// The close guard reads window.__TAURI_INTERNALS__ at mount time, so the mock bridge is set per test.
const calls = [];
const bridge = {__TAURI_INTERNALS__: {invoke: (cmd, args) => { calls.push([cmd, args]); return Promise.resolve(); }}};
globalThis.window = bridge;
const {mountDesktopClose} = await import('../src/desktopClose.js');

// The app passes its document store (documentState.ts) in; the test uses a store with the same dirty-flag shape.
const doc = createStore({dirty: false});
const setDirty = (dirty) => doc.set({...doc.get(), dirty});

test('without a Tauri bridge the desktop close guard mounts nothing', () => {
 globalThis.window = {};
 try {
  mountDesktopClose(() => assert.fail('flush must not run in the browser'), doc);
  assert.equal(globalThis.window.__welcomeAnswerClose, undefined);
  assert.equal(globalThis.window.__welcomeConfirmClose, undefined);
 } finally {
  globalThis.window = bridge;
 }
});

test('the shell hears the dirty flag: true after an edit, false once clean', () => {
 calls.length = 0;
 let flushes = 0;
 mountDesktopClose(() => flushes++, doc);
 setDirty(true);
 setDirty(false);
 assert.deepEqual(calls, [
  ['set_unsaved', {unsaved: false}],
  ['set_unsaved', {unsaved: true}],
  ['set_unsaved', {unsaved: false}],
 ]);
 assert.equal(flushes, 0);
});

test('Discard flushes the autosave copy before the shell closes', () => {
 calls.length = 0;
 const order = [];
 mountDesktopClose(() => order.push('flush'), doc);
 const realInvoke = bridge.__TAURI_INTERNALS__.invoke;
 bridge.__TAURI_INTERNALS__.invoke = (cmd, args) => { order.push(cmd); return realInvoke(cmd, args); };
 window.__welcomeAnswerClose(true);
 bridge.__TAURI_INTERNALS__.invoke = realInvoke;
 assert.deepEqual(order, ['flush', 'close_decision']);
 assert.deepEqual(calls.at(-1), ['close_decision', {discard: true}]);
});

test('Cancel does not flush and tells the shell to keep everything open', () => {
 calls.length = 0;
 let flushes = 0;
 mountDesktopClose(() => flushes++, doc);
 window.__welcomeAnswerClose(false);
 assert.equal(flushes, 0);
 assert.deepEqual(calls.at(-1), ['close_decision', {discard: false}]);
});
