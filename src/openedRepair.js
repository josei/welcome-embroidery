// @ts-check
// Repairs a document read from a file or a link before it is validated: lettering whose font is not available is set in
// Welcome Mono, and a reference picture the browser cannot decode is left out.
import {measureText} from './engine.js';
import {t} from './i18n.js';
import {isRegistryFont, LEGACY_FONTS, loadFont} from './fonts.js';

/** The font a lettering object is set in when its own font is neither bundled nor stored in the project. */
const FALLBACK_FONT = 'welcome-mono/1';
/** The height range Welcome Mono lettering may have, in millimetres. */
const FALLBACK_HEIGHT = [4, 16];

/**
 * Fetches a bundled font file, for loadFont.
 * @param {string} path
 * @returns {Promise<any>}
 */
const fetchFontJson = (path) => fetch(new URL('../' + path, import.meta.url)).then((r) => {
  if (!r.ok) throw Error(`Font file ${path} could not be loaded (${r.status}).`);
  return r.json();
});

/**
 * True when the bundled font loads from the app's files.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function loadedOrNot(id) {
  try {
    await loadFont(id, fetchFontJson);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the browser can decode the picture: an image element that fails to load is not an image.
 * @param {string} data a data URL
 * @returns {Promise<boolean>}
 */
function pictureDecodes(data) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0);
    image.onerror = () => resolve(false);
    image.src = data;
  });
}

/**
 * Makes a document read from a file or a link openable before it is validated. Lettering whose font is neither bundled
 * nor stored in the project is set in Welcome Mono (its height is kept within that font's range), and a reference picture
 * the browser cannot decode is left out. The rest of the design is untouched. Returns one note per change for the toast.
 * @param {any} doc the parsed document; changed in place
 * @returns {Promise<string[]>}
 */
export async function repairOpened(doc) {
  /** @type {string[]} */
  const notes = [];
  for (const o of Array.isArray(doc?.objects) ? doc.objects : []) {
    if (!o || o.kind !== 'text' || LEGACY_FONTS.has(o.font)) continue;
    if (isRegistryFont(o.font)) {
      // A font stored in the project is always usable; a bundled one must load from the app's files.
      if (o.font.startsWith('custom/') ? doc.customFonts?.[o.font.slice(7)] : await loadedOrNot(o.font)) continue;
    }
    const missing = String(o.font);
    o.font = FALLBACK_FONT;
    if (Number.isFinite(o.h)) {
      o.h = Math.min(FALLBACK_HEIGHT[1], Math.max(FALLBACK_HEIGHT[0], o.h));
      if (typeof o.text === 'string' && o.text.trim()) o.w = measureText(o.text, FALLBACK_FONT, o.h, o);
    }
    notes.push(t('{name} uses the font {font}, which is not bundled here; it is set in Welcome Mono.', {name: o.name || o.id, font: missing}));
  }
  if (doc?.reference && !(await pictureDecodes(String(doc.reference.data)))) {
    delete doc.reference;
    notes.push(t('The reference picture could not be read, so it was left out.'));
  }
  return notes;
}
