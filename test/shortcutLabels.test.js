import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isApplePlatform, modifierName, shortcutLabel} from '../src/shortcutLabels.js';

test('navigator.platform decides Apple platforms, with the userAgent only as a fallback', () => {
  assert.equal(isApplePlatform({platform: 'MacIntel'}), true);
  assert.equal(isApplePlatform({platform: 'iPad'}), true);
  assert.equal(isApplePlatform({platform: 'Win32'}), false);
  assert.equal(isApplePlatform({platform: 'Linux x86_64', userAgent: 'Macintosh'}), false);
  assert.equal(isApplePlatform({platform: '', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'}), true);
  assert.equal(isApplePlatform({platform: '', userAgent: 'Mozilla/5.0 (Windows NT 10.0)'}), false);
  assert.equal(isApplePlatform(undefined), false);
});

test('other platforms keep Ctrl and Alt labels', () => {
  assert.equal(shortcutLabel([{mod: true, key: 'S'}], false), 'Ctrl+S');
  assert.equal(shortcutLabel([{mod: true, shift: true, key: 'S'}], false), 'Ctrl+Shift+S');
  assert.equal(shortcutLabel([{mod: true, alt: true, key: 'C'}], false), 'Ctrl+Alt+C');
  assert.equal(shortcutLabel([{shift: true, key: '0'}], false), 'Shift+0');
  assert.equal(shortcutLabel([{mod: true, key: 'Z'}, ' / ', {mod: true, key: 'Y'}], false), 'Ctrl+Z / Ctrl+Y');
  assert.equal(shortcutLabel([{mod: true, key: 'C'}, ' / X / V'], false), 'Ctrl+C / X / V');
  assert.equal(shortcutLabel([{mod: true, key: 'Arrows', appleKey: '←↑→↓'}], false), 'Ctrl+Arrows');
  assert.equal(shortcutLabel([{mod: true, alt: true, key: '←'}, ' / →'], false), 'Ctrl+Alt+← / →');
});

test('Apple platforms use macOS modifier order and glyphs with no separator', () => {
  assert.equal(shortcutLabel([{mod: true, key: 'S'}], true), '⌘S');
  assert.equal(shortcutLabel([{mod: true, shift: true, key: 'S'}], true), '⇧⌘S');
  assert.equal(shortcutLabel([{mod: true, alt: true, key: 'C'}], true), '⌥⌘C');
  assert.equal(shortcutLabel([{mod: true, alt: true, shift: true, key: 'G'}], true), '⌥⇧⌘G');
  assert.equal(shortcutLabel([{shift: true, key: '0'}], true), '⇧0');
  assert.equal(shortcutLabel([{mod: true, key: 'Z'}, ' / ', {mod: true, key: 'Y'}], true), '⌘Z / ⌘Y');
  assert.equal(shortcutLabel([{mod: true, key: 'Arrows', appleKey: '←↑→↓'}], true), '⌘←↑→↓');
  assert.equal(shortcutLabel([{mod: true, alt: true, key: '←'}, ' / →'], true), '⌥⌘← / →');
});

test('a chord with no modifiers is just its key on every platform', () => {
  assert.equal(shortcutLabel(['V'], false), 'V');
  assert.equal(shortcutLabel(['V'], true), 'V');
});

test('modifier names in prose: glyphs on Apple platforms, words elsewhere', () => {
  assert.equal(modifierName('shift', true), '⇧');
  assert.equal(modifierName('alt', true), '⌥');
  assert.equal(modifierName('shift', false), 'Shift');
  assert.equal(modifierName('alt', false), 'Alt');
});
