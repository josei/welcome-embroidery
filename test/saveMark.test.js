// The header's mark while the design has changes: "Unsaved" only when a project file exists and is out of date.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dirtyMark} from '../src/saveMark.js';
import {ES} from '../src/i18n.js';

const en = text => text;
const es = text => ES[text] ?? text;

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
