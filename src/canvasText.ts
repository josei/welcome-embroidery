// Canvas lettering editing: opening the on-canvas text box, the live text and width as it is typed, committing or
// cancelling it, and openEdit (Enter on an object). The box itself is CanvasTextEditor.tsx; app.js supplies the editor
// commands through configureCanvasText.
import {measureText, objectBounds, storedText} from './engine.js';
import {documentNow} from './documentState.js';
import {setSelection} from './selectionState.js';
import {interactionNow, setInteraction} from './interactionState.js';
import {isRegistryFont} from './fonts.js';
import {addLabel, editTextLabel} from './addLabel.js';
import {clearComputed} from './compileService.js';
import {newShapeSpot, clearOf} from './newShapePlacement.js';
import {hoopSize} from './hoops.js';

/** The part of a document object the canvas text editor reads and writes. */
export interface EditableObject {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  font?: string;
}

/** What the editor must do for the text box, supplied by app.js. */
export interface CanvasTextApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void, coalesceKey?: string, label?: string): boolean;
  /** Redraws the editor from the current document. */
  render(): void;
  /** Selects the objects and clears the node selection. */
  selectIds(ids: string[], primary?: string | null): void;
  /** Turns path node editing on or off. */
  setEditing(on: boolean): void;
  /** Converts a point in millimetres to canvas pixels. */
  toScreen(x: number, y: number): [number, number];
}

let api: CanvasTextApi | null = null;

/** Wires the editor commands the text box needs. app.js calls it once, after it has created the canvas. */
export function configureCanvasText(next: CanvasTextApi) {
  api = next;
}

/** The wired editor commands. app.js calls configureCanvasText before anything can open the box. */
function wired(): CanvasTextApi {
  if (!api) throw Error('The canvas text editor is not wired.');
  return api;
}

/** The text as it is saved for the font (see storedText). */
function savedText(font: string | undefined, value: string): string {
  return storedText(font, value);
}

/**
 * The undo coalesce key for a lettering object added in this session. Adding it and then typing into its box share the key,
 * so one Undo removes the lettering (or restores the design as it was) instead of stopping at the placeholder.
 */
export function newLetteringKey(id: string): string {
  return `new-lettering:${id}`;
}

/**
 * Moves a freshly typed lettering object into free space when its real size now comes within 4 mm of another object. The first spot
 * is chosen with the placeholder's size, so a longer or shorter word can end up against a neighbour; the same search
 * as a new shape finds the nearest free slot for the final size. When no free slot exists it stays where it is.
 */
function keepClearOfNeighbours(id: string) {
  const doc = documentNow().doc;
  const o: EditableObject | undefined = doc.objects.find((v: EditableObject) => v.id === id);
  if (!o) return;
  const b = objectBounds(o);
  const others = doc.objects.filter((v: EditableObject) => v.id !== id);
  if (clearOf(b, others.map((v: EditableObject) => objectBounds(v)))) return;
  const spot = newShapeSpot(others, hoopSize(doc), b[2] - b[0], b[3] - b[1]);
  if (spot.overlaps) return;
  o.x += spot.x - b[0];
  o.y += spot.y - b[1];
}

/** Opens the text box over the object: its screen rectangle, its text, and the character limit of its font. */
export function startCanvasText(o: EditableObject, fresh = false) {
  if (interactionNow().canvasText) return;
  const b = objectBounds(o);
  const [x0, y0] = wired().toScreen(b[0], b[1]);
  const [x1, y1] = wired().toScreen(b[2], b[3]);
  // The box is centred on the lettering, so its middle sits over the middle of the letters whatever their size. A box
  // anchored to the lettering's left edge pushed its centre past the letters' right edge when the lettering was small.
  const width = Math.max(180, x1 - x0 + 24);
  const height = Math.max(44, Math.min(160, y1 - y0 + 20));
  setInteraction({
    canvasText: {
      id: o.id,
      original: o.text ?? '',
      fresh,
      typed: false,
      maxLength: isRegistryFont(o.font) ? 120 : 24,
      left: Math.max(26, (x0 + x1) / 2 - width / 2),
      top: Math.max(26, (y0 + y1) / 2 - height / 2),
      width,
      height,
    },
  });
  // Redraws the object under the box, so its own drawing and handles are hidden while the box is open.
  wired().render();
}

/** Updates the object's text and width while typing, so the stitch outlines follow without an undo step. */
export function liveCanvasText(id: string, value: string) {
  const objects: EditableObject[] = documentNow().doc.objects;
  const o = objects.find(v => v.id === id);
  if (!o) return;
  // Any input, even deleting back to the placeholder, means the text is the user's rather than the hint it opened with.
  const box = interactionNow().canvasText;
  if (box && box.id === id && !box.typed) setInteraction({canvasText: {...box, typed: true}});
  const text = savedText(o.font, value);
  if (!text.trim()) return;
  o.text = text;
  o.w = measureText(text, o.font || 'welcome-mono/1', o.h, o);
  wired().render();
  // The status line reads the last compiled plan. Dropping it while the text changes shows a pending state rather than the
  // count of the text before the keystroke, and schedules a compile that brings the count up to date.
  clearComputed();
}

/**
 * Puts the original text back and commits the typed text as one command, or only redraws when cancelling.
 * `keyboard` is true when Enter commits the box. Only that commit treats an untouched placeholder as nothing to place:
 * leaving the box by clicking elsewhere keeps the object, so the Properties text field still works on it.
 */
export function finishCanvasText(commit: boolean, value: string, keyboard = false) {
  const state = interactionNow().canvasText;
  if (!state) return;
  setInteraction({canvasText: null});
  const objects: EditableObject[] = documentNow().doc.objects;
  const o = objects.find(v => v.id === state.id);
  if (!o) return;
  // A box just placed that is cancelled, committed with Enter while still the untouched placeholder, or left blank is
  // removed, so opening the tool and pressing Enter places nothing.
  if (state.fresh && (!commit || (keyboard && !state.typed) || !savedText(o.font, value).trim())) {
    wired().edit([{op: 'delete', id: state.id}], () => setSelection({multi: new Set<string>()}), newLetteringKey(state.id));
    return;
  }
  o.text = state.original;
  o.w = measureText(state.original, o.font || 'welcome-mono/1', o.h, o);
  const text = savedText(o.font, value);
  // Typing into a box is its own step, "edit text", so it differs from the "add Text" step that placed the box.
  if (commit && text.trim() && text !== state.original) {
    // A fresh box's typing folds into its add step (see newLetteringKey), so the step is not split.
    if (state.fresh) wired().edit([{op: 'set_object', id: state.id, text}], () => keepClearOfNeighbours(state.id), newLetteringKey(state.id), editTextLabel());
    else wired().edit([{op: 'set_object', id: state.id, text}], undefined, undefined, editTextLabel());
  }
  else wired().render();
}

/** Enter on an object: lettering opens its text box, a path edits nodes, and any other shape becomes a path first. */
export function enterEdit(o: EditableObject | undefined, fresh = false) {
  if (!o || o.kind === 'stitch_layer') return;
  if (o.kind === 'text') {
    wired().selectIds([o.id], o.id);
    startCanvasText(o, fresh);
    return;
  }
  if (o.kind === 'path') {
    wired().selectIds([o.id], o.id);
    wired().setEditing(true);
    wired().render();
    return;
  }
  wired().edit([{op: 'to_path', ids: [o.id]}], () => {
    setSelection({selected: o.id});
    setSelection({multi: new Set([o.id])});
    wired().setEditing(true);
    setSelection({selNode: null});
  });
}
