// @ts-check
// Project files in and out: saving the open project, opening a .welcome project, an SVG or a DXF, importing a machine
// file, starting a new design and the `?open=` link. The header's buttons and file inputs call these; app.js wires the
// editor commands they need once at start-up.
import {documentActions, documentNow, setDocument} from './documentState.js';
import {setSave} from './saveState.js';
import {selState, setSelection} from './selectionState.js';
import {setEditMode} from './editModeState.js';
import {clone, download, safeProjectFilename} from './appHelpers.js';
import {dxfDocument} from './dxf.js';
import {withSavedHoop} from './storedPrefs.js';
import {importSvg} from './svgImport.js';
import {initialDocument, makeStitchLayer, validateDocument} from './engine.js';
import {t} from './i18n.js';
import {currentDocId, isDocId, openElsewhere, ownAutosaveKey, setDocId} from './docSlot.js';

/** The largest project file the editor opens. */
const PROJECT_LIMIT=33_554_432;
/** The largest machine file the editor imports: the source bytes are kept inside the project. */
const MACHINE_LIMIT=1_048_576;
/** The machine formats the import accepts, as file extensions. */
const MACHINE_EXTENSIONS=['jef','vp3','dst','sew','pec','pes','exp','hus','xxx','dsb','dsz','tap','tbf','pcs','shv','stx','bro','emd','ksm','10o'];

/**
 * @typedef {Object} ProjectApi What the project commands need from the editor, supplied by app.js.
 * @property {() => void} clearComputed Drops the compiled plan and the playback position after the document is replaced.
 * @property {() => void} render
 * @property {(message: string) => void} toast
 * @property {(operations: Record<string, unknown>[], after?: () => void) => boolean} edit Runs one undoable command.
 * @property {(fn: () => void) => boolean} transact Runs a change that manages the document itself.
 * @property {(data: Record<string, unknown>, transfer?: Transferable[]) => Promise<any>} request Sends one worker job.
 * @property {() => Promise<unknown>} compileNow Compiles the document, so a newly imported stitch layer is sewn.
 * @property {() => void} fitAll Fits the whole design in the view; the canvas is not ready during the first render.
 * @property {() => void} fitHoop Fits the hoop in the view; the canvas is not ready during the first render.
 */

/** @type {ProjectApi|null} */
let api = null;

/** The wired editor commands. app.js calls configureProjectIO before any of these run. */
function wired() {
  if (!api) throw Error('The project commands are not wired.');
  return api;
}

/** Wires the project commands, once, and the project name field's rename with them. */
/** @param {ProjectApi} next */
export function configureProjectIO(next) {
  api = next;
  documentActions.rename = renameProject;
}

/**
 * The project name field's committed text: the document is renamed, and false puts the stored name back when it is blank.
 * @param {string} text
 * @returns {boolean}
 */
export function renameProject(text) {
  const name = text.trim();
  if (!name) {
    wired().toast('Project name cannot be empty.');
    return false;
  }
  wired().edit([{op: 'rename_document', name}]);
  return true;
}

/** The File System Access handle of the file the first Save chose; later Saves overwrite it. Null until one is chosen. */
/** @type {any} */
let fileHandle = null;

/** The file types the picker offers: Welcome project files. */
const PROJECT_TYPES = [{description: 'Welcome project', accept: {'application/json': ['.welcome']}}];

/**
 * True where the browser can pick the file to write (Chromium). Elsewhere Save downloads the file and Save As asks for a name.
 * @returns {boolean}
 */
export function hasFilePicker() {
  return typeof (/** @type {any} */ (window)).showSaveFilePicker === 'function';
}

/**
 * Shows the browser's save picker. Starts the picker synchronously, so a click that calls it keeps its user activation.
 * @returns {Promise<any|null>} the chosen handle, or null when the user cancels
 */
async function chooseFile() {
  try {
    return await (/** @type {any} */ (window)).showSaveFilePicker({suggestedName: safeProjectFilename(documentNow().doc.name), types: PROJECT_TYPES});
  } catch (error) {
    if (/** @type {Error} */ (error).name === 'AbortError') return null;
    throw error;
  }
}

/**
 * The open project as the text a .welcome file holds, with its document id, and the revision it was taken from.
 * @returns {{text: string, revision: number, name: string}}
 */
function projectText() {
  const doc = documentNow().doc;
  return {text: JSON.stringify({...doc, docId: currentDocId()}, null, 2), revision: doc.revision, name: doc.name};
}

