// The canvas toolbar's clip-mask and text-on-path buttons: each one runs one operation through the editor's edit command.
import {documentNow} from './documentState.js';
import {selState, setSelection} from './selectionState.js';
import {selectionToolbarActions} from './selectionToolbarState.js';

/** What the selection toolbar's clip and text buttons need from the editor. */
export interface SelectionToolbarApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void): boolean;
}

/** The object fields these actions read. The engine's objects carry these; the rest of each object is untouched. */
interface ActionObject {
  id: string;
  kind: string;
  along?: unknown;
  clipId?: string;
  mask?: string;
}

let api: SelectionToolbarApi | null = null;

/** The wired editor commands. app.js calls configureSelectionToolbarActions before the buttons can edit anything. */
function wired(): SelectionToolbarApi {
  if (!api) throw Error('The selection toolbar is not wired.');
  return api;
}

/** Every object, in document order. */
function objects(): ActionObject[] {
  // The engine stores objects as plain records; these are the fields these actions read.
  return documentNow().doc.objects as ActionObject[];
}

/** Wires the clip and text-on-path buttons, once. */
export function configureSelectionToolbarActions(next: SelectionToolbarApi) {
  api = next;
  selectionToolbarActions.clip = () => {
    const selected = new Set(selState().multi);
    const ordered = objects().filter(o => selected.has(o.id));
    const top = ordered.at(-1);
    if (ordered.length < 2 || !top) return;
    const below = ordered.slice(0, -1);
    wired().edit([{op: 'clip', ids: below.map(v => v.id), maskId: top.id}], () => {
      setSelection({multi: new Set(below.map(v => v.id))});
      setSelection({selected: below[0].id});
    });
  };
  selectionToolbarActions.unclip = () => {
    const ids = new Set<string>();
    for (const id of selState().multi) {
      const o = objects().find(v => v.id === id);
      if (!o) continue;
      if (o.clipId) ids.add(o.id);
      if (o.mask) for (const v of objects()) if (v.clipId === o.id) ids.add(v.id);
    }
    if (ids.size) wired().edit([{op: 'release_clip', ids: [...ids]}]);
  };
  selectionToolbarActions.textOnPath = () => {
    const picked = [...selState().multi].map(id => objects().find(o => o.id === id)).filter((o): o is ActionObject => Boolean(o));
    const text = picked.find(o => o.kind === 'text');
    const path = picked.find(o => o.kind === 'path');
    if (text && path) {
      wired().edit([{op: 'text_on_path', textId: text.id, pathId: path.id}], () => {
        setSelection({selected: text.id});
        setSelection({multi: new Set([text.id])});
      });
    }
  };
  selectionToolbarActions.textOffPath = () => {
    const ids = [...selState().multi].filter(id => objects().find(o => o.id === id)?.along);
    if (ids.length) wired().edit(ids.map(textId => ({op: 'text_off_path', textId})));
  };
}
