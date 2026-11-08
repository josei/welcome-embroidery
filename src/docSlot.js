// @ts-check
// Per-tab autosave slots and the open-document registry. Each tab keeps its recovery copy under its own key, built from a
// tab id held in sessionStorage, so a reload restores that tab's design and never another tab's. Each document has an id
// (held in sessionStorage per tab, and written into saved .welcome files), and every live tab registers the id it has open
// in localStorage, so a tab can tell when another live tab holds the same document.

export const AUTOSAVE_PREFIX = 'welcome.autosave:';
/** The single key earlier builds used; a copy left under it is still offered once, then removed. */
export const LEGACY_AUTOSAVE_KEY = 'welcome.autosave';

const TAB_KEY = 'welcome.tabId';
const DOC_KEY = 'welcome.docId';
const OPEN_KEY = 'welcome.openTabs';
/** A tab that has not written its registry entry for this long is treated as closed (background tabs are throttled). */
const LIVE_MS = 15000;
/** How often a tab refreshes its registry entry. */
const BEAT_MS = 2000;
/** Copies older than this with no open tab are dropped on start-up. */
const STALE_COPY_MS = 14 * 24 * 60 * 60 * 1000;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** @type {Array<() => void>} */
const listeners = [];

/** A random RFC 4122 v4 id; crypto.randomUUID is missing on plain-http pages. @returns {string} */
function newId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** @param {unknown} id @returns {id is string} */
export function isDocId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

/** @returns {Record<string, {doc?: string, at?: number}>} */
function readRegistry() {
  try {
    const value = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, unknown>} registry */
function writeRegistry(registry) {
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(registry)); } catch {}
}

/** @param {Record<string, {at?: number}>} registry @param {string} id */
function isLive(registry, id) {
  const entry = registry[id];
  return !!entry && typeof entry.at === 'number' && Date.now() - entry.at <= LIVE_MS;
}

/** @param {string} key @returns {string|null} */
function readSession(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

/** @param {string} key @param {string} value */
function writeSession(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}

// A duplicated tab copies sessionStorage, so it can start with the id of a tab that is still open. That tab keeps the id;
// the copy takes a new one and keeps the document id, so both report the same document as open.
let tabId = readSession(TAB_KEY) || '';
if (!isDocId(tabId) || isLive(readRegistry(), tabId)) {
  tabId = newId();
  writeSession(TAB_KEY, tabId);
}

let docId = readSession(DOC_KEY) || '';
if (!isDocId(docId)) {
  docId = newId();
  writeSession(DOC_KEY, docId);
}

/** The autosave key of this tab. @returns {string} */
export function ownAutosaveKey() {
  return AUTOSAVE_PREFIX + tabId;
}

/** The id of the document this tab has open. @returns {string} */
export function currentDocId() {
  return docId;
}

/**
 * Makes the document this tab has open the one with the given id; a missing or invalid id starts a new document.
 * @param {unknown} id
 */
export function setDocId(id) {
  docId = isDocId(id) ? id : newId();
  writeSession(DOC_KEY, docId);
  beat();
}

/** True when another open tab holds the same document. @returns {boolean} */
export function openElsewhere() {
  const registry = readRegistry();
  return Object.keys(registry).some(id => id !== tabId && registry[id]?.doc === docId && isLive(registry, id));
}

/**
 * The autosave keys that no open tab owns: the copies of tabs that closed or crashed, newest first. A fresh tab offers
 * one of these, so a browser restart or crash still leaves its last design to recover.
 * @returns {string[]}
 */
export function orphanedKeys() {
  const registry = readRegistry();
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || (key !== LEGACY_AUTOSAVE_KEY && !key.startsWith(AUTOSAVE_PREFIX))) continue;
      const owner = key === LEGACY_AUTOSAVE_KEY ? '' : key.slice(AUTOSAVE_PREFIX.length);
      if (key === ownAutosaveKey() || (owner && isLive(registry, owner))) continue;
      keys.push(key);
    }
  } catch {}
  return keys;
}

/** @param {string} key */
export function removeKey(key) {
  try { localStorage.removeItem(key); } catch {}
}

/** Drops orphaned copies that are clean or too old to be worth offering. */
export function pruneOrphans() {
  for (const key of orphanedKeys()) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (!saved || saved.clean || typeof saved.savedAt !== 'number' || Date.now() - saved.savedAt > STALE_COPY_MS) removeKey(key);
    } catch {
      removeKey(key);
    }
  }
}

/** Calls fn after the registry changes, from this tab or another one. @param {() => void} fn */
export function onSlotChange(fn) {
  listeners.push(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

function beat() {
  const registry = readRegistry();
  for (const id of Object.keys(registry)) {
    if (id !== tabId && !isLive(registry, id)) delete registry[id];
  }
  registry[tabId] = {doc: docId, at: Date.now()};
  writeRegistry(registry);
  notify();
}

/** Registers this tab, keeps its entry fresh, and removes it when the page goes away. */
export function mountSlot() {
  beat();
  setInterval(beat, BEAT_MS);
  window.addEventListener('pagehide', () => {
    const registry = readRegistry();
    delete registry[tabId];
    writeRegistry(registry);
  });
  window.addEventListener('storage', e => {
    if (e.key === OPEN_KEY || e.key === null) notify();
  });
}