/**
 * Records a successful save: the unsaved marker clears (unless the design changed while the file was written) and the
 * time is stamped. The autosave copy is marked clean once its delayed write has run, so a reload does not offer it back.
 * @param {number} revision the revision that was written
 */
function markSaved(revision) {
  setTimeout(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ownAutosaveKey()) || 'null');
      if (saved) {
        saved.clean = true;
        localStorage.setItem(ownAutosaveKey(), JSON.stringify(saved));
      }
    } catch {}
  }, 0);
  if (documentNow().doc.revision === revision) setDocument({dirty: false});
  setSave({savedAt: Date.now()});
  wired().render();
  if (openElsewhere()) wired().toast(t('Saved. This document is also open in another tab.'));
}

/** @param {unknown} error */
function reportSaveError(error) {
  wired().toast(/** @type {Error} */ (error).message || t('The project could not be saved.'));
}

/**
 * Save. Where the browser has a file picker, the first Save asks for a file and later Saves overwrite it. Elsewhere Save
 * downloads the project file under its document name.
 */
export async function projectSave() {
  try {
    if (!hasFilePicker()) {
      const {text, revision, name} = projectText();
      download(text, safeProjectFilename(name), 'application/json');
      markSaved(revision);
      return;
    }
    if (!fileHandle) {
      const handle = await chooseFile();
      if (!handle) return;
      fileHandle = handle;
    }
    const {text, revision} = projectText();
    await writeFile(fileHandle, text);
    markSaved(revision);
  } catch (error) {
    reportSaveError(error);
  }
}

/**
 * Save As. Where the browser has a file picker, it always asks for a file and that file becomes the one Save overwrites.
 * Elsewhere it opens the name prompt; the name it is given is the download's file name.
 */
export async function projectSaveAs() {
  if (!hasFilePicker()) {
    setSave({saveAsOpen: true, saveAsName: documentNow().doc.name || 'Untitled'});
    return;
  }
  try {
    const handle = await chooseFile();
    if (!handle) return;
    const {text, revision} = projectText();
    await writeFile(handle, text);
    fileHandle = handle;
    markSaved(revision);
  } catch (error) {
    reportSaveError(error);
  }
}

/**
 * Save As on the download fallback: downloads the project under the name the user typed.
 * @param {string} name
 */
export function saveAsDownload(name) {
  const {text, revision} = projectText();
  download(text, safeProjectFilename(name), 'application/json');
  setSave({saveAsOpen: false});
  markSaved(revision);
}

/**
 * Writes the text to a picked file.
 * @param {any} handle
 * @param {string} text
 */
