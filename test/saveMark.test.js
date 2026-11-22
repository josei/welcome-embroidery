// The header's mark while the design has changes: "Unsaved" only when a project file exists and is out of date.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dirtyMark, saveStatusIcon, saveStatusWords} from '../src/saveMark.js';
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

test('each save state maps to its own glyph: browser-only, saved to file, file out of date', () => {
  const at = new Date(2026, 10, 21, 9, 5).getTime();
  // Browser-only: no file yet, whether or not there are edits.
  assert.equal(saveStatusIcon(false, null, null), 'i-status-autosaved');
  assert.equal(saveStatusIcon(true, null, null), 'i-status-autosaved');
  assert.equal(saveStatusIcon(true, at, null), 'i-status-autosaved');
  // Saved to file and matching it.
  assert.equal(saveStatusIcon(false, at, 'badge.welcome'), 'i-status-saved');
  assert.equal(saveStatusIcon(false, at, null), 'i-status-saved');
  // File out of date: edits since the save to a file.
  assert.equal(saveStatusIcon(true, at, 'badge.welcome'), 'i-status-unsaved');
});

test('the browser-only state and the file states have different words and glyphs', () => {
  const at = new Date(2026, 10, 21, 9, 5).getTime();
  const browserOnly = {icon: saveStatusIcon(true, null, null), label: saveStatusWords(true, null, null, en)};
  const outOfDate = {icon: saveStatusIcon(true, at, 'badge.welcome'), label: saveStatusWords(true, at, 'badge.welcome', en)};
  const saved = {icon: saveStatusIcon(false, at, 'badge.welcome'), label: saveStatusWords(false, at, 'badge.welcome', en)};
  assert.deepEqual(browserOnly, {icon: 'i-status-autosaved', label: 'Autosaved in this browser'});
  assert.deepEqual(outOfDate, {icon: 'i-status-unsaved', label: 'Unsaved'});
  assert.deepEqual(saved, {icon: 'i-status-saved', label: 'Saved 09:05 to badge.welcome'});
  assert.equal(new Set([browserOnly.icon, outOfDate.icon, saved.icon]).size, 3);
});
