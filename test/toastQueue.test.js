import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createToastQueue, toastDuration, TOAST_MAX_MS, TOAST_MIN_MS, TOAST_LOG_LIMIT} from '../src/toastQueue.js';

const trace = 'Traced 19 shapes from the picture, one per colour region, with the stitch settings of your last trace run here';
const appliqué = 'Appliqué: check the 10 mm bar before cutting fabric, then pin the fabric and sew the satin edge';

test('a short confirmation still gets the four second minimum', () => {
  assert.equal(toastDuration('Saved.'), TOAST_MIN_MS);
  assert.equal(toastDuration(''), TOAST_MIN_MS);
});

test('a longer message stays up longer, and the rule is capped', () => {
  assert.ok(toastDuration(trace) > toastDuration('Saved.'));
  assert.ok(toastDuration(appliqué) > toastDuration('Saved.'), 'a long instruction outlasts a short confirmation');
  assert.equal(toastDuration('word '.repeat(500)), TOAST_MAX_MS);
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
  assert.equal(q.visible()[1].action, null);
});

test('a confirmation expires after its duration, not before', () => {
  const q = createToastQueue();
  const id = q.push('Saved.', 'status', 1000);
  assert.deepEqual(q.expire(1000 + TOAST_MIN_MS - 1), []);
  assert.equal(q.visible().length, 1);
  assert.deepEqual(q.expire(1000 + TOAST_MIN_MS), [id]);
  assert.equal(q.visible().length, 0);
});

test('an error stays until it is dismissed, however long that takes', () => {
  const q = createToastQueue();
  const id = q.push('Invalid embroidery file.', 'error', 0);
  assert.deepEqual(q.expire(10 * 60_000), []);
  assert.equal(q.nextExpiry(), null);
  assert.equal(q.visible()[0].kind, 'error');
  q.dismiss(id);
  assert.equal(q.visible().length, 0);
});

test('two toasts fired together both stay on screen and both reach the log', () => {
  const q = createToastQueue();
  q.push('Copy a style first.', 'status', 0);
  q.push('Invalid embroidery file.', 'error', 0);
  assert.deepEqual(q.visible().map(t => t.text), ['Copy a style first.', 'Invalid embroidery file.']);
  assert.deepEqual(q.log().map(t => t.text), ['Invalid embroidery file.', 'Copy a style first.']);
});

test('a hovered toast holds its time, and resumes with what was left', () => {
  const q = createToastQueue();
  const id = q.push('Saved.', 'status', 0);
  q.pause(id, 1000); // 1 s in, 3 s left
  assert.equal(q.nextExpiry(), null);
  assert.deepEqual(q.expire(60_000), []);
  q.resume(id, 60_000);
  assert.equal(q.nextExpiry(), 60_000 + 3000);
  assert.deepEqual(q.expire(60_000 + 3000), [id]);
});

test('overlapping holds from hover and focus release only when both end', () => {
  const q = createToastQueue();
  const id = q.push('Saved.', 'status', 0);
  q.pause(id, 500);
  q.pause(id, 800);
  q.resume(id, 2000);
  assert.equal(q.nextExpiry(), null, 'still held by the other reason');
  q.resume(id, 2500);
  assert.equal(q.nextExpiry(), 2500 + 3500);
});

test('the stack drops the oldest confirmation from view, never an error', () => {
  const q = createToastQueue({visibleLimit: 2});
  q.push('one', 'status', 0);
  q.push('Bad file.', 'error', 0);
  q.push('two', 'status', 0);
  assert.deepEqual(q.visible().map(t => t.text), ['Bad file.', 'two']);
  assert.deepEqual(q.log().map(t => t.text), ['two', 'Bad file.', 'one'], 'the dropped confirmation stays in the log');
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

test('a repeat of a message already on screen replaces it instead of stacking', () => {
  const q = createToastQueue();
  const limit = 'This would go over the 100-object limit.';
  q.push(limit, 'status', 0);
  q.push(limit, 'status', 100);
  q.push(limit, 'status', 200);
  assert.deepEqual(q.visible().map(t => t.text), [limit]);
  q.push('Saved.', 'status', 300);
  q.push(limit, 'status', 400);
  assert.deepEqual(q.visible().map(t => t.text), ['Saved.', limit]);
  assert.equal(q.log().length, 5, 'every message still reaches the log');
});
