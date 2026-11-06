import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {batchDocuments, batchPlan} from './engine.js';
import {arrayState} from './arrayState.js';
import {batchNames, batchState, setBatchFields} from './batchState.js';
import {download, forWorker, safeProjectFilename} from './appHelpers.js';
import {t} from './i18n.js';

/** What the batch export needs from the editor, supplied by app.js. */
export interface BatchApi {
  /** Compiles one hooped document to the chosen machine format in the stitch worker. */
  request(data: Record<string, unknown>): Promise<{bytes: BlobPart}>;
  /** Loads the fonts the export needs before it runs. */
  ensureFonts(): Promise<void>;
  /** Shows a short message to the user. */
  toast(message: string): void;
}

/** A document object, typed with the one field the batch exports read. */
interface ExportObject {
  id: string;
  thread?: string;
}

let api: BatchApi | null = null;

/** Wires the editor commands the batch export needs, once. */
export function configureBatchExport(next: BatchApi) {
  api = next;
}

/** The wired editor commands. app.js calls configureBatchExport before the button can export. */
function wired(): BatchApi {
  if (!api) throw Error('The batch export is not wired.');
  return api;
}

/** How many copies the batch holds: one per name, or the array panel's copies count when there are no names. */
function copiesFor(names: string[]): number {
  return names.length || Math.max(1, Math.round(Number(arrayState.get().count)) || 1);
}

/**
 * Writes the fit message under the batch fields for the current document: how many copies fit one hoop and how many
 * hoops they need, or that the design does not fit at all.
 */
export function syncBatchInfo() {
  const copies = copiesFor(batchNames());
  const p = batchPlan(documentNow().doc as Parameters<typeof batchPlan>[0], {copies});
  const info = !p
    ? ''
    : p.perHoop
      ? t('{perHoop} copies fit one {hoop} mm hoop ({cols} × {rows}). {copies} copies need {hoops} hoop(s).', {
        perHoop: p.perHoop,
        hoop: `${p.hoop[0]}×${p.hoop[1]}`,
        cols: p.cols,
        rows: p.rows,
        copies,
        hoops: p.hoopsNeeded,
      })
      : t('The design does not fit in one hoop.');
  // Only a changed message goes to the store, so a render that does not move the counts leaves the panel alone.
  if (info !== batchState.get().info) setBatchFields({info});
}

/**
 * Exports one machine file per hoop: the batch names, or plain copies of the whole design, in the chosen format and the
 * selected object's thread colour, named `<base>-hoop<N>.<ext>`.
 */
export async function exportBatch() {
  const names = batchNames();
  const copies = copiesFor(names);
  let docs;
  try {
    docs = batchDocuments(documentNow().doc as Parameters<typeof batchDocuments>[0], {
      copies,
      names: names.length ? names : null,
    });
  } catch (error) {
    wired().toast((error as Error).message);
    return;
  }
  if (!docs.length) {
    wired().toast(t('The design does not fit in one hoop.'));
    return;
  }
  await wired().ensureFonts().catch(() => {});
  const format = batchState.get().format;
  const base = safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i, '');
  // The engine stores objects as plain records; these are the fields this export reads.
  const objects = documentNow().doc.objects as ExportObject[];
  const color = objects.find(o => o.id === selState().selected)?.thread || '#527461';
  for (const [i, d] of docs.entries()) {
    const result = await wired().request({type: 'export', document: forWorker(d), format, color});
    download(result.bytes, `${base}-hoop${i + 1}.${format === 'pes6' ? 'pes' : format}`, 'application/octet-stream');
  }
  wired().toast(t('{n} {fmt} files exported, one per hoop.', {n: docs.length, fmt: format.toUpperCase()}));
}
