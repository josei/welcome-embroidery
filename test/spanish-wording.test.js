import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {ES} from '../src/i18n.js';
import {modifierName, shortcutLabel} from '../src/shortcutLabels.js';

// The Spanish words for the snap toggles and the zoom commands are different words, so one word never means two commands.
const SNAP_KEYS = ['Snap', 'Snap to objects', 'Snap to grid', 'Snap to other objects', 'Snap to other objects (nodes, midpoints, edges, centers)',
  'Snapping to other objects on.', 'Snapping to other objects off.', 'Grid spacing: the distance Snap to grid snaps to'];
const FIT_KEYS = ['Fit hoop', 'Fit everything ({shortcut})', 'Fit the hoop', 'Fit the hoop in view', 'Fit hoop in view', 'Fit everything', 'Fit to hoop'];

test('Spanish snap commands do not use the fit word Ajustar', () => {
  for (const key of SNAP_KEYS) assert.ok(key in ES, `${key} has no Spanish text`);
  const shared = SNAP_KEYS.filter(key => /ajust/i.test(ES[key]));
  assert.deepEqual(shared, [], 'snap labels that use Ajustar, which is the zoom word');
});

test('Spanish zoom commands keep Ajustar for fitting the view', () => {
  for (const key of FIT_KEYS) assert.match(ES[key], /Ajustar/, key);
});

test('the Spanish width and height fields read An and Al, not W and H', () => {
  assert.equal(ES.W, 'An');
  assert.equal(ES.H, 'Al');
});

test('Spanish labels for the View menu and zoom bar contain no English words', () => {
  const keys = [...SNAP_KEYS, ...FIT_KEYS, 'All', 'Grid', 'Underlay', 'Default underlay', 'Color change to {n} at {time}'];
  const english = /\b(underlay|snap|snapping|fit|home|end|enter|backspace|all|hoop)\b/i;
  const found = keys.filter(key => key in ES && english.test(ES[key])).map(key => `${key} -> ${ES[key]}`);
  assert.deepEqual(found, [], 'Spanish text that still has English words');
});

test('the underlay label is the desktop word Base, not Base (underlay)', () => {
  assert.equal(ES.Underlay, 'Base');
  assert.equal(ES['Default underlay'], 'Base predeterminada');
});

test('a colour-change marker reads "at" a time without the article a los', () => {
  assert.equal(ES['Color change to {n} at {time}'], 'Cambio de color a {n} en {time}');
});

test('the Spanish shortcut sheet writes decimals with a comma', () => {
  assert.equal(ES['Nudge ({shift} = 5 mm, {alt} = 0.1 mm)'], 'Mover ({shift} = 5 mm, {alt} = 0,1 mm)');
});

test('the Spanish shortcut sheet names Home, End, Enter, Backspace and Delete as the desktop does', () => {
  assert.equal(ES.Home, 'Inicio');
  assert.equal(ES.End, 'Fin');
  assert.equal(ES.Enter, 'Intro');
  assert.equal(ES.Backspace, 'Retroceso');
  assert.equal(ES['Del / Backspace'], 'Supr / Retroceso');
});

test('the zoom bar name, the node-edit label and the satin reset tooltip are translated', () => {
  assert.notEqual(ES.Zoom, 'Zoom');
  assert.equal(ES['Edit nodes (Enter)'], 'Editar nodos (Intro)');
  assert.equal(ES['Edit nodes (Enter) — converts rectangles and ellipses to paths'], 'Editar nodos (Intro) — convierte rectángulos y elipses en trazados');
  assert.match(ES['Reset to default ({n} mm)'], /^Restablecer al valor predeterminado \({n} mm\)$/);
});

test('no Spanish value spells out an English key name', () => {
  const keyNames = /\b(Enter|Escape|Backspace|Delete|Home|End|Click|Drag)\b/;
  const found = Object.entries(ES).filter(([, value]) => keyNames.test(value)).map(([key, value]) => `${key} -> ${value}`);
  assert.deepEqual(found, [], 'Spanish values that still use an English key name');
});

test('the Spanish modifier names on non-Apple platforms are translated', () => {
  // The language is read once, when i18n.js loads, so the check runs in a child process set to Spanish.
  const script = `
    globalThis.location = {search: '?lang=es'};
    const {modifierName, shortcutLabel} = await import('${new URL('../src/shortcutLabels.js', import.meta.url).href}');
    console.log(JSON.stringify([modifierName('shift', false), modifierName('alt', false), shortcutLabel([{mod: true, shift: true, key: 'S'}], false)]));
  `;
  const out = spawnSync(process.execPath, ['--input-type=module', '-e', script], {encoding: 'utf8'});
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout), ['Mayús', 'Alt', 'Ctrl+Mayús+S']);
});
