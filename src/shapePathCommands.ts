// The shape and path tools panel's edits: every button runs one operation through the editor's edit command, with the same guards as before.
import {documentNow} from './documentState.js';
import {selState, setSelection} from './selectionState.js';
import {shapePathActions} from './shapePathState.js';
import {countSmallHoles, isClosedShape, isSmallIsland} from './engine.js';
import {t} from './i18n.js';

/** What the shape and path panel needs from the editor. */
export interface ShapePathApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
  /** Shows a short message to the user. */
  toast(message: string, kind?: 'status' | 'error'): void;
  /** Redraws after a selection-only change, which does not go through edit. */
  render(): void;
}

/** The object fields these actions read. The engine's objects carry these; the rest of each object is untouched. */
interface ActionObject {
  id: string;
  kind: string;
  thread: string;
  closed?: boolean;
  clipId?: string;
  mask?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

let api: ShapePathApi | null = null;

/** The wired editor commands. app.js calls configureShapePathActions before the panel can edit anything. */
function wired(): ShapePathApi {
  if (!api) throw Error('The shape and path panel is not wired.');
  return api;
}

/** Every object, in document order. */
function objects(): ActionObject[] {
  // The engine stores objects as plain records; these are the fields these actions read.
  return documentNow().doc.objects as ActionObject[];
}

/** Runs the operations and, when an id is given, leaves that object selected. */
function afterOps(operations: unknown[], sel?: string) {
  wired().edit(operations, () => {
    if (sel) {
      setSelection({selected: sel});
      setSelection({multi: new Set([sel])});
    }
  });
}

/** Wires the edits the shape and path panel runs, once. */
export function configureShapePathActions(next: ShapePathApi) {
  api = next;
  shapePathActions.offset = text => {
    const o = objects().find(v => v.id === selState().selected);
    if (o) afterOps([{op: 'offset', id: o.id, distance: Number(text)}], o.id);
  };
  shapePathActions.strokeToShape = text => {
    const o = objects().find(v => v.id === selState().selected);
    if (o) afterOps([{op: 'stroke_to_shape', id: o.id, width: Number(text)}], o.id);
  };
  shapePathActions.simplify = text => {
    const o = objects().find(v => v.id === selState().selected);
    if (o) afterOps([{op: 'simplify_path', id: o.id, tolerance: Number(text)}], o.id);
  };
  shapePathActions.reverse = () => {
    const ids = objects().filter(o => selState().multi.has(o.id)).filter(o => o.kind === 'path').map(o => o.id);
    if (ids.length) wired().edit(ids.map(id => ({op: 'reverse_path', id})));
  };
  shapePathActions.split = () => {
    const o = objects().find(v => v.id === selState().selected);
    if (o?.kind === 'path' && selState().selNode !== null) {
      afterOps([{op: 'split_path', id: o.id, index: selState().selNode}], o.id);
    } else wired().toast(t('Select a path and one of its nodes first.'));
  };
  shapePathActions.join = () => {
    const ids = objects().filter(o => selState().multi.has(o.id)).filter(o => o.kind === 'path' && !o.closed).map(o => o.id);
    if (ids.length >= 2) afterOps([{op: 'join_paths', ids}], ids[0]);
    else wired().toast(t('Select two or more open paths to join.'));
  };
  shapePathActions.selectSameThread = () => {
    const o = objects().find(v => v.id === selState().selected);
    if (!o) return;
    setSelection({multi: new Set(objects().filter(v => v.thread.toLowerCase() === o.thread.toLowerCase()).map(v => v.id))});
    wired().render();
  };
  shapePathActions.redworkOutline = () => {
    if (selState().selected) wired().edit([{op: 'redwork_outline', id: selState().selected}]);
  };
  shapePathActions.appliqueFromSelection = () => {
    const ids = [...selState().multi];
    const closed = ids.filter(id => isClosedShape(objects().find(o => o.id === id)));
    const skipped = ids.length - closed.length;
    if (closed.length < 2) {
      wired().toast(t('Appliqué from a group needs two or more closed shapes.'), 'error');
      return;
    }
    wired().edit([{op: 'applique_group', ids: closed}], () => {
      if (skipped) wired().toast(t('{n} open objects left as they are.', {n: skipped}));
    });
  };
  shapePathActions.redworkGroup = () => {
    const ids = [...selState().multi];
    if (ids.length) wired().edit([{op: 'redwork_group', ids}]);
  };
  shapePathActions.removeSmallHoles = text => {
    const ids = [...selState().multi].filter(id => {
      const o = objects().find(v => v.id === id);
      return isClosedShape(o) && o?.kind === 'path';
    });
    const maxArea = Number(text);
    if (!(maxArea >= .1 && maxArea <= 20)) {
      wired().toast(t('The hole limit must be 0.1 to 20 mm².'), 'error');
      return;
    }
    const count = ids.reduce((n, id) => n + countSmallHoles(objects().find(o => o.id === id), maxArea), 0);
    if (!count) {
      wired().toast(t('No holes under {a} mm² in the selection.', {a: maxArea}));
      return;
    }
    wired().edit([{op: 'remove_small_holes', ids, maxArea}], () => wired().toast(t('Removed small holes: {n}.', {n: count})));
  };
  shapePathActions.removeSmallIslands = text => {
    const ids = [...selState().multi].filter(id => isClosedShape(objects().find(o => o.id === id)));
    const maxArea = Number(text);
    if (!(maxArea >= .1 && maxArea <= 20)) {
      wired().toast(t('The island limit must be 0.1 to 20 mm².'), 'error');
      return;
    }
    const count = ids.filter(id => isSmallIsland(objects().find(o => o.id === id), maxArea)).length;
    if (!count) {
      wired().toast(t('No islands under {a} mm² in the selection.', {a: maxArea}));
      return;
    }
    wired().edit([{op: 'remove_small_islands', ids, maxArea}], () => wired().toast(t('Removed small islands: {n}.', {n: count})));
  };
  shapePathActions.roundCorners = text => {
    const o = objects().find(v => v.id === selState().selected);
    const r = Number(text);
    if (!o || !(r > 0)) return;
    if (o.kind === 'rect') wired().edit([{op: 'set_object', id: o.id, radius: r}]);
    else if (o.kind === 'path') {
      const nodes = selState().selNodes;
      wired().edit([{op: 'round_corners', id: o.id, radius: r, ...(nodes.size ? {indexes: [...nodes]} : {})}], () => {
        setSelection({selNodes: new Set()});
        setSelection({selNode: null});
      });
    } else wired().toast(t('Rounding works on rectangles and paths. Convert the shape to a path first.'));
  };
}
