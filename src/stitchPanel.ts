import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {setLayout} from './layoutState.js';
import {setSelectionLabels} from './selectionLabelsState.js';
import {setInspectorText} from './inspectorTextState.js';
import {setStitchRow, stitchRowsState} from './stitchRowsState.js';
import {setStitchChoices} from './stitchChoicesState.js';
import {setTypeRows} from './typeRowsState.js';
import {setFillValues} from './fillValuesState.js';
import {setPathRows} from './pathRowsState.js';
import {setRunRows} from './runRowsState.js';
import {setSatinEndRows} from './satinEndRowsState.js';
import {setRaisedRows} from './raisedRowsState.js';
import {setBlingRows} from './blingRowsState.js';
import {setLoopRows} from './loopRowsState.js';
import {setCapRows} from './capRowsState.js';
import {setAccordionRows} from './accordionRowsState.js';
import {setPhotoRows} from './photoRowsState.js';
import {setGuideButtons} from './guideButtonState.js';
import {setActions} from './actionState.js';
import {setRadius} from './radiusState.js';
import {pinState, pinClearState} from './pinState.js';
import {interactionNow, setInteraction} from './interactionState.js';
import {underlayState} from './underlayState.js';
import {cornerRadii, widthAt, nodeFraction} from './engine.js';
import {getFont, isRegistryFont} from './fonts.js';
import {t} from './i18n.js';
import {setStitchPanel, stitchPanelState} from './stitchPanelState.js';
import type {PanelOption, StitchPanelState} from './stitchPanelState.js';
import {configureStitchPanelActions} from './stitchPanelCommands.js';

/** What the stitch panel needs from the editor: an undoable edit, the selected ids in order, and a toast. */
export interface StitchPanelApi {
  edit(operations: unknown[], after?: () => void): boolean;
  orderedIds(): string[];
  toast(message: string): void;
}

interface PhotoValue {
  spacing?: number;
  contrast?: number;
  invert?: boolean;
  thread2?: string;
  thread3?: string;
  thread4?: string;
}

/** The object fields the stitch panel reads. The engine's objects carry these; the rest of each object is untouched. */
interface StitchObject {
  id: string;
  kind: string;
  thread: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  name?: string;
  stitch?: string;
  fillMethod?: string;
  font?: string;
  closed?: boolean;
  smooth?: boolean;
  border?: boolean;
  borderThread?: string | null;
  borderWidth?: number | null;
  underlayType?: string;
  underlayInset?: number;
  underlaySpacing?: number;
  stitchLength?: number | null;
  stagger?: number | null;
  raised?: boolean;
  buttonhole?: boolean;
  motifPair?: boolean;
  motifSpacing?: number;
  motifSize?: number;
  motifShape?: string;
  motifWarp?: string;
  clipId?: string;
  edgeClose?: boolean;
  sequinTwin?: boolean;
  blingShape?: string;
  blingRings?: number;
  beadShape?: string;
  beadTwin?: boolean;
  stoneTurn?: boolean;
  raisedSpacing?: number | null;
  raisedAngle?: number | null;
  laydownSpacing?: number | null;
  crossSize?: number;
  runStyle?: string;
  stemWidth?: number | null;
  lengthVariance?: number;
  endInsetStart?: number | null;
  endInsetEnd?: number | null;
  endInset?: number | null;
  pullRight?: number | null;
  pullLeft?: number | null;
  compensation?: number | null;
  applique?: boolean;
  appliqueWidth?: number;
  satinWidth?: number;
  satinWidthEnd?: number | null;
  spacing?: number | null;
  angle?: number | null;
  photo?: PhotoValue;
  cap?: string;
  join?: string;
  points?: Array<[number, number]>;
  widthStops?: Array<[number, number]>;
  blendThread?: string | null;
  blendPalette?: string[] | null;
  blendAngle?: number | null;
  blendStart?: number | null;
  blendEnd?: number | null;
  along?: {pathId?: string; offset?: number} | null;
  underpath?: boolean;
  mask?: string;
  accordionEase?: string;
  accordionStart?: number | null;
  accordionEnd?: number | null;
  guide?: unknown;
  radius?: number;
  startAt?: unknown;
  endAt?: unknown;
}

interface PanelSettings {
  spacing: number;
  angle: number;
  stitchLength?: number;
  stagger?: number;
  underlay?: boolean;
  underlayType?: string;
}

