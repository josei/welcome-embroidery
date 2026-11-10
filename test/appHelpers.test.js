import test from 'node:test';
import assert from 'node:assert/strict';
import {safeProjectFilename} from '../src/appHelpers.js';

test('a default file name keeps Unicode letters and replaces only filename-invalid characters', () => {
 assert.equal(safeProjectFilename('Diseño 2026: flor/niño'), 'Diseño 2026_ flor_niño.welcome');
 assert.equal(safeProjectFilename('a\\b*c?"d<e>f|g\u0000h\u001Fi\u007Fj'), 'a_b_c__d_e_f_g_h_i_j.welcome');
 assert.equal(safeProjectFilename('Hi! It\'s v1.2.welcome'), 'Hi! It\'s v1.2.welcome');
});

test('an empty name falls back to Untitled design', () => {
 assert.equal(safeProjectFilename(''), 'Untitled design.welcome');
 assert.equal(safeProjectFilename('   '), 'Untitled design.welcome');
 assert.equal(safeProjectFilename(null), 'Untitled design.welcome');
 assert.equal(safeProjectFilename('.welcome'), 'Untitled design.welcome');
});

test('a Windows reserved device name gets a trailing underscore on its base name', () => {
 assert.equal(safeProjectFilename('CON'), 'CON_.welcome');
 assert.equal(safeProjectFilename('lpt1'), 'lpt1_.welcome');
 assert.equal(safeProjectFilename('COM9.final'), 'COM9_.final.welcome');
 assert.equal(safeProjectFilename('CONTROL'), 'CONTROL.welcome');
});
