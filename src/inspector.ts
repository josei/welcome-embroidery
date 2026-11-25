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
import {designCountGlyph, designCountState, issueCount} from './statusCount.js';
import {syncTextInspector} from './letteringFonts.js';
import {sewTime} from './appHelpers.js';
import {t, lang} from './i18n.js';
import {fieldText, formatCount, formatNumber} from './decimalText.js';
import {viewMode} from './viewMode.js';
import type {ThreadTotals} from './threadTotalsState.js';

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

/** The count with its label: an imported layer's count is the export's (or the planned count when no stitch export applies). */
function countLabel(plan: PlanInfo, n: string): string {
  if (plan.exportFormat) return t('{n} stitches in the {f} export', {n, f: plan.exportFormat});
  return t(plan.planned ? '{n} planned stitches' : '{n} stitches', {n});
}

/** The compiled plan fields the status run and the summary show. */
export interface PlanInfo {
  count: number;
  /** True when the count is the planned one (the plan holds an imported layer), not what every export writes. */
  planned?: boolean;
  /** The export format the count is for, when the count is what that export decodes to (an imported layer). */
  exportFormat?: string;
  errors: string[];
  issues: Array<{id: string; message: string}>;
  /** The thread totals of the plan: colours sewn, colour changes and thread length, the same figures the other views show. */
  threads: ThreadTotals;
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
      `${formatCount(o.stitches?.length ?? 0, lang)} commands · ${o.threads?.length} source threads`,
      `${s.fileName} · ${formatNumber(s.size / 1024, lang, 1)} KiB`,
      `Source bounds ${s.bounds.map(v => formatNumber(v, lang, 1)).join(' × ')} mm`,
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

  // The status line shows one state. In the stitch and 3D views the simulation owns it (simulation.js), so this sets it
  // there only when there is no plan or a compile failed.
  const designView = viewMode.get() === 'design';
  // A document with no objects has nothing to sew, whatever the empty plan says: it shows the idle glyph and no number.
  const hasObjects = documentNow().doc.objects.length > 0;
  const countText = compileError
    ? t('⚠ Can\'t compile: {e}', {e: t(compileError)})
    : !hasObjects
      ? 'Nothing to sew yet'
      : !plan
        ? 'Compiling…'
        : plan.errors.length
          ? designView ? `${countLabel(plan, formatCount(plan.count, lang))} · ${t(plan.errors[0])}` : t(plan.errors[0])
          : designView ? `${countLabel(plan, formatCount(plan.count, lang))} · ${t('Ready to sew')}` : null;
  const countState = designCountState({plan, compileError});
  const glyph = designCountGlyph({plan, compileError, hasObjects});
  if (countText !== null) setStatus({count: countText, countFigure: {text: countText, value: plan && hasObjects ? formatCount(plan.count, lang) : '', glyph}});
  setStatus({countError: countState.error});
  const errs = plan?.issues || [];
  setStatus({
    issuesHidden: issueCount({issues: errs, tips}) === 0,
    issuesCount: issueCount({issues: errs, tips}),
    issuesWarning: errs.length > 0,
    issuesText: [
      errs.length ? t(errs.length === 1 ? '1 issue' : '{n} issues', {n: errs.length}) : '',
      tips.length ? t(tips.length === 1 ? '1 sewing tip' : '{n} sewing tips', {n: tips.length}) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    issuesTitle: [...errs, ...tips].map(i => t(i.message)).join('\n'),
  });
  setInspectorText({
    summary: plan
      ? countLabel(plan, formatCount(plan.count, lang)) +
          ' · ' +
          t(lang === 'es' && plan.threads.colours === 1 ? '{m} m estimated thread · {c} color used' : '{m} m estimated thread · {c} colors used', {
            m: formatNumber(plan.threads.lengthMm / 1000, lang, 1),
            c: plan.threads.colours,
          }) +
        ' · ' +
        (lang === 'es' && sewTime(plan) === '1 min' ? t('about 1 min to sew') : t('about {t} to sew', {t: sewTime(plan)})) +
        (plan.errors.length ? ' · ' + plan.errors.map(e => t(e)).join(' ') : '')
      : compileError
        ? t('⚠ Can\'t compile: {e}', {e: t(compileError)})
        : documentNow().doc.objects.length ? 'Compiling…' : 'No generated stitches.',
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