/** Wires the edits the stitch panel runs. app.js calls this once, before the first render. */
export function configureStitchPanel(next: StitchPanelApi) {
  configureStitchPanelActions(next);
  syncStitchPanel();
}

/** The selected object, typed with the fields the panel reads. */
function selectedObject(): StitchObject | undefined {
  // The engine stores objects as plain records; these are the fields the panel reads.
  const objects = documentNow().doc.objects as StitchObject[];
  return objects.find(o => o.id === selState().selected);
}

/** The engine's document objects, typed with the fields the panel reads. */
function panelObjects(): StitchObject[] {
  // The engine stores objects as plain records; these are the fields the panel reads.
  return documentNow().doc.objects as StitchObject[];
}

/**
 * Derives every stitch-panel value from the selection and the document: which sections and rows apply, the values and
 * options each field shows, the guide button and which path tools are available. app.js calls it once per render.
 */
export function syncStitchPanel() {
  const objects = panelObjects();
  // The engine stores settings as a plain record; these are the fields the panel reads.
  const settings = documentNow().doc.settings as PanelSettings;
  const picked = objects.filter(o => selState().multi.has(o.id));
  const n = picked.length;
  const o = selectedObject();
  const kind = o?.kind;
  const fillable = picked.some(v => v.stitch === 'fill' &&
    (v.kind === 'rect' || v.kind === 'ellipse' || (v.kind === 'path' && v.closed) ||
      (v.kind === 'text' && getFont(v.font)?.kind === 'outline')));

  setLayout({secTransform: !(n >= 1)});
  setLayout({secStitch: false});
  setLayout({secText: !(n === 1 && kind === 'text')});
  setLayout({secPath: !picked.some(v => ['rect', 'ellipse', 'path'].includes(v.kind))});
  setLayout({secArray: !(n >= 1)});
  setLayout({secOrder: !(n >= 1)});
  setSelectionLabels({hintHidden: n >= 1});
  setSelectionLabels({stitchTitle: n ? 'Stitching' : 'Fill defaults for new objects'});
  setLayout({typeHidden: n === 0 || (n >= 1 && picked.every(v => ['text', 'stitch_layer'].includes(v.kind)))});
  setLayout({threadHidden: n === 0});
  if (n === 0) setStitchRow('satinRow', true);
  {
    const lettered = picked.some(v => v.kind === 'text' && isRegistryFont(v.font));
    setLayout({
      spacingHidden: !(n === 0 || fillable || lettered || picked.some(v => v.stitch === 'satin')),
      spacingLabel: lettered && !fillable ? 'Stitch spacing (mm) · lower = denser' : 'Row spacing (mm)',
    });
  }
  setLayout({angleHidden: !(n === 0 || fillable)});

  const panel: Partial<StitchPanelState> = {};
  const src: Partial<StitchObject> = o ?? {};
  const satinish = picked.some(v => v.stitch === 'satin' ||
    (v.kind === 'text' && getFont(v.font)?.kind === 'stitch'));
  const underlayable = n === 0 || fillable || satinish;

  if (o) {
    setStitchChoices({type: ['run', 'satin', 'motif', 'sequin', 'bead', 'bling'].includes(o.stitch ?? '') ? o.stitch : 'fill'});
    setStitchRow('satinRow', o.stitch !== 'satin');
    setTypeRows({satinWidth: String(o.satinWidth ?? 3)});
    setStitchChoices({satinOff: o.kind !== 'path'});
    setStitchChoices({typeDisabled: o.kind === 'stitch_layer'});
    setFillValues({
      spacing: String(o.spacing ?? settings.spacing),
      angle: String(o.angle ?? settings.angle),
    });
    setStitchRow('fillReset', o.spacing === undefined && o.angle === undefined && o.stitchLength === undefined &&
      o.stagger === undefined && o.underlayType === undefined && o.underlayInset === undefined &&
      o.underlaySpacing === undefined);
    const isPath = o.kind === 'path';
    const canFill = o.kind === 'text' ? getFont(o.font)?.kind === 'outline' : (o.kind !== 'path' || o.closed);
    setStitchRow('pathProps', !isPath);
    setPathRows({closed: Boolean(o.closed), smooth: Boolean(o.smooth), disabled: !isPath});
    setStitchChoices({fillOff: !canFill});
    const borderOff = !(canFill && o.stitch === 'fill');
    setRunRows({border: Boolean(o.border), borderDisabled: borderOff});
    setRunRows({
      borderThread: o.borderThread || o.thread,
      borderThreadDisabled: borderOff || (!o.border && !o.applique),
    });
    setStitchRow('alongRow', !o.along);
  } else {
    setFillValues({spacing: String(settings.spacing), angle: String(settings.angle)});
    setStitchRow('fillReset', true);
    setStitchRow('alongRow', true);
    setStitchRow('satinRow', true);
    setStitchChoices({typeDisabled: false});
    setStitchRow('pathProps', true);
    setRunRows({borderDisabled: true, borderThreadDisabled: true});
  }

  panel.stitchLength = String(src.stitchLength ?? settings.stitchLength ?? 3);
  setRunRows({stagger: String(src.stagger ?? settings.stagger ?? 4)});
  const fillTypes: Array<[string, string]> = [
    ['auto', 'Auto (by size)'],
    ['none', 'None'],
    ['contour', 'Edge walk'],
    ['fill', 'Tatami (90°)'],
    ['laydown', 'Laydown (wide rows)'],
    ['contour+fill', 'Edge walk + tatami'],
  ];
  const satinTypes: Array<[string, string]> = [
    ['auto', 'Auto (by width)'],
    ['none', 'None'],
    ['center', 'Centre run'],
    ['contour', 'Edge walk'],
    ['zigzag', 'Zigzag'],
    ['center+zigzag', 'Centre + zigzag'],
    ['contour+zigzag', 'Edge walk + zigzag'],
  ];
  const types = satinish && !fillable ? satinTypes : fillTypes;
  const cur = src.underlayType ?? (settings.underlay === false ? 'none' : (settings.underlayType ?? 'auto'));
  const shownUnderlay = types.some(t => t[0] === cur) ? cur : 'auto';
  underlayState.set({types: types.map(([value, label]) => ({value, label})), value: shownUnderlay});
  panel.underlayInset = String(src.underlayInset ?? .4);
  panel.underlaySpacing = String(src.underlaySpacing ?? (satinish && !fillable ? 2 : 2.2));
  const showDetails = underlayable && !['none', 'auto', undefined].includes(shownUnderlay);

  {
    const one = Boolean(n === 1 && o && o.kind !== 'text' && o.kind !== 'stitch_layer' && (fillable || o.stitch === 'satin'));
    setStitchRow('pinRow', !one);
    if (!one) pinState.set(null);
    pinClearState.set(Boolean(o && (o.startAt || o.endAt)));
  }
  {
    const rectOnly = Boolean(n === 1 && o?.kind === 'rect');
    setStitchRow('radiusRow', !rectOnly);
    if (rectOnly && o) {
      setRadius({radius: String(o.radius ?? 0)});
      const rr = cornerRadii(o);
      setRadius({radiusTL: String(rr[0]), radiusTR: String(rr[1]), radiusBR: String(rr[2]), radiusBL: String(rr[3])});
    }
    const taper = Boolean(n === 1 && o?.kind === 'path' &&
      (o.stitch === 'satin' || (o.stitch === 'motif' && o.motifPair)));
    setStitchRow('satinEndRow', !taper);
    if (taper && o) setSatinEndRows({satinWidthEnd: String(o.satinWidthEnd ?? '')});
    setRaisedRows({satinRaised: Boolean(o?.raised), satinButtonhole: Boolean(o?.buttonhole)});
    setBlingRows({motifPair: Boolean(o?.motifPair)});
    setStitchRow('motifPairRow', o?.stitch !== 'motif');
    const motifish = ['motif', 'sequin', 'bead', 'bling'].includes(o?.stitch ?? '') ||
      ['motif', 'sequin', 'bling'].includes(o?.fillMethod ?? '');
    const sequin = o?.stitch === 'sequin';
    const bead = o?.stitch === 'bead';
    const blingLike = o?.stitch === 'bling' || o?.fillMethod === 'bling';
    setStitchRow('motifSpacingRow', !motifish);
    setStitchRow('motifSizeRow', !motifish);
    setTypeRows({
      motifSpacing: String(o?.motifSpacing ?? (sequin || o?.fillMethod === 'sequin' || blingLike ? 8 : bead ? 6 : 4)),
    });
    setTypeRows({motifSize: String(o?.motifSize ?? (sequin || o?.fillMethod === 'sequin' ? 3 : bead ? 2 : blingLike ? 4 : 1.6))});
    setStitchRow('motifShapeRow', o?.stitch !== 'motif');
    setStitchRow('edgeCloseRow', !(o?.clipId && ['run', 'satin'].includes(o?.stitch ?? '')));
    setRaisedRows({edgeClose: Boolean(o?.edgeClose)});
    setLoopRows({motifShape: o?.motifShape ?? 'circle'});
    setStitchRow('blingShapeRow', !(o?.stitch === 'bling' || o?.fillMethod === 'bling'));
    setStitchRow('sequinTwinRow', o?.stitch !== 'sequin');
    setBlingRows({sequinTwin: o?.sequinTwin === true});
    setStitchRow('stoneTurnRow', !(o?.stitch === 'bling' &&
      ['square', 'hexagon', 'star', 'baguette', 'marquise', 'pear', 'cushion', 'oval', 'heart', 'teardrop']
        .includes(o?.blingShape ?? 'round')));
    setBlingRows({stoneTurn: o?.stoneTurn !== false});
    setStitchRow('blingRingsRow', !(o?.stitch === 'bling' || o?.fillMethod === 'bling'));
    setStitchRow('beadShapeRow', o?.stitch !== 'bead');
    setBlingRows({beadShape: o?.beadShape ?? 'dash'});
    setStitchRow('beadTwinRow', o?.stitch !== 'bead');
    setBlingRows({beadTwin: o?.beadTwin === true});
    setBlingRows({blingRings: String(o?.blingRings ?? 2)});
    setBlingRows({blingShape: o?.blingShape ?? 'round'});
    const motifAlong = n === 1 && o?.kind === 'path' && o?.stitch === 'motif';
    setStitchRow('motifWarpRow', !(motifAlong ||
      (n === 1 && o?.kind !== 'text' && o?.kind !== 'stitch_layer' && o?.fillMethod === 'motif')));
    setLoopRows({motifAlong: Boolean(motifAlong)});
    setLoopRows({motifWarp: o?.motifWarp ?? 'none'});
  }
  setStitchRow('satinButtonholeRow', o?.stitch !== 'satin' || o?.kind !== 'path' || Boolean(o?.closed));
  setStitchRow('satinRaisedRow', o?.stitch !== 'satin');
  setStitchRow('fillRaisedRow', !(n === 1 && o?.stitch === 'fill' && o?.kind !== 'text'));
  setRaisedRows({fillRaised: Boolean(o?.raised)});
  setStitchRow('raisedSpacingRow', !(n === 1 && o?.stitch === 'fill' && o?.kind !== 'text' && o?.raised));
  if (o) setRaisedRows({raisedSpacing: String(o.raisedSpacing ?? '')});
  setStitchRow('raisedAngleRow', stitchRowsState.get().raisedSpacingRow);
  setStitchRow('laydownSpacingRow', !(n === 1 && o?.stitch === 'fill' &&
    String(o?.underlayType ?? '').includes('laydown')));
  if (o) setRunRows({laydownSpacing: String(o.laydownSpacing ?? '')});
  if (o) setRaisedRows({raisedAngle: String(o.raisedAngle ?? '')});
  const bordered = picked.length > 0 && picked.every(v => v.border) && fillable;
  setStitchRow('borderWidthRow', !bordered);
  if (bordered) setRunRows({borderWidth: String(o?.borderWidth ?? 0)});

  if (n === 1 && o?.kind === 'text') {
    const paths = objects.filter(v => v.kind === 'path');
    const nextOptions: PanelOption[] = [
      {value: '', label: t('Not on a path')},
      ...paths.map(v => ({value: v.id, label: v.name || v.id})),
    ];
    if (o.along && !o.along.pathId) nextOptions.push({value: '__custom', label: t('Custom path')});
    const current = stitchPanelState.get().followPathOptions;
    if (current.map(v => v.value).join('|') !== nextOptions.map(v => v.value).join('|')) {
      panel.followPathOptions = nextOptions;
    }
    panel.followPathValue = o.along ? (o.along.pathId || '__custom') : '';
  }

  {
    const method = o?.fillMethod || 'rows';
    const single = Boolean(n === 1 && o && o.kind !== 'text' && o.kind !== 'stitch_layer');
    const runPick = single && o?.stitch === 'run';
    setStitchRow('crossRow', !(single && fillable && method === 'cross'));
    if (o) setAccordionRows({crossSize: String(o.crossSize ?? 2.5)});
    setStitchRow('runStyleRow', !runPick);
    if (o) setStitchChoices({runStyle: o.runStyle || 'single'});
    setStitchRow('stemWidthRow', !(runPick && o?.runStyle === 'stem'));
    if (o) setRunRows({stemWidth: String(o.stemWidth ?? '')});
    setStitchRow('varianceRow', !(single && fillable && ['rows', 'guided'].includes(method)));
    if (o) setRunRows({lengthVariance: String(Math.round((o.lengthVariance ?? 0) * 100))});
    setStitchRow('appliqueRow', !(single && fillable));
    setCapRows({applique: Boolean(o?.applique)});
    setStitchRow('appliqueWidthRow', !(single && fillable && o?.applique));
    if (o) setCapRows({appliqueWidth: String(o.appliqueWidth ?? 2.5)});
    setStitchRow('compRow', !(single && (fillable || o?.stitch === 'satin')));
    setStitchRow('pullRightRow', !(single && o?.kind === 'path' && o?.stitch === 'satin'));
    setStitchRow('pullLeftRow', stitchRowsState.get().pullRightRow);
    setStitchRow('endInsetStartRow', !(single && o?.kind === 'path' && o?.stitch === 'satin'));
    setStitchRow('endInsetEndRow', !(single && o?.kind === 'path' && o?.stitch === 'satin'));
    if (o) {
      setSatinEndRows({
        endInsetStart: String(o.endInsetStart ?? o.endInset ?? ''),
        endInsetEnd: String(o.endInsetEnd ?? o.endInset ?? ''),
        pullRight: String(o.pullRight ?? ''),
        pullLeft: String(o.pullLeft ?? ''),
      });
    }
    if (o) setCapRows({compensation: String(o.compensation ?? '')});
  }
  {
    const single2 = Boolean(n === 1 && o && o.kind !== 'text' && o.kind !== 'stitch_layer');
    setStitchRow('pinCenter', !(single2 && fillable && o?.fillMethod === 'ripple'));
    setStitchRow('underpathRow', !(single2 && fillable && !o?.photo && !o?.applique &&
      ['rows', undefined].includes(o?.fillMethod)));
    setRunRows({underpath: o?.underpath !== false});
    setStitchRow('maskRow', !(n === 1 && o?.clipId));
    const ph = n === 1 && o?.photo;
    setStitchRow('photoBox', !ph);
    if (ph && o?.photo) {
      setPhotoRows({
        spacing: String(o.photo.spacing ?? .7),
        contrast: String(o.photo.contrast ?? 1.4),
        invert: Boolean(o.photo.invert),
      });
      setPhotoRows({thread2: o.photo.thread2 || '', thread3: o.photo.thread3 || '', thread4: o.photo.thread4 || ''});
      setStitchRow('photoThread3Row', !o.photo.thread2);
      setStitchRow('photoThread4Row', !o.photo.thread3);
    }
  }
  {
    const satinPath = Boolean(n === 1 && o?.kind === 'path' && o?.stitch === 'satin');
    const bw = Number(o?.borderWidth) > 0 && picked.every(v => v.border);
    setStitchRow('capRow', !satinPath && !(n === 1 && o?.kind === 'path' && o?.stitch === 'run' && false));
    setStitchRow('joinRow', !(satinPath || (n >= 1 && bw && fillable)));
    if (o) setStitchChoices({cap: o.cap || 'butt', join: o.join || 'round'});
    const selNode = selState().selNode;
    const nw = Boolean(satinPath && selNode !== null && o && selNode < (o.points?.length ?? 0));
    setStitchRow('nodeWidthRow', !nw);
    if (nw && o && selNode !== null) {
      const path = {
        id: o.id,
        kind: o.kind,
        x: Number(o.x ?? 0),
        y: Number(o.y ?? 0),
        w: Number(o.w ?? 0),
        h: Number(o.h ?? 0),
        points: o.points ?? [],
        thread: o.thread,
        closed: Boolean(o.closed),
        widthStops: o.widthStops,
      };
      setCapRows({nodeWidth: widthAt(path, nodeFraction(path, selNode)).toFixed(1)});
    }
    setStitchRow('widthClearRow', !(satinPath && o?.widthStops));
    const blendable = Boolean(n === 1 && o && fillable && o.kind !== 'text' && o.kind !== 'stitch_layer' && !o.photo);
    setStitchRow('blendRow', !blendable);
    if (blendable && o) {
      panel.blendThread = o.blendThread || '';
      panel.blendPalette = [0, 1, 2, 3].map(k => o.blendPalette?.[k] || '');
      setStitchRow('blendRange', !(o.blendThread || o.blendPalette));
      panel.blendAngle = o.blendAngle === undefined || o.blendAngle === null ? '' : String(o.blendAngle);
      panel.blendStart = String(Math.round((o.blendStart ?? 0) * 100));
      panel.blendEnd = String(Math.round((o.blendEnd ?? 1) * 100));
    }
    const ordered = [...selState().multi]
      .map(id => objects.find(v => v.id === id))
      .filter((v): v is StitchObject => Boolean(v))
      .sort((a, b) => objects.indexOf(a) - objects.indexOf(b));
    const top = ordered.at(-1);
    setActions({clip: !(ordered.length >= 2 && top &&
      (top.kind === 'rect' || top.kind === 'ellipse' || (top.kind === 'path' && top.closed)))});
    setActions({unclip: !ordered.some(v => v.clipId || v.mask)});
  }
  {
    const m = ['contour', 'spiral', 'meander', 'guided', 'cross', 'ripple', 'motif', 'sequin', 'bling']
      .includes(src.fillMethod ?? '') ? src.fillMethod ?? 'rows' : 'rows';
    setStitchChoices({fillMethod: m});
    setStitchRow('methodRow', !fillable || n === 0);
    setStitchRow('accordionStartRow', !(n === 1 && fillable && m === 'rows'));
    setStitchRow('accordionEndRow', !(n === 1 && fillable && m === 'rows'));
    setStitchRow('accordionEaseRow', !(n === 1 && fillable && m === 'rows'));
    if (o) setAccordionRows({accordionEase: String(o.accordionEase ?? 'linear')});
    if (o) setAccordionRows({accordionStart: String(o.accordionStart ?? '')});
    if (o) setAccordionRows({accordionEnd: String(o.accordionEnd ?? '')});
    const g = n === 1 && fillable && m === 'guided';
    setStitchRow('guideRow', !g);
    if (!g) setInteraction({guideDraft: null});
    const armed = Boolean(interactionNow().guideDraft);
    setGuideButtons({clearDisabled: !o?.guide, label: t(armed ? 'Finish guide' : 'Draw guide'), armed});
    setLayout({angleHidden: !(n === 0 || (fillable && m === 'rows'))});
  }
  setStitchRow('stitchLenRow', !(n === 0 || fillable ||
    (n === 1 && o?.stitch === 'run' && o.kind !== 'text' && o.kind !== 'stitch_layer')));
  {
    const mm = src.fillMethod || 'rows';
    setStitchRow('staggerRow', !(n === 0 || (fillable && ['rows', 'guided'].includes(mm))));
  }
  setStitchRow('underlayRow', !underlayable);
  setStitchRow('underlayDetails', !showDetails);

  setLayout({borderHidden: !fillable, borderThreadHidden: !fillable});
  if (n === 0 || (n >= 1 && picked.every(v => v.kind === 'stitch_layer'))) setStitchRow('pathProps', true);
  setInspectorText({heading: n > 1 ? `${n} objects selected` : (o?.name || 'Select an object')});

  panel.pathOffset = !picked.some(v => ['rect', 'ellipse', 'path'].includes(v.kind));
  panel.pathStroke = !picked.some(v => v.kind === 'path');
  panel.pathSimplify = !picked.some(v => v.kind === 'path');
  panel.pathReverse = !picked.some(v => v.kind === 'path');
  panel.pathSplit = !picked.some(v => v.kind === 'path');
  panel.pathJoin = !picked.some(v => v.kind === 'path');

  if (o) {
    let options = stitchPanelState.get().threadOptions;
    if (!options.some(v => v.value.toLowerCase() === o.thread.toLowerCase())) {
      options = [...options, {
        value: o.thread,
        label: o.kind === 'stitch_layer' ? 'Imported · replace all' : 'Custom',
      }];
    }
    panel.threadOptions = options;
    panel.threadValue = o.thread;
  }

  setStitchPanel(panel);
}
