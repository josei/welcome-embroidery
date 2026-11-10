// The restore prompt's line: matching copies say so, unsaved copies give the age, and a known file name is shown.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restorePromptInfo} from '../src/restoreInfo.js';
import {ES} from '../src/i18n.js';

// English fill-in, the same way the UI fills its {name} placeholders.
const en = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
const copy = {name: 'Botanical badge', objects: 6, minutes: 3};

test('a copy that matches the saved file says so, and names the file', () => {
  assert.equal(restorePromptInfo({...copy, clean: true, savedFileName: 'badge.welcome'}, en),
    '"Botanical badge", 6 objects. Matches saved file "badge.welcome".');
});

test('a matching copy with no known file name still says it matches', () => {
  assert.equal(restorePromptInfo({...copy, clean: true, savedFileName: null}, en),
    '"Botanical badge", 6 objects. Matches saved file.');
});

test('a differing copy with no file says it is autosaved in this browser, not unsaved', () => {
  assert.equal(restorePromptInfo({...copy, clean: false, savedFileName: null}, en),
    '"Botanical badge", 6 objects. Autosaved in this browser, 3 min ago.');
});

test('a differing copy also shows the saved file name when one is known', () => {
  assert.equal(restorePromptInfo({...copy, clean: false, savedFileName: 'badge.welcome'}, en),
    '"Botanical badge", 6 objects. Unsaved changes, 3 min ago. Saved file: "badge.welcome".');
});

test('a single object is counted in the singular', () => {
  const one = {...copy, objects: 1, clean: false};
  const singular = (text, values) => (text === '1 object' ? '1 object' : en(text, values));
  assert.match(restorePromptInfo(one, singular), /^"Botanical badge", 1 object\. Autosaved in this browser, 3 min ago\.$/);
});

test('every English prompt line has a Spanish translation', () => {
  const lines = [
    restorePromptInfo({...copy, clean: true, savedFileName: 'a.welcome'}, en),
    restorePromptInfo({...copy, clean: true, savedFileName: null}, en),
    restorePromptInfo({...copy, clean: false, savedFileName: 'a.welcome'}, en),
    restorePromptInfo({...copy, clean: false, savedFileName: null}, en),
  ];
  const templates = [
    '"{name}", {objects}. Matches saved file "{file}".',
    '"{name}", {objects}. Matches saved file.',
    '"{name}", {objects}. Unsaved changes, {m} min ago. Saved file: "{file}".',
    '"{name}", {objects}. Autosaved in this browser, {m} min ago.',
  ];
  assert.equal(lines.length, templates.length);
  for (const template of templates) assert.ok(ES[template], `missing Spanish for: ${template}`);
});
