import {createStore} from './store.js';
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {setStitchRow} from './stitchRowsState.js';

/** How the array repeats the object: in a straight line, around a point, or along a selected path. */
export type ArrayMode = 'linear' | 'radial' | 'along';

/** The array panel's fields, as the text of their inputs. */
export interface ArrayFields {
  mode: ArrayMode;
  count: string;
  stepX: string;
  stepY: string;
  angle: string;
}

export const arrayState = createStore<ArrayFields>({
  mode: 'linear',
  count: '5',
  stepX: '12',
  stepY: '0',
  angle: '360',
});

/** Changes some of the array fields. */
export function setArrayFields(patch: Partial<ArrayFields>) {
  arrayState.set({...arrayState.get(), ...patch});
}

/** Chooses the mode, relabels the step fields and shows the total angle only for radial arrays. */
export function setArrayMode(mode: ArrayMode) {
  setArrayFields({mode});
  setStitchRow('arrAngleRow', mode !== 'radial');
}

/** The objects this panel reads: an id and a kind is all an array needs from the document. */
interface ArrayObject {
  id: string;
  kind: string;
}

/** What the array needs from the editor, supplied by app.js. */
export interface ArrayApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[]): boolean;
  /** Shows a short message to the user. */
  toast(message: string): void;
}

let api: ArrayApi | null = null;

/** Wires the editor commands the array panel needs, once. */
export function configureArray(next: ArrayApi) {
  api = next;
}

/** The wired editor commands. app.js calls configureArray before the button can create an array. */
function wired(): ArrayApi {
  if (!api) throw Error('The array panel is not wired.');
  return api;
}

/** The selected objects, in document order. */
function pickedObjects(): ArrayObject[] {
  // The engine stores objects as plain records; these are the fields this action reads.
  const objects = documentNow().doc.objects as ArrayObject[];
  return objects.filter(o => selState().multi.has(o.id));
}

/**
 * Creates the array the panel's fields describe: linear and radial repeat the selected object, along-path repeats the
 * motif along the other selected path. Selection problems leave the document alone and say what is missing.
 */
export function createArray() {
  const {mode, count: countText, stepX, stepY, angle} = arrayState.get();
  const count = Number(countText);
  const picked = pickedObjects();
  let op: Record<string, unknown>;
  if (mode === 'along') {
    const path = picked.find(o => o.kind === 'path');
    const motif = picked.find(o => o !== path);
    if (!path || !motif || picked.length !== 2) {
      wired().toast('Select the motif and the path to follow (two objects).');
      return;
    }
    op = {op: 'array', id: motif.id, mode: 'along', pathId: path.id, count};
  } else {
    // The engine stores objects as plain records; these are the fields this action reads.
    const objects = documentNow().doc.objects as ArrayObject[];
    const o = objects.find(v => v.id === selState().selected);
    if (!o) {
      wired().toast('Select an object to repeat.');
      return;
    }
    op = mode === 'linear'
      ? {op: 'array', id: o.id, mode: 'linear', count, dx: Number(stepX), dy: Number(stepY)}
      : {op: 'array', id: o.id, mode: 'radial', count, cx: Number(stepX), cy: Number(stepY), angle: Number(angle)};
  }
  wired().edit([op]);
}
