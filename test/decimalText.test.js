import test from 'node:test';
import assert from 'node:assert/strict';
import {countText, decimalText, fieldText, formatCount, formatNumber, parseDecimal} from '../src/decimalText.js';

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

test('an mm value always shows one decimal place in English, and the same shape in Spanish', () => {
 assert.equal(fieldText('3', 'en'), '3.0');
 assert.equal(fieldText('0.4', 'en'), '0.4');
 assert.equal(fieldText('0.05', 'en'), '0.05');
 assert.equal(fieldText('-12', 'es'), '-12,0');
 assert.equal(fieldText('2.4', 'es'), '2,4');
});

test('a unitless value keeps its stored form', () => {
 assert.equal(fieldText('0', 'en', ''), '0');
 assert.equal(fieldText('90', 'en', '°'), '90');
});

test('a count groups thousands in the UI language', () => {
 assert.equal(formatCount(1234, 'en'), '1,234');
 assert.equal(formatCount(42, 'en'), '42');
});

test('a count groups thousands the same way in Spanish, whatever the browser locale', () => {
 assert.equal(formatCount(1102, 'es'), '1.102');
 assert.equal(formatCount(1102, 'en'), '1,102');
 assert.equal(formatCount(12345678, 'es'), '12.345.678');
});

test('a fixed-place number uses the UI language separators', () => {
 assert.equal(formatNumber(2.8, 'es', 1), '2,8');
 assert.equal(formatNumber(2.8, 'en', 1), '2.8');
 assert.equal(formatNumber(0, 'es', 1), '0,0');
 assert.equal(formatNumber(0.4, 'es', 2), '0,40');
 assert.equal(formatNumber(1234.5, 'es', 1), '1.234,5');
 assert.equal(formatNumber(1234.5, 'en', 1), '1,234.5');
});

test('a distance in a sentence takes the comma in Spanish and the point in English', () => {
 assert.equal(countText('120.2', 'es'), '120,2');
 assert.equal(countText('120.2', 'en'), '120.2');
 assert.equal(countText('3', 'es'), '3');
 assert.equal(countText('1.0, 2.0', 'es'), '1.0, 2.0');
});