async function writeFile(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/**
 * Opens a validated document as the project: no history, the first object selected, fitted to the view, and clean. The
 * document keeps the id a saved file carries, or takes a new one.
 * @param {any} next
 */
export function acceptProject(next) {
  const {docId, ...body} = next;
  validateDocument(body);
  const opened = clone(body);
  setDocId(isDocId(docId) ? docId : undefined);
  fileHandle = null;
  setSave({savedAt: null});
  wired().clearComputed();
  setDocument({doc: opened});
  setDocument({history: []});
  setDocument({future: []});
  setSelection({selected: documentNow().doc.objects[0]?.id || null});
  const primary = selState().selected;
  setSelection({multi: new Set(primary ? [primary] : [])});
  setEditMode(false);
  setSelection({selNode: null});
  setDocument({dirty: false});
  wired().render();
  wired().fitAll();
  wired().toast('Project opened locally.');
}

/**
 * Opens the project an agent shared, by its link id. Leaves the `?open=` parameter out of the address once it is open.
 * @param {string} id
 */
export async function openArtifact(id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw Error('Invalid MCP project link.');
  let response = await fetch(`/artifacts/${id}.welcome`, {credentials: 'same-origin', redirect: 'error'});
  if (response.status === 404) response = await fetch(`/artifacts/${id}.welcome`, {credentials: 'same-origin', redirect: 'error'});
  if (!response.ok) throw Error(`MCP project could not be opened (${response.status}).`);
  const next = await response.json();
  acceptProject(next);
  window.history.replaceState(null, '', location.pathname);
}

/**
 * Opens an autosaved document as the project, still marked unsaved so the user decides when to save it; a document that
 * fails validation shows its message and leaves the editor as it was.
 * @param {any} saved
 */
export function restoreProject(saved) {
  try {
    acceptProject(saved);
    setDocument({dirty: true});
    wired().render();
  } catch (error) {
    wired().toast(/** @type {Error} */ (error).message);
  }
}

/**
 * Asks before a change throws away unsaved work: true when the document is clean or the user confirms. Cancel leaves the
 * design, its undo history and the autosave copy untouched.
 * @returns {boolean}
 */
export function confirmDiscard() {
  return !documentNow().dirty || confirm(t('Discard unsaved changes?'));
}

/** Starts an empty design, after asking before throwing away unsaved changes. */
export function newProject() {
  setEditMode(false);
  if (!confirmDiscard()) return;
  wired().clearComputed();
  setDocId(undefined);
  fileHandle = null;
  setSave({savedAt: null});
  setDocument({doc: withSavedHoop({...initialDocument(), name: 'Untitled design', objects: []})});
  setDocument({history: []});
  setDocument({future: []});
  setSelection({selected: null});
  setSelection({multi: new Set()});
  setDocument({dirty: true});
  wired().render();
  wired().fitHoop();
}

/**
 * Opens the chosen file as the project: SVG, .welcome/.json or ASCII DXF, within the same limits and with the same
 * messages.
 * @param {File} file
 */
export async function openProjectFile(file) {
  try {
    if (file.size > PROJECT_LIMIT) throw Error('Welcome project files are limited to 32 MiB.');
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.svg')) {
      const imported = importSvg(await file.text());
      if (!confirmDiscard()) return;
      acceptProject(imported.doc);
      if (imported.notes.length) wired().toast(imported.notes.join(' '));
    } else if (lower.endsWith('.welcome') || lower.endsWith('.json')) {
      const next = JSON.parse(await file.text());
      if (!confirmDiscard()) return;
      acceptProject(next);
    } else if (lower.endsWith('.dxf')) {
      const dxf = dxfDocument(await file.text());
      if (!confirmDiscard()) return;
      acceptProject(dxf.doc);
      const skipped = Object.entries(/** @type {Record<string, number>} */ (dxf.skipped)).map(([k, n]) => `${n} ${k}`).join(', ');
      const paths = dxf.doc.objects.length;
      wired().toast(`DXF imported: ${paths} path${paths === 1 ? '' : 's'}${skipped ? `; skipped ${skipped}` : ''}`
        + `${dxf.bulged ? `; ${dxf.bulged} arc${dxf.bulged === 1 ? '' : 's'} sewn as straight segments` : ''}.`);
    } else {
      throw Error('Open a .welcome project, SVG or ASCII DXF here. Use Import JEF / VP3 for machine files.');
    }
  } catch (error) {
    wired().toast(/** @type {Error} */ (error).message);
  }
}

/**
 * The machine format a file name names, or null for a file the import does not read.
 * @param {string} name
 * @returns {string|null}
 */
function machineFormat(name) {
  const lower = name.toLowerCase();
  return MACHINE_EXTENSIONS.find(ext => lower.endsWith(`.${ext}`)) ?? null;
}

/**
 * Imports a machine file as a stitch layer: the decoded commands plus the original bytes, in one undo step.
 * @param {File} file
 */
export async function importMachineFile(file) {
  try {
    const format = machineFormat(file.name);
    if (!format) {
      throw Error(t('Choose a .jef, .vp3, .dst, .sew, .pec, .pes, .exp, .hus, .xxx, .dsb, .dsz, .tap, .tbf, .pcs, .shv, .stx, .bro, .emd, .ksm or .10o file.'));
    }
    if (file.size > MACHINE_LIMIT) throw Error('Machine-file imports are limited to 1 MiB so original source bytes fit in the project.');
    const bytes = await file.arrayBuffer();
    const result = await wired().request({type: 'import', format, bytes, fileName: file.name}, [bytes]);
    const layer = makeStitchLayer(result.decoded, format, {
      fileName: file.name,
      sha256: result.sha256,
      size: file.size,
      originalBytesBase64: result.sourceBytesBase64,
    });
    if (!confirmDiscard()) return;
    const committed = wired().transact(() => {
      setDocument({doc: {...documentNow().doc, objects: [...documentNow().doc.objects, layer]}});
      setSelection({selected: layer.id});
    });
    if (committed) {
      wired().toast(`Imported ${file.name} as a ${format.toUpperCase()} stitch layer.`);
      wired().compileNow();
    }
  } catch (error) {
    wired().toast(/** @type {Error} */ (error).message);
  }
}
