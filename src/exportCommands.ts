import {documentNow} from './documentState.js';
import {selectedObject} from './selectionCommands.js';
import {exportFormatState} from './exportFormatState.js';
import {EMPTY_EXPORT_REASON, exportDialogState, setExportDialog} from './exportDialogState.js';
import {download, forWorker, safeProjectFilename} from './appHelpers.js';
import {exportAppliqueTemplates, exportPrintTemplate, exportSvg, jefWarnings, sewingWorksheet} from './engine.js';
import {exportDxf} from './dxf.js';
import {t} from './i18n.js';

/** The compiled plan, as the worksheet and the simulation read it. */
type ExportPlan = Parameters<typeof sewingWorksheet>[1];

/** The formats that are a stitch plan for a machine, and so the ones the worksheet box applies to. */
export const MACHINE_FORMATS = ['jef', 'vp3', 'dst', 'exp', 'pec', 'pes', 'pes6', 'sew', 'u01', 'xxx', 'tbf'];

/** What the export dialog needs from the editor, supplied by app.js. */
export interface ExportApi {
  /** Sends one export job to the stitch worker. */
  request(data: Record<string, unknown>): Promise<{bytes: BlobPart; plan: ExportPlan}>;
  /** Loads the fonts the export needs before it runs. */
  ensureFonts(): Promise<void>;
  toast(message: string, kind?: 'status' | 'error'): void;
  render(): void;
  /** Makes the compiled plan the one the simulation and the worksheet use. */
  setPlan(plan: ExportPlan): void;
}

let api: ExportApi | null = null;

/** The wired editor commands. app.js calls configureExportCommands before the Export button can export. */
function wired(): ExportApi {
  if (!api) throw Error('The export commands are not wired.');
  return api;
}

/** Wires the export commands, once. */
export function configureExportCommands(next: ExportApi) {
  api = next;
}

/** Opens the export dialog; the worksheet row follows the format it reads from the store. */
export function openExportDialog() {
  setExportDialog({open: true});
}

/** The file name stem an export is built on: the project name without its .welcome extension. */
function exportBase(): string {
  return safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i, '');
}

/** The file name an export of this format downloads as, so the dialog can show it before the download. */
export function exportFileName(format: string): string {
  const base = exportBase();
  if (format === 'dxf') return `${base}.dxf`;
  if (format === 'applique-print') return `${base}-applique-templates.svg`;
  if (format === 'print') return `${base}-template.svg`;
  if (format === 'svg') return `${base}.svg`;
  return `${base}.${format === 'pes6' ? 'pes' : format}`;
}

/** How long one export may take, from the click to the download, before the dialog reports that it did not finish. */
export const EXPORT_TIMEOUT_MS = 10_000;

/**
 * Exports the document in the chosen format, from the Compile & download button. The dialog stays open on any failure
 * and says why in its own text (the toast sits beneath the modal dialog, so it is not the place for it). A success closes
 * the dialog. Every attempt ends, with a file or a named error, within EXPORT_TIMEOUT_MS.
 */
export async function exportCurrent() {
  if (exportDialogState.get().busy) return;
  if (!(documentNow().doc.objects ?? []).length) { setExportDialog({error: EMPTY_EXPORT_REASON}); return; }
  const job = {abandoned: false};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      job.abandoned = true;
      reject(Error(`The export did not finish within ${EXPORT_TIMEOUT_MS / 1000} seconds. Try again, or simplify the design.`));
    }, EXPORT_TIMEOUT_MS);
  });
  setExportDialog({busy: true, error: ''});
  try {
    await Promise.race([runExport(job), timeout]);
  } catch (error) {
    if ((error as Error).name !== 'AbortError') setExportDialog({error: (error as Error).message});
  } finally {
    clearTimeout(timer);
    setExportDialog({busy: false});
  }
}

/** One export attempt. Throws on failure; `job.abandoned` is set when the timeout has already reported it. */
async function runExport(job: {abandoned: boolean}) {
  await wired().ensureFonts().catch(() => {});
  if (job.abandoned) return;
  // The store types the document loosely; the engine validates it before any export reads it.
  const doc = documentNow().doc as Parameters<typeof exportDxf>[0];
  const format = exportFormatState.get().format;
  if (format === 'dxf') {
    const result = exportDxf(doc);
    const skipped = Object.values(result.skipped as Record<string, number>).reduce((a, b) => a + b, 0);
    download(result.text, exportFileName('dxf'), 'application/dxf');
    setExportDialog({open: false});
    wired().toast(`DXF exported: ${result.count} path${result.count === 1 ? '' : 's'}`
      + `${skipped ? `; ${skipped} stitch layer${skipped === 1 ? '' : 's'} skipped (no outline)` : ''}.`);
    return;
  }
  if (format === 'applique-print') {
    const svg = exportAppliqueTemplates(doc);
    download(svg, exportFileName('applique-print'), 'image/svg+xml');
    setExportDialog({open: false});
    wired().toast('Appliqué templates exported at 1:1. Print at 100% and check the 10 mm bar before cutting fabric.');
    return;
  }
  if (format === 'print') {
    download(exportPrintTemplate(doc), exportFileName('print'), 'image/svg+xml');
    setExportDialog({open: false});
    wired().toast('Print template exported at 1:1. Print it at 100% and check the 10 mm bar before placing fabric.');
    return;
  }
  if (format === 'svg') {
    download(exportSvg(doc), exportFileName('svg'), 'image/svg+xml');
    setExportDialog({open: false});
    wired().toast('SVG exported (design only, not a stitch plan).');
    return;
  }
  const revision = documentNow().doc.revision;
  const result = await wired().request({
    type: 'export',
    document: forWorker(documentNow().doc),
    format,
    color: selectedObject()?.thread || '#527461',
  });
  if (job.abandoned) return;
  if (result.plan.revision !== revision || revision !== documentNow().doc.revision) {
    throw Error('The document changed during export. Export the current revision again.');
  }
  wired().setPlan(result.plan);
  const chosen = exportFormatState.get().format;
  download(result.bytes, exportFileName(chosen), 'application/octet-stream');
  const dialog = exportDialogState.get();
  const withSheet = MACHINE_FORMATS.includes(chosen) && dialog.withWorksheet;
  if (withSheet) {
    download(sewingWorksheet(doc, result.plan, dialog.worksheetFormat),
      `${exportBase()}-worksheet.${dialog.worksheetFormat === 'svg' ? 'svg' : 'txt'}`,
      dialog.worksheetFormat === 'svg' ? 'image/svg+xml' : 'text/plain');
  }
  wired().render();
  setExportDialog({open: false});
  wired().toast(t('{fmt} exported from revision {n}.', {fmt: chosen.toUpperCase(), n: result.plan.revision})
    + (withSheet ? t(' The sewing worksheet is downloaded with it.') : '')
    + jefWarnings(result.plan as Parameters<typeof jefWarnings>[0], chosen).map(w => ' ' + t(w)).join(''));
}
