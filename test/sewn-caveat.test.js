import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SENTENCE = 'Nothing here has been sewn on a real machine yet.';
const SPANISH = 'Nada de esto se ha bordado todavía en una máquina real.';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('landing page carries the sewn-on-a-real-machine sentence near the sewing claims', () => {
  const html = read('site/index.html');
  assert.ok(html.includes(SENTENCE), 'English sentence is in site/index.html');
  const headline = html.indexOf('before you sew it.</em></h2>');
  assert.ok(headline > 0 && html.indexOf(SENTENCE) > headline, 'sentence follows the sewing headline');
});

test('landing page Spanish copy carries the sentence', () => {
  const js = read('site/i18n.js');
  assert.ok(js.includes(`"n4": "${SPANISH}"`), 'es-ES entry in site/i18n.js');
  assert.ok(js.includes(`"n4": "${SENTENCE}"`), 'en entry in site/i18n.js');
});

test('export dialog shows its one-line notice and translates it to Spanish', () => {
  const tsx = read('src/components/EditorOverlays.tsx');
  assert.ok(tsx.includes(`{"Export does not save your project. Not yet sewn."}`), 'export dialog renders the notice');
  const i18n = read('src/i18n.js');
  assert.ok(i18n.includes(`'Export does not save your project. Not yet sewn.':'Exportar no guarda tu proyecto. Aún sin bordar.'`), 'es-ES dialog translation in src/i18n.js');
});
