import {documentNow} from './documentState.js';
import {setSelection} from './selectionState.js';
import {hoopSize} from './engine.js';
import {traceImage, traceLineOps, traceLines, traceOps} from './trace.js';
import {t} from './i18n.js';

/** The tracing choices the dialog holds: the mode, the colours to find, the detail and the width to draw it at. */
export interface TraceOptions {
  mode: 'regions' | 'lines';
  colors: number;
  detail: number;
  widthMm: number;
  background: boolean;
}

/** What tracing needs from the editor, supplied by app.js. */
export interface TraceApi {
  /** Runs the traced shapes as one undo step. */
  edit(operations: Record<string, unknown>[], after?: () => void): boolean;
  toast(message: string, kind?: 'status' | 'error'): void;
}

/** What the dialog shows after tracing: the message for its status line, and whether the dialog can close. */
export interface TraceResult {
  info: string;
  done: boolean;
}

let api: TraceApi | null = null;

/** The wired editor commands. app.js calls configureTraceCommands before the Trace button can trace. */
function wired(): TraceApi {
  if (!api) throw Error('The tracing commands are not wired.');
  return api;
}

/** Wires the tracing commands, once. */
export function configureTraceCommands(next: TraceApi) {
  api = next;
}

/**
 * Turns the picture into filled shapes (colour regions) or strokes (line art), selects them as one undo step and toasts
 * what was made. Returns whether the dialog can close and the message its status line should show.
 */
export async function tracePicture(file: File, options: TraceOptions): Promise<TraceResult> {
  // Let the dialog paint "Tracing…" before the picture is read, as the importer always has.
  await new Promise(resolve => setTimeout(resolve, 20));
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(2, Math.round(bitmap.width * scale));
  const h = Math.max(2, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw Error(t('That picture could not be read.'));
  context.drawImage(bitmap, 0, 0, w, h);
  const pixels = context.getImageData(0, 0, w, h).data;
  const doc = documentNow().doc;
  const hoop = hoopSize(doc);
  const widthMm = Math.min(options.widthMm || 60, hoop.w - 6);
  if (options.mode === 'lines') {
    const lines = traceLines(pixels, w, h, {minLength: Math.max(5, w / 70), detail: options.detail >= 1 ? 1.4 : .8});
    if (!lines.paths.length) return {info: t('Nothing to trace: no dark strokes were found.'), done: false};
    if (doc.objects.length + lines.paths.length > 100) {
      return {info: t('The document would exceed 100 objects; trace with fewer colours or delete some objects first.'), done: false};
    }
    // The trace module's JSDoc infers maxHeightMm as null; it reads a number there at run time.
    const traced = traceLineOps(lines, {widthMm, maxHeightMm: hoop.h - 6} as unknown as Parameters<typeof traceLineOps>[1]);
    wired().edit(traced.ops, () => {
      setSelection({multi: new Set(traced.ids)});
      setSelection({selected: traced.ids[0]});
    });
    wired().toast(t('Traced {n} strokes.', {n: traced.ids.length})
      + (lines.dropped ? ' ' + t('{n} small regions were left out.', {n: lines.dropped}) : ''));
    return {info: '', done: true};
  }
  const regions = traceImage(pixels, w, h, {
    colors: options.colors || 6,
    detail: options.detail || .5,
    background: options.background ? 'auto' : 'none',
    minArea: Math.max(6, w * h / 30000),
  });
  if (!regions.regions.length) return {info: t('Nothing to trace: only the background colour was found.'), done: false};
  const traced = traceOps(regions, {widthMm, maxHeightMm: hoop.h - 6} as unknown as Parameters<typeof traceOps>[1]);
  if (doc.objects.length + traced.ids.length > 100) {
    return {info: t('The document would exceed 100 objects; trace with fewer colours or delete some objects first.'), done: false};
  }
  wired().edit(traced.ops, () => {
    setSelection({multi: new Set(traced.ids)});
    setSelection({selected: traced.ids[0]});
  });
  const colours = new Set(regions.regions.map((region: {color: string}) => region.color)).size;
  wired().toast(t('Traced {n} shapes in {c} colours.', {n: traced.ids.length, c: colours})
    + (regions.dropped ? ' ' + t('{n} small regions were left out.', {n: regions.dropped}) : '')
    + (traced.running ? ' ' + t('Thin regions sewn as running outline: {n}.', {n: traced.running}) : ''));
  return {info: '', done: true};
}
