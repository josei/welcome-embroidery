// Canvas lettering editing: opening the on-canvas text box, the live text and width as it is typed, committing or
// cancelling it, and openEdit (Enter on an object). The box itself is CanvasTextEditor.tsx; app.js supplies the editor
// commands through configureCanvasText.
import {measureText, objectBounds} from './engine.js';
import {documentNow} from './documentState.js';
import {setSelection} from './selectionState.js';
import {interactionNow, setInteraction} from './interactionState.js';
import {isRegistryFont} from './fonts.js';

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
  edit(operations: unknown[], after?: () => void): boolean;
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

/** The text as it is saved: registry fonts keep the lines typed, other fonts are single-line uppercase. */
function savedText(font: string | undefined, value: string): string {
  return isRegistryFont(font) ? value : value.replace(/\n/g, ' ').toUpperCase().slice(0, 24);
}

/** Opens the text box over the object: its screen rectangle, its text, and the character limit of its font. */
export function startCanvasText(o: EditableObject) {
  if (interactionNow().canvasText) return;
  const b = objectBounds(o);
  const [x0, y0] = wired().toScreen(b[0], b[1]);
  const [x1, y1] = wired().toScreen(b[2], b[3]);
  setInteraction({
    canvasText: {
      id: o.id,
      original: o.text ?? '',
      maxLength: isRegistryFont(o.font) ? 120 : 24,
      left: Math.max(26, x0 - 8),
      top: Math.max(26, y0 - 10),
      width: Math.max(180, x1 - x0 + 24),
      height: Math.max(44, Math.min(160, y1 - y0 + 20)),
    },
  });
}

/** Updates the object's text and width while typing, so the stitch outlines follow without an undo step. */
export function liveCanvasText(id: string, value: string) {
  const objects: EditableObject[] = documentNow().doc.objects;
  const o = objects.find(v => v.id === id);
  if (!o) return;
  const text = savedText(o.font, value);
  if (!text.trim()) return;
  o.text = text;
  o.w = measureText(text, o.font || 'welcome-mono/1', o.h, o);
  wired().render();
}

/** Puts the original text back and commits the typed text as one command, or only redraws when cancelling. */
export function finishCanvasText(commit: boolean, value: string) {
  const state = interactionNow().canvasText;
  if (!state) return;
  setInteraction({canvasText: null});
  const objects: EditableObject[] = documentNow().doc.objects;
  const o = objects.find(v => v.id === state.id);
  if (!o) return;
  o.text = state.original;
  o.w = measureText(state.original, o.font || 'welcome-mono/1', o.h, o);
  const text = savedText(o.font, value);
  if (commit && text.trim() && text !== state.original) wired().edit([{op: 'set_object', id: state.id, text}]);
  else wired().render();
}

/** Enter on an object: lettering opens its text box, a path edits nodes, and any other shape becomes a path first. */
export function enterEdit(o: EditableObject | undefined) {
  if (!o || o.kind === 'stitch_layer') return;
  if (o.kind === 'text') {
    wired().selectIds([o.id], o.id);
    startCanvasText(o);
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
