import test from 'node:test';
import assert from 'node:assert/strict';
import {decimalText, parseDecimal} from '../src/decimalText.js';

test('a stored value shows a dot in English and a comma in Spanish', () => {
 assert.equal(decimalText('-12.0', 'en'), '-12.0');
 assert.equal(decimalText('0.4', 'en'), '0.4');
 assert.equal(decimalText('-12.0', 'es'), '-12,0');
 assert.equal(decimalText('0.4', 'es'), '0,4');
 assert.equal(decimalText('7', 'es'), '7');
});

test('typed text is read with either separator', () => {
 assert.equal(parseDecimal('0.4'), '0.4');
 assert.equal(parseDecimal('0,4'), '0.4');
 assert.equal(parseDecimal('-12,0'), '-12.0');
 assert.equal(parseDecimal(' 24 '), '24');
 assert.equal(parseDecimal('1.25'), '1.25');
});

test('text that is not a number reads as the empty value, as before', () => {
 assert.equal(parseDecimal('abc'), '');
 assert.equal(parseDecimal(''), '');
 assert.equal(parseDecimal('   '), '');
 assert.equal(parseDecimal('1.000,5'), '');
});
