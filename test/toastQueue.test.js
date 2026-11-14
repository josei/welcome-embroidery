import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createToastQueue, TOAST_MS, TOAST_LOG_LIMIT} from '../src/toastQueue.js';

test('a confirmation clears itself after three seconds, not before', () => {
  const q = createToastQueue();
  const id = q.push('Rectangle added, 24 × 16 mm', 'status', 1000);
  assert.deepEqual(q.expire(1000 + TOAST_MS - 1), []);
  assert.equal(q.visible().length, 1);
  assert.deepEqual(q.expire(1000 + TOAST_MS), [id]);
  assert.equal(q.visible().length, 0);
});

test('a toast can carry an action button, and the log keeps only the text', () => {
  const q = createToastQueue();
  let ran = 0;
  const id = q.push('Deleted Rectangle.', 'status', 0, {label: 'Undo', run: () => { ran++; }});
  assert.equal(q.visible()[0].action.label, 'Undo');
  q.visible()[0].action.run();
  assert.equal(ran, 1);
  assert.equal(q.log()[0].id, id);
  assert.equal('action' in q.log()[0], false);
  assert.equal(q.push('Saved.', 'status', 0) > id, true);
  assert.equal(q.visible().at(-1).action, null);
});

test('an error stays until it is dismissed, however long that takes', () => {
  const q = createToastQueue();
  const id = q.push('Invalid embroidery file.', 'error', 0);
  assert.deepEqual(q.expire(10 * 60_000), []);
  assert.equal(q.nextExpiry(), null);
  assert.equal(q.visible()[0].kind, 'error');
  q.push('Invalid embroidery file.', 'error', 1000);
  assert.equal(q.visible().length, 1, 'the same error is not shown twice');
  q.dismiss(q.visible()[0].id);
  assert.equal(q.visible().length, 0);
});

test('a confirmation and an error both stay on screen and both reach the log', () => {
  const q = createToastQueue();
  q.push('Copy a style first.', 'status', 0);
  q.push('Invalid embroidery file.', 'error', 0);
  assert.deepEqual(q.visible().map(t => t.text), ['Copy a style first.', 'Invalid embroidery file.']);
  assert.deepEqual(q.log().map(t => t.text), ['Invalid embroidery file.', 'Copy a style first.']);
});

test('a hovered toast holds its time, and resumes with what was left', () => {
  const q = createToastQueue();
  const id = q.push('Saved.', 'status', 0);
  q.pause(id, 1000); // 1 s in, 2 s left
  assert.equal(q.nextExpiry(), null);
  assert.deepEqual(q.expire(60_000), []);
  q.resume(id, 60_000);
  assert.equal(q.nextExpiry(), 60_000 + 2000);
  assert.deepEqual(q.expire(60_000 + 2000), [id]);
});

test('overlapping holds from hover and focus release only when both end', () => {
  const q = createToastQueue();
  const id = q.push('Saved.', 'status', 0);
  q.pause(id, 500);
  q.pause(id, 800);
  q.resume(id, 2000);
  assert.equal(q.nextExpiry(), null, 'still held by the other reason');
  q.resume(id, 2500);
  assert.equal(q.nextExpiry(), 2500 + TOAST_MS - 500);
});

test('a second confirmation replaces the one on screen, and an error is never replaced', () => {
  const q = createToastQueue();
  q.push('one', 'status', 0);
  q.push('Bad file.', 'error', 0);
  q.push('two', 'status', 0);
  assert.deepEqual(q.visible().map(t => t.text), ['Bad file.', 'two']);
  assert.deepEqual(q.log().map(t => t.text), ['two', 'Bad file.', 'one'], 'the replaced confirmation stays in the log');
});

test('the log keeps the last twenty messages, newest first', () => {
  const q = createToastQueue();
  for (let i = 1; i <= TOAST_LOG_LIMIT + 5; i++) q.push(`message ${i}`, 'status', i);
  const log = q.log();
  assert.equal(log.length, TOAST_LOG_LIMIT);
  assert.equal(log[0].text, `message ${TOAST_LOG_LIMIT + 5}`);
  assert.equal(log.at(-1).text, 'message 6');
  assert.equal(log[0].at, TOAST_LOG_LIMIT + 5);
});

test('every confirmation replaces the one before it, and every message reaches the log', () => {
  const q = createToastQueue();
  const limit = 'This would go over the 100-object limit.';
  q.push(limit, 'status', 0);
  q.push('Saved.', 'status', 100);
  q.push(limit, 'status', 200);
  assert.deepEqual(q.visible().map(t => t.text), [limit]);
  assert.equal(q.log().length, 3);
});

test('two tool hints in sequence leave only the newer one on screen', () => {
  const q = createToastQueue();
  q.push('Click to add points. Click the first point to close a polygon.', 'status', 0, null, true);
  q.push('Drag on the canvas to draw a line.', 'status', 100, null, true);
  assert.deepEqual(q.visible().map(t => t.text), ['Drag on the canvas to draw a line.']);
  assert.equal(q.log().length, 2, 'the replaced hint still reaches the log');
});

test('a tool hint replaces the confirmation on screen but not an error', () => {
  const q = createToastQueue();
  q.push('Saved.', 'status', 0);
  q.push('Invalid embroidery file.', 'error', 0);
  q.push('Drag on the canvas to draw a line.', 'status', 0, null, true);
  assert.deepEqual(q.visible().map(t => t.text), ['Invalid embroidery file.', 'Drag on the canvas to draw a line.']);
});

test('clearing the tool hint leaves nothing behind when it was the only toast', () => {
  const q = createToastQueue();
  q.push('Drag on the canvas to draw a line.', 'status', 0, null, true);
  q.clearHints();
  assert.equal(q.visible().length, 0);
  assert.equal(q.nextExpiry(), null);
});
