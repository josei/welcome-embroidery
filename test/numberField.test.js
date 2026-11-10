import test from 'node:test';
import assert from 'node:assert/strict';
import {clampToRange, inRange, parseNumberText, rangeNote, rangeText} from '../src/numberField.js';

const LETTERING = {min: 4, max: 16};
const SATIN = {min: 0.5, max: 12};
const SHAPE = {min: 0.5, max: Infinity};

test('committed text parses to a number, and blank or incomplete text is no value', () => {
 assert.equal(parseNumberText('40'), 40);
 assert.equal(parseNumberText(' 0.1 '), 0.1);
 assert.equal(parseNumberText('-2.5'), -2.5);
 for (const text of ['', '   ', '-', '.', 'e', 'abc', 'Infinity']) assert.equal(parseNumberText(text), null, JSON.stringify(text));
});

test('a value outside the range clamps to the nearest bound, and one inside is kept', () => {
 assert.equal(clampToRange(40, LETTERING), 16);
 assert.equal(clampToRange(-3, LETTERING), 4);
 assert.equal(clampToRange(0.1, SATIN), 0.5);
 assert.equal(clampToRange(0.2, SHAPE), 0.5);
 assert.equal(clampToRange(9999, SHAPE), 9999, 'a field with no upper bound keeps large values');
 assert.equal(clampToRange(7, LETTERING), 7);
 assert.equal(clampToRange(4, LETTERING), 4, 'the bounds themselves are allowed');
});

test('the range check reads the text, and only numbers inside the range pass', () => {
 assert.equal(inRange('16', LETTERING), true);
 assert.equal(inRange('16.5', LETTERING), false);
 assert.equal(inRange('', LETTERING), false, 'empty is not a value');
 assert.equal(inRange('-', SATIN), false);
});

test('the note names the bound that was hit, with the unit', () => {
 assert.equal(rangeNote(16, LETTERING), 'Max 16 mm');
 assert.equal(rangeNote(4, LETTERING), 'Min 4 mm');
 assert.equal(rangeNote(0.5, SATIN), 'Min 0.5 mm');
 assert.equal(rangeNote(12, SATIN), 'Max 12 mm');
 assert.equal(rangeNote(50, {min: 0, max: 50}, '%'), 'Max 50 %');
 assert.equal(rangeNote(1, {min: 1, max: 4}, '°'), 'Min 1 °');
});

test('the hint shows the allowed range, or only a minimum when there is no maximum', () => {
 assert.equal(rangeText(SATIN), '0.5–12 mm');
 assert.equal(rangeText({min: 10, max: 400}), '10–400 mm');
 assert.equal(rangeText(SHAPE), 'Min 0.5 mm');
 assert.equal(rangeText({min: -180, max: 180}, '°'), '-180–180 °');
 assert.equal(rangeText({min: 0.5, max: 16}, ''), '0.5–16', 'a multiplier has no unit');
});
