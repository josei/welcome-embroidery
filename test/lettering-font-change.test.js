import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBundledFonts} from '../server-fonts.js';
import {getFont} from '../src/fonts.js';
import {applyOperations, initialDocument, objectBounds, measureText, fontChangeOps, validateDocument} from '../src/engine.js';
import {storedText} from '../src/fontHelpers.js';
import {textLines} from '../src/lettering.js';

const FONT_ROOT = new URL('..', import.meta.url).pathname;
loadBundledFonts(FONT_ROOT);

const ALLEGRIA = 'inkstitch/allegria55';
const MONO = 'welcome-mono/1';
const HOOP = {w: 110, h: 110};

function doc(font, extra = {}) {
  const d = initialDocument();
  d.hoop = HOOP.w;
  d.objects = [];
  applyOperations(d, [{op: 'add_text', id: 't', text: 'Hola', x: -20, y: 0, font, height: 8, thread: '#527461', ...extra}]);
  return d;
}

// Applies a font change the way the editor does: one command made of the operations fontChangeOps returns.
function switchFont(d, fid, hoop = HOOP) {
  applyOperations(d, fontChangeOps(d.objects[0], fid, hoop));
  return d.objects[0];
}

test('Welcome Mono keeps the casing typed and still draws capitals', () => {
  const d = doc(MONO);
  assert.equal(d.objects[0].text, 'Hola');
  assert.equal(d.objects[0].name, 'Text "Hola"');
  const typed = textLines({...d.objects[0]});
  const capitals = textLines({...d.objects[0], text: 'HOLA'});
  assert.deepEqual(typed, capitals, 'Welcome Mono draws its capitals from the typed letters');
});

test('typed casing survives a switch to a font with lower case', () => {
  const d = doc(MONO);
  const o = switchFont(d, ALLEGRIA);
  assert.equal(getFont(ALLEGRIA).letterCase ?? '', '', 'Allegria 55 is not forced to one case');
  assert.equal(o.font, ALLEGRIA);
  assert.equal(o.text, 'Hola');
  assert.equal(o.name, 'Text "Hola"');
});

test('typed casing survives a switch back to Welcome Mono', () => {
  const d = doc(ALLEGRIA);
  const o = switchFont(d, MONO);
  assert.equal(o.font, MONO);
  assert.equal(o.text, 'Hola');
});

test('the height in millimetres is kept when the font changes', () => {
  const d = doc(MONO);
  const o = switchFont(d, ALLEGRIA);
  assert.equal(o.h, 8, 'Allegria keeps the 8 mm height, not its 36 mm design size');
  const back = switchFont(d, MONO);
  assert.equal(back.h, 8);
});

test('a kept height is a valid document in the new font', () => {
  const d = doc(MONO);
  switchFont(d, ALLEGRIA);
  assert.doesNotThrow(() => validateDocument(d));
  switchFont(d, 'neon-blinking/1');
  assert.doesNotThrow(() => validateDocument(d));
});

test('a height outside Welcome Mono range is brought into that range', () => {
  const d = doc(ALLEGRIA, {height: 30});
  const o = switchFont(d, MONO);
  assert.equal(o.h, 16, 'Welcome Mono is at most 16 mm tall');
});

test('lettering that would leave the hoop is scaled down and moved inside it', () => {
  const d = doc(MONO, {text: 'A VERY LONG TEXT', height: 8, x: 40, y: 20});
  const o = switchFont(d, ALLEGRIA, {w: 60, h: 60});
  const [x0, y0, x1, y1] = objectBounds(o);
  assert.ok(o.h < 8, 'the height is reduced to fit the width');
  assert.ok(x0 >= -30 && x1 <= 30, `inside the hoop horizontally: ${x0} ${x1}`);
  assert.ok(y0 >= -30 && y1 <= 30, `inside the hoop vertically: ${y0} ${y1}`);
});

test('Néon blinking switches in and out keeping its 20-60 mm range', () => {
  const d = doc(MONO);
  const o = switchFont(d, 'neon-blinking/1');
  assert.equal(o.font, 'neon-blinking/1');
  assert.equal(o.h, 20, 'Néon blinking is at least 20 mm tall');
  assert.equal(o.text, 'Hola');
});

test('storedText keeps casing for every font and flattens lines only for the single-line font', () => {
  assert.equal(storedText(MONO, 'Hola\nAmigo'), 'Hola Amigo');
  assert.equal(storedText(MONO, 'x'.repeat(30)).length, 24);
  assert.equal(storedText(ALLEGRIA, 'Hola\nAmigo'), 'Hola\nAmigo');
  assert.equal(measureText('Hola', MONO, 8), 4 * 8 * 0.72);
});
