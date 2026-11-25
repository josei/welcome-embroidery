import test from 'node:test';
import assert from 'node:assert/strict';
import {hoopSizeText} from '../src/decimalText.js';

// src/i18n.js picks its language once, at import time, from the page's ?lang= or localStorage. A fresh module per
// language (a different import URL) keeps the two locales apart in one process.
globalThis.localStorage = {getItem: key => (key === 'welcome.lang' ? globalThis.__testLang ?? null : null), setItem() {}};
async function translatorFor(language) {
 globalThis.__testLang = language;
 const mod = await import(`../src/i18n.js?lang=${language}`);
 return mod.t;
}

test('Spanish puts a comma in a decimal {w}, {h} or {n} value', async () => {
 const t = await translatorFor('es');
 assert.equal(t('{l} reaches outside the {w}×{h} mm hoop.', {l: 'Flor', w: '267.4', h: '200'}), 'Flor sale del bastidor de 267,4×200 mm.');
 assert.equal(t('{l} reaches outside the {w}×{h} mm hoop.', {l: 'Flor', w: 267.4, h: 200}), 'Flor sale del bastidor de 267,4×200 mm.');
});

test('Spanish puts a comma in a decimal {n} inside a translated sentence', async () => {
 const t = await translatorFor('es');
 assert.equal(t('Wildflower extends 86.5 mm past the hoop. Move it or choose a larger hoop.'),
   'Flor silvestre sobrepasa el bastidor en 86,5 mm. Muévelo o elige un bastidor más grande.');
});

test('Spanish leaves whole numbers as they are', async () => {
 const t = await translatorFor('es');
 assert.equal(t('{l} reaches outside the {w}×{h} mm hoop.', {l: 'Flor', w: 200, h: 110}), 'Flor sale del bastidor de 200×110 mm.');
});

test('English keeps the dot in every placeholder', async () => {
 const t = await translatorFor('en');
 assert.equal(t('{l} reaches outside the {w}×{h} mm hoop.', {l: 'Flower', w: '267.4', h: '200'}), 'Flower reaches outside the 267.4×200 mm hoop.');
 assert.equal(t('Wildflower extends 86.5 mm past the hoop. Move it or choose a larger hoop.'),
   'Wildflower extends 86.5 mm past the hoop. Move it or choose a larger hoop.');
});

test('the hoop size reads with the comma in Spanish and the dot in English', () => {
 assert.equal(hoopSizeText([267.4, 200], 'es'), '267,4×200');
 assert.equal(hoopSizeText([267.4, 200], 'en'), '267.4×200');
 assert.equal(hoopSizeText([110, 110], 'es'), '110×110');
});
