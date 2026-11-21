// The header's mark while the design has changes: "Unsaved" only when a project file exists and is out of date.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dirtyMark, saveStatusWords} from '../src/saveMark.js';
import {ES} from '../src/i18n.js';

const fill = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const en = (text, vars) => fill(text, vars);
const es = (text, vars) => fill(ES[text] ?? text, vars);

test('edits with no project file yet read as autosaved, not unsaved', () => {
  assert.deepEqual(dirtyMark(null, en), {text: 'Autosaved in this browser', unsaved: false});
  assert.deepEqual(dirtyMark(undefined, en), {text: 'Autosaved in this browser', unsaved: false});
});

test('edits after a save to a file read as unsaved', () => {
  assert.deepEqual(dirtyMark('badge.welcome', en), {text: 'Unsaved', unsaved: true});
});

test('the autosaved label has a Spanish translation', () => {
  assert.equal(dirtyMark(null, es).text, 'Autoguardado en este navegador');
  assert.equal(dirtyMark('badge.welcome', es).text, 'Sin guardar');
});

test('the save status words: dirty, saved to a file, saved in this tab, autosaved', () => {
  const at = new Date(2026, 10, 21, 9, 5).getTime();
  assert.equal(saveStatusWords(true, at, 'badge.welcome', en), 'Unsaved');
  assert.equal(saveStatusWords(true, null, null, en), 'Autosaved in this browser');
  assert.equal(saveStatusWords(false, at, 'badge.welcome', en), 'Saved 09:05 to badge.welcome');
  assert.equal(saveStatusWords(false, at, null, en), 'Saved 09:05');
  assert.equal(saveStatusWords(false, null, null, en), 'Autosaved in this browser');
});

test('the save status words have Spanish translations', () => {
  const at = new Date(2026, 10, 21, 9, 5).getTime();
  assert.equal(saveStatusWords(true, at, 'badge.welcome', es), 'Sin guardar');
  assert.equal(saveStatusWords(true, null, null, es), 'Autoguardado en este navegador');
  assert.equal(saveStatusWords(false, at, 'badge.welcome', es), 'Guardado 09:05 en badge.welcome');
});
