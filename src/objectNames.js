import {t} from './i18n.js';

// Names for copies: Copy, Paste and Duplicate give "<base> 2", "<base> 3", ... where the base is the name without its
// trailing " copy" or number, so copies never stack into "Rectangle copy copy". The number is the lowest one not
// already used by an object in the document.

/**
 * The name for a copy of an object.
 * @param {string | undefined} name the original's name (may be empty; the kind is used then)
 * @param {string} kind the object kind, the fallback base when the name is empty
 * @param {Iterable<string | undefined>} taken names already used in the document, including earlier copies in the same batch
 * @returns {string}
 */
export function copyName(name, kind, taken) {
  const used = new Set(taken);
  const original = (name || kind || 'Object').trim();
  const base = original.replace(/( copy| \d+)+$/, '').trim() || original;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * Whether an object has a name to show. A blank name counts as no name.
 * @param {{name?: string} | undefined} o
 * @returns {boolean}
 */
export function hasName(o) {
  return typeof o?.name === 'string' && o.name.trim() !== '';
}

/**
 * The label for an object in a message: its name when it has one, otherwise a phrase for what it is. Never its id.
 * `start` begins a sentence ("This object"); `other` ends one ("another object").
 * @param {{name?: string, kind?: string} | undefined} o
 * @param {'start' | 'other'} [form]
 * @returns {string}
 */
export function objectLabel(o, form = 'start') {
  if (hasName(o)) return /** @type {string} */ (o?.name).trim();
  const lettering = o?.kind === 'text';
  if (form === 'other') return lettering ? 'another text' : 'another object';
  return lettering ? 'This text' : 'This object';
}

/**
 * The layer name of a lettering object: the object type, then its first line of text in quotes, as in Text "Hola".
 * Before any text is typed it is the bare type, so the layer never reads an empty pair of quotes.
 * @param {string | undefined} text the lettering's text (may be empty)
 * @returns {string}
 */
export function letteringName(text) {
  const first = String(text ?? '').split('\n')[0];
  return first ? `Text "${first}"` : 'Text';
}

/**
 * Whether a lettering object's name is the one the engine gave it, so typing new text may rename it. A name the user
 * typed in Layers is not automatic and is kept.
 * @param {string | undefined} name the object's current name
 * @param {string | undefined} text the text it was named from
 * @returns {boolean}
 */
export function isAutomaticLetteringName(name, text) {
  return name === 'Text' || name === letteringName(text);
}

/**
 * The name a lettering object shows in Layers, in the UI language: the stored name with its type word and quoted text
 * translated, as in Texto "Hola". Other names are shown as they are stored.
 * @param {string | undefined} name the stored name
 * @returns {string}
 */
export function letteringLayerName(name) {
  if (name === 'Text') return t('Text');
  const quoted = /^Text "(.*)"$/s.exec(name ?? '');
  return quoted ? t('Text "{t}"', {t: quoted[1]}) : name ?? '';
}
