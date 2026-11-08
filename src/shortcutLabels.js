// @ts-check
// Keyboard shortcut labels, in one place. Other platforms read "Ctrl+Shift+S" and "Alt+←"; Apple platforms read
// "⇧⌘S" and "⌥←" in macOS menu order (⌃ ⌥ ⇧ ⌘), glyphs with no separator. Labels are built from structured chords,
// so no component hand-writes a shortcut string. Plain text parts (a bare key such as "V", or " / ") are shown as they are.

/**
 * @typedef {object} Chord
 * @property {string} key the key name as shown on other platforms, e.g. "S", "Arrows", "←", "0"
 * @property {boolean} [mod] Ctrl on other platforms, ⌘ on Apple platforms
 * @property {boolean} [alt] Alt on other platforms, ⌥ on Apple platforms
 * @property {boolean} [shift] Shift on every platform, ⇧ on Apple platforms
 * @property {string} [appleKey] the glyph(s) shown on Apple platforms in place of `key`, e.g. "←↑→↓" for "Arrows"
 */

/** @typedef {Chord | string} Part */

/**
 * Whether a navigator names an Apple platform. `navigator.platform` decides when it is set; the userAgent is the
 * fallback for when it is empty.
 * @param {{platform?: string, userAgent?: string} | null | undefined} nav
 * @returns {boolean}
 */
export function isApplePlatform(nav) {
  if (!nav) return false;
  const platform = String(nav.platform || '');
  if (platform) return /^(Mac|iPhone|iPad|iPod)/.test(platform);
  return /iPhone|iPad|iPod|Macintosh/.test(String(nav.userAgent || ''));
}

/** Detected once, when the module loads. */
export const isApple = isApplePlatform(typeof navigator === 'undefined' ? undefined : navigator);

/**
 * @param {Part} part
 * @param {boolean} apple
 * @returns {string}
 */
function formatPart(part, apple) {
  if (typeof part === 'string') return part;
  const {key, mod, alt, shift, appleKey} = part;
  if (apple) return (alt ? '⌥' : '') + (shift ? '⇧' : '') + (mod ? '⌘' : '') + (appleKey ?? key);
  return [mod && 'Ctrl', alt && 'Alt', shift && 'Shift', key].filter(Boolean).join('+');
}

/**
 * A shortcut label. `[{mod: true, key: 'S'}]` reads "Ctrl+S" or "⌘S"; a string part joins chords, for example
 * `[{mod: true, key: 'Z'}, ' / ', {mod: true, key: 'Y'}]`.
 * @param {Part[]} parts
 * @param {boolean} [apple] override the detected platform (tests use this)
 * @returns {string}
 */
export function shortcutLabel(parts, apple = isApple) {
  return parts.map(part => formatPart(part, apple)).join('');
}
