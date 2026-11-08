// The inspector side of a render: the transform fields, the status run's text and the design summary, plus the transform
// and pivot commands. TransformPanel.tsx, StatusRun.tsx and InspectorText.tsx render from the stores this writes.
// app.js supplies the editor commands through configureInspector and calls syncInspector once per render.
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {setInspectorText} from './inspectorTextState.js';
import type {SourceInfo} from './inspectorTextState.js';
import {setTransformFields, transformActions} from './transformState.js';
import {setLetteringFields} from './letteringFieldsState.js';
import {pivotActions, pivotState} from './pivotState.js';
import {setStatus} from './statusState.js';
import {syncTextInspector} from './letteringFonts.js';
import {sewTime} from './appHelpers.js';
import {t} from './i18n.js';

/** One object of the engine's document, typed with the fields the inspector reads. */
interface InspectorObject {
  id: string;
  kind: string;
  name?: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  along?: {points: Array<[number, number]>; closed?: boolean; offset?: number};
  source?: {
    format: string;
    metadata?: {name?: string; author?: string};
    fileName: string;
    size: number;
    bounds: number[];
    warnings: string[];
  };
  stitches?: unknown[];
  threads?: unknown[];
}

/** The compiled plan fields the status run and the summary show. */
export interface PlanInfo {
  count: number;
  errors: string[];
  issues: Array<{id: string; message: string}>;
  threadLength: number;
  colors: string[];
}

/** A sewing tip, as the status run counts them. */
interface SewingTip {
  id: string;
  message: string;
}

/** What the inspector needs from the editor, supplied by app.js. */
export interface InspectorApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
  /** Redraws the editor, after the pivot changed. */
  render(): void;
  /** Redraws the canvas after leaving pivot-picking mode. */
  refreshCanvas(): void;
}

let api: InspectorApi | null = null;

/** The wired editor commands. app.js calls configureInspector before the first render. */
function wired(): InspectorApi {
  if (!api) throw Error('The inspector is not wired.');
  return api;
}

/** The selected object, typed with the fields the inspector reads. */
function selectedObject(): InspectorObject | undefined {
  const objects = documentNow().doc.objects as InspectorObject[];
  return objects.find(o => o.id === selState().selected);
}

/** The stitch layer's source file as the inspector shows it, or null when the selection is not a stitch layer. */
function sourceInfo(o: InspectorObject | undefined): SourceInfo | null {
  if (!o || o.kind !== 'stitch_layer' || !o.source) return null;
  const s = o.source;
  return {
    format: t('{fmt} stitch layer', {fmt: s.format.toUpperCase()}),
    meta: s.metadata
      ? [s.metadata.name, s.metadata.author ? t('by {author}', {author: s.metadata.author}) : '']
          .filter(Boolean)
          .join(' · ')
      : '',
    details: [
      `${o.stitches?.length.toLocaleString()} commands · ${o.threads?.length} source threads`,
      `${s.fileName} · ${(s.size / 1024).toFixed(1)} KiB`,
      `Source bounds ${s.bounds.map(v => v.toFixed(1)).join(' × ')} mm`,
    ],
    warnings: s.warnings,
  };
}

/**
 * Writes everything the inspector shows for this render: the selected object's transform and lettering fields, a stitch
 * layer's source details, and the status run's count, issues and design summary.
 */
export function syncInspector({plan, compileError, tips}: {plan: PlanInfo | null; compileError: string; tips: SewingTip[]}) {
  const o = selectedObject();
  setInspectorText({source: sourceInfo(o)});
  if (o) {
    setTransformFields({
      posX: Number(o.x).toFixed(1),
      posY: Number(o.y).toFixed(1),
      sizeW: Number(o.w || 0).toFixed(1),
      sizeH: Number(o.h || 0).toFixed(1),
      rotation: String(Number(o.rotation || 0)),
    });
    setLetteringFields({alongOffset: String(o.along?.offset ?? 0)});
    syncTextInspector(o);
  } else syncTextInspector(null);

  setStatus({
    count: compileError
      ? t('⚠ Can\'t compile: {e}', {e: t(compileError)})
      : plan
        ? `${t('{n} stitches', {n: plan.count.toLocaleString()})} · ${plan.errors.length ? plan.errors[0] : t('compiled')}`
        : documentNow().doc.objects.length
          ? 'Compiling…'
          : 'Nothing to sew yet',
  });
  setStatus({countError: Boolean(compileError) || Boolean(plan?.errors.length)});
  const errs = plan?.issues || [];
  setStatus({
    issuesHidden: errs.length + tips.length === 0,
    issuesText: `⚠ ${[
      errs.length ? t(errs.length === 1 ? '1 issue' : '{n} issues', {n: errs.length}) : '',
      tips.length ? t(tips.length === 1 ? '1 sewing tip' : '{n} sewing tips', {n: tips.length}) : '',
    ]
      .filter(Boolean)
      .join(' · ')}`,
    issuesTitle: [...errs, ...tips].map(i => t(i.message)).join('\n'),
  });
  setInspectorText({
    summary: plan
      ? t('{n} stitches · {m} m estimated thread · {c} thread colors', {
          n: plan.count.toLocaleString(),
          m: (plan.threadLength / 1000).toFixed(1),
          c: plan.colors.length,
        }) +
        ' · ' +
        t('about {t} to sew', {t: sewTime(plan)}) +
        (plan.errors.length ? ' · ' + plan.errors.join(' ') : '')
      : 'No generated stitches.',
  });
}

/**
 * Wires the transform and pivot commands. With a pivot set, the rotation field turns the whole selection by the change
 * about the pivot; without one, each object's own rotation is set.
 */
export function configureInspector(next: InspectorApi) {
  api = next;
  transformActions.commit = (field, text) => {
    if (!selState().selected) return;
    if (field === 'rotation') {
      const v = Number(text);
      if (!Number.isFinite(v)) return;
      const pivot = pivotState.get().pivot;
      if (pivot) {
        const turn = ((v - (Number(selectedObject()?.rotation) || 0)) + 540) % 360 - 180;
        if (turn) {
          wired().edit([{op: 'rotate', ids: [...selState().multi], angle: turn, cx: pivot[0], cy: pivot[1]}]);
        }
        return;
      }
      wired().edit([{op: 'transform', id: selState().selected, rotation: v}]);
      return;
    }
    const key = {posX: 'x', posY: 'y', sizeW: 'width', sizeH: 'height'} as const;
    wired().edit([{op: 'transform', id: selState().selected, [key[field]]: Number(text)}]);
  };
  pivotActions.togglePick = () => {
    const cur = pivotState.get();
    pivotState.set({...cur, picking: !cur.picking});
  };
  pivotActions.reset = () => {
    pivotState.set({pivot: null, picking: false});
    wired().render();
    wired().refreshCanvas();
  };
}
