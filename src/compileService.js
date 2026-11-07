// @ts-check
// The stitch worker and the compile pipeline: one request at a time, a generation that aborts stale work, the debounce
// before a compile, and the compiled plan the rest of the editor reads. app.js wires render and fonts through configure.
import {documentNow} from './documentState.js';
import {forWorker} from './appHelpers.js';
import {setSewingCounts} from './sewingCountsState.js';
import {editor} from './editorContext.js';

const worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'});
/** @type {any} */
let workerFailure = null;
let seq = 0;
let generation = 0;
/** @type {Map<number, {resolve: (value: any) => void, reject: (error: any) => void}>} */
const pending = new Map();
/** @type {any} */
let plan = null;
/** @type {any} */
let lastPlan = null;
let compileError = '';
/** @type {any} */
let compileTimer = null;
let compiling = false;
/** @type {(() => void) | null} */
let onClear = null;
/** @type {(() => void) | null} */
let onCompiled = null;
/** @type {(() => Promise<void>) | null} */
let ensureFonts = null;

worker.onmessage = (/** @type {any} */ e) => {
  const data = /** @type {any} */ (e).data;
  if (data.generation !== generation) return;
  const item = pending.get(data.id);
  if (!item) return;
  pending.delete(data.id);
  data.ok ? item.resolve(data) : item.reject(Error(data.error));
};

/** @param {any} error */
function failPending(error) {
  workerFailure ??= error;
  for (const item of pending.values()) item.reject(workerFailure);
  pending.clear();
}

worker.addEventListener('error', (/** @type {any} */ e) => {
  e.preventDefault();
  failPending(Error(`Stitch worker failed to load or run${e.message ? `: ${e.message}` : ''}. Reload the editor and try again.`));
});
worker.addEventListener('messageerror', () =>
  failPending(Error('The stitch worker returned data the editor could not read. Reload the editor and try again.')));

/**
 * @param {any} data
 * @param {Transferable[]} [transfer]
 * @returns {Promise<any>}
 */
export function request(data, transfer = []) {
  return new Promise((resolve, reject) => {
    if (workerFailure) { reject(workerFailure); return; }
    const id = ++seq, version = generation;
    pending.set(id, {resolve, reject});
    try {
      worker.postMessage({id, generation: version, ...data}, transfer);
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

/** The compiled plan, or null before the first successful compile. */
export function getPlan() { return plan; }

/** Replaces the compiled plan. The export commands hand one back after compiling a subset. */
export function setPlan(/** @type {any} */ next) { plan = next; }

/** The last compiled plan, kept on screen while a new compile runs. */
export function getLastPlan() { return lastPlan; }

/** The last compile error, or the empty string. */
export function getCompileError() { return compileError; }

/** Whether a compile is in flight. */
export function isCompiling() { return compiling; }

/** Whether the worker failed to load or run. */
export function hasWorkerFailure() { return Boolean(workerFailure); }

/** app.js wires the fonts the compile waits for and the playback reset the document change needs. */
export function configureCompile(/** @type {{ensureFonts: () => Promise<void>, onClear: () => void, onCompiled: () => void}} */ next) {
  ensureFonts = next.ensureFonts;
  onClear = next.onClear;
  onCompiled = next.onCompiled;
}

/** Debounced compile after an edit. */
export function scheduleCompile(delay = 450) {
  clearTimeout(compileTimer);
  if (!documentNow().doc.objects.length || workerFailure) { compileError = ''; return; }
  compileTimer = setTimeout(() => compileNow(), delay);
}

/** Drops the plan and every request in flight because the document changed. Playback resets through onClear. */
export function clearComputed() {
  if (plan) lastPlan = plan;
  generation++;
  for (const item of pending.values()) item.reject(new DOMException('The document changed.', 'AbortError'));
  pending.clear();
  plan = null;
  setSewingCounts({});
  onClear?.();
  scheduleCompile();
}

/** Compiles the current document. A manual compile shows worker errors in the toast. */
export async function compileNow(/** @type {boolean | Event} */ manual = false) {
  compiling = true;
  try {
    await ensureFonts?.();
    const revision = documentNow().doc.revision;
    const result = await request({type: 'compile', document: forWorker(documentNow().doc)});
    if (result.plan.revision !== revision || revision !== documentNow().doc.revision) return;
    plan = result.plan;
    lastPlan = plan;
    setSewingCounts(plan.objectCounts || {});
    compileError = '';
    onCompiled?.();
    compiling = false;
    editor.render();
  } catch (error) {
    const err = /** @type {any} */ (error);
    if (err.name !== 'AbortError') {
      compileError = err.message;
      compiling = false;
      editor.render();
      if (manual === true || manual instanceof Event) editor.toast(err.message);
    }
  } finally {
    if (!plan && compileError) compiling = false;
  }
}

/** The compile service as app.js publishes it to the runtime. */
export const compile = {
  getPlan,
  setPlan,
  getLastPlan,
  getCompileError,
  isCompiling,
  hasWorkerFailure,
  request,
  scheduleCompile,
  clearComputed,
  compileNow,
};
