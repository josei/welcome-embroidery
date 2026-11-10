// @ts-check
// Copy and paste of an object's stitching style: thread, stitch type and every stitching option, applied to the
// selection as one undo step. KeyboardShortcuts calls these for Ctrl+Alt+C and Ctrl+Alt+V.
import {documentNow} from './documentState.js';
import {setClipboard, clipboardNow} from './clipboardState.js';
import {selState} from './selectionState.js';
import {selectedObject} from './selectionCommands.js';
import {t} from './i18n.js';
import {shortcutLabel} from './shortcutLabels.js';
import {editor} from './editorContext.js';

const STYLE_KEYS = ['thread', 'spacing', 'angle', 'stitchLength', 'stagger', 'underlayType', 'underlayInset', 'underlaySpacing', 'fillMethod', 'crossSize',
  'border', 'borderThread', 'borderWidth', 'join', 'cap', 'blendThread', 'blendPalette', 'blendStart', 'blendEnd', 'blendAngle', 'compensation', 'runStyle',
  'lengthVariance', 'underpath'];
const FILL_ONLY =
  new Set(['spacing', 'angle', 'stagger', 'fillMethod', 'crossSize', 'blendThread', 'blendPalette', 'blendStart', 'blendEnd', 'blendAngle', 'lengthVariance',
  'underpath', 'border', 'borderThread', 'borderWidth']);

/** Copies the selected object's stitching style into the clipboard. */
export function copyStyle() {
  const object = selectedObject();
  if (!object || selState().multi.size !== 1) {
    editor.toast(t('Select one object to copy its style from.'));
    return;
  }
  setClipboard({styleClip: {
    stitch: object.stitch,
    kind: object.kind,
    values: Object.fromEntries(STYLE_KEYS.filter(k => object[k] !== undefined).map(k => [k, object[k]])),
  }});
  editor.toast(t('Style copied. Paste it onto other objects with {shortcut}.', {shortcut: shortcutLabel([{mod: true, alt: true, key: 'V'}])}));
}

/** Pastes the copied style onto every selected object. */
export function pasteStyle() {
  if (!clipboardNow().styleClip) {
    editor.toast(t('Copy a style first ({shortcut}).', {shortcut: shortcutLabel([{mod: true, alt: true, key: 'C'}])}));
    return;
  }
  /** @type {any[]} */
  const operations = [];
  const styleClip = clipboardNow().styleClip;
  if (!styleClip) return;
  for (const id of [...selState().multi]) {
    const object = documentNow().doc.objects.find((/** @type {any} */ v) => v.id === id);
    if (!object || object.kind === 'stitch_layer' || object.id === undefined) continue;
    const op = /** @type {any} */ ({op: 'set_object', id: object.id});
    const stitch = styleClip.stitch === 'satin' && object.kind !== 'path' ? null : styleClip.stitch;
    if (stitch && stitch !== object.stitch && object.kind !== 'text') op.stitch = stitch;
    const willFill = (op.stitch || object.stitch) === 'fill' && object.kind !== 'text' && (object.kind !== 'path' || object.closed);
    for (const key of STYLE_KEYS) {
      if (FILL_ONLY.has(key) && !willFill) {
        if (object[key] !== undefined) op[key] = null;
        continue;
      }
      op[key] = styleClip.values[key] !== undefined
        ? styleClip.values[key]
        : (object[key] !== undefined ? null : undefined);
      if (op[key] === undefined) delete op[key];
    }
    if (object.kind === 'text') for (const key of ['blendThread', 'blendPalette', 'blendStart', 'blendEnd', 'blendAngle']) delete op[key];
    operations.push(op);
  }
  if (operations.length) editor.edit(operations);
}
