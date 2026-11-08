// The selection commands shared by the toolbar, the context menu and the keyboard: what is selected, selecting,
// copying, pasting, nudging, selecting everything and deleting. The canvas calls the same helpers through app.js.
import {clipboardNow, setClipboard} from './clipboardState.js';
import {documentNow, setDocument} from './documentState.js';
import {editModeNow, setEditMode} from './editModeState.js';
import {selState, setSelection} from './selectionState.js';
import {clone} from './appHelpers.js';
import {copyName} from './objectNames.js';

/** The document fields these commands read and change. The engine stores objects as plain records. */
export interface SelectionObject {
  /** The engine's objects carry more fields than these commands read. */
  [key: string]: unknown;
  id: string;
  kind: string;
  groupId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  text?: string;
  font?: string;
  points?: [number, number][];
  handles?: ({i: [number, number]; o: [number, number]} | null)[];
  holes?: [number, number][][];
  along?: {points: [number, number][]};
  visible?: boolean;
  locked?: boolean;
}

/** What these commands need from the editor. app.js calls configureSelectionCommands before any of them run. */
export interface SelectionApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
  /** Runs a change that manages the document itself (paste replaces the whole document). */
  transact(fn: () => void): boolean;
  render(): void;
  toast(message: string): void;
}

let api: SelectionApi | null = null;

function wired(): SelectionApi {
  if (!api) throw Error('The selection commands are not wired.');
  return api;
}

/** Wires the selection commands, once. */
export function configureSelectionCommands(next: SelectionApi) {
  api = next;
}

/** Every object, in document order. */
function objects(): SelectionObject[] {
  return documentNow().doc.objects as SelectionObject[];
}

/** The primary selected object, or undefined when nothing is selected. */
export function selectedObject(): SelectionObject | undefined {
  return objects().find(o => o.id === selState().selected);
}

/** The selected object ids, in document order. */
export function orderedIds(): string[] {
  const selected = selState().multi;
  return objects().map(o => o.id).filter(id => selected.has(id));
}

/** Makes ids the selection, with primary (or the last id) as the primary object. Leaves node editing unless the same single object stays selected. */
export function selectIds(ids: string[], primary?: string | null) {
  const prev = selState().selected;
  setSelection({multi: new Set(ids)});
  setSelection({selected: primary ?? ids.at(-1) ?? null});
  setSelection({selNode: null});
  setSelection({selNodes: new Set()});
  if (!(ids.length === 1 && selState().selected === prev && editModeNow())) setEditMode(false);
  wired().render();
}

/** Copies the selected objects into the clipboard. Returns false when nothing is selected. */
export function copySelection(): boolean {
  const ids = new Set(orderedIds());
  if (!ids.size) return false;
  setClipboard({clipboard: {objects: objects().filter(o => ids.has(o.id)).map(o => clone(o) as SelectionObject), pastes: 0}});
  wired().toast(`Copied ${ids.size} object${ids.size === 1 ? '' : 's'}.`);
  return true;
}

/** Pastes the clipboard 4 mm further out for each paste, with fresh ids and grouped copies kept grouped. */
export function pasteClipboard() {
  const clip = clipboardNow().clipboard;
  if (!clip) return;
  const pastes = clip.pastes + 1;
  setClipboard({clipboard: {...clip, pastes}});
  const offset = 4 * pastes;
  const remap = new Map<string, string>();
  const made = (clip.objects as SelectionObject[]).map(o => {
    const copy = clone(o) as SelectionObject;
    copy.id = crypto.randomUUID();
    if (o.groupId) {
      if (!remap.has(o.groupId)) remap.set(o.groupId, crypto.randomUUID());
      copy.groupId = remap.get(o.groupId);
    }
    return copy;
  });
  wired().transact(() => {
    const taken = objects().map(o => o.name);
    for (const copy of made) {
      copy.name = copyName(copy.name, copy.kind, taken);
      taken.push(copy.name);
      const dx = offset, dy = offset;
      copy.x += dx;
      copy.y += dy;
      if (copy.kind === 'path') {
        copy.points = copy.points?.map(([x, y]) => [x + dx, y + dy]);
        if (copy.handles) copy.handles = copy.handles.map(h => h && {i: [h.i[0] + dx, h.i[1] + dy], o: [h.o[0] + dx, h.o[1] + dy]});
        if (copy.holes) copy.holes = copy.holes.map(r => r.map(([x, y]) => [x + dx, y + dy]));
      }
      if (copy.along) copy.along.points = copy.along.points.map(([x, y]) => [x + dx, y + dy]);
      setDocument({doc: {...documentNow().doc, objects: [...documentNow().doc.objects, copy]}});
    }
    setSelection({selected: made.at(-1)?.id ?? null});
    setSelection({multi: new Set(made.map(c => c.id))});
    setSelection({selNode: null});
    setEditMode(false);
  });
}

/** Moves the selection: the selected path nodes while editing, otherwise whole objects. */
export function nudge(dx: number, dy: number) {
  const o = selectedObject();
  if (editModeNow() && o?.kind === 'path' && (selState().selNodes.size || selState().selNode !== null)) {
    wired().edit([{op: 'move_path_points', id: o.id, indexes: selState().selNodes.size ? [...selState().selNodes] : [selState().selNode], dx, dy}]);
    return;
  }
  const ids = orderedIds();
  if (ids.length) wired().edit([{op: 'translate', ids, dx, dy}]);
}

/** Selects every visible, unlocked object; while editing a path it selects all of that path's nodes instead. */
export function selectAll() {
  const o = selectedObject();
  if (editModeNow() && o?.kind === 'path' && o.points) {
    setSelection({selNodes: new Set(o.points.map((_, i) => i))});
    setSelection({selNode: null});
    wired().render();
    return;
  }
  selectIds(objects().filter(o => o.visible !== false && !o.locked).map(o => o.id));
}

/** Deletes every selected object and clears the selection. */
export function removeSelected() {
  const ids = [...selState().multi];
  if (!ids.length) return;
  wired().edit(ids.map(id => ({op: 'delete', id})), () => {
    setSelection({selected: null});
    setSelection({multi: new Set()});
    setSelection({selNode: null});
  });
}

/** Selects the shape that clips the selected object, so it can be moved or edited on its own. */
export function selectClipMask() {
  const object = selectedObject();
  const clipId = object?.clipId;
  if (typeof clipId === 'string' && objects().some(o => o.id === clipId)) selectIds([clipId], clipId);
}
