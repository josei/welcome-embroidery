// @ts-check
// The stitch panel's row callbacks: the React rows read their stores, and these functions turn a committed field into
// one document edit. app.js keeps the stores and the transaction layer, so nothing here touches the DOM.
import {selState} from './selectionState.js';
import {selectedObject, orderedIds} from './selectionCommands.js';
import {t} from './i18n.js';
import {stitchChoiceActions} from './stitchChoicesState.js';
import {capRowsActions} from './capRowsState.js';
import {blingRowsActions} from './blingRowsState.js';
import {satinEndRowsActions} from './satinEndRowsState.js';
import {runRowsActions, runRowsState} from './runRowsState.js';
import {typeRowsActions} from './typeRowsState.js';
import {raisedRowsActions} from './raisedRowsState.js';
import {fillValuesActions, fillValuesState} from './fillValuesState.js';
import {batchEditLabel, settingEditLabel} from './batchEditLabel.js';
import {BORDER_WIDTH_RANGE, ROW_SPACING_RANGE, inFieldRange, outOfRangeMessage} from './fieldRanges.js';
import {pathRowsActions} from './pathRowsState.js';
import {loopRowsActions} from './loopRowsState.js';
import {radiusActions} from './radiusState.js';
import {cornerRadii} from './engine.js';
import {editor} from './editorContext.js';

/** Wires every row action the stitch panel and its related controls call. */
export function mountRowActions() {
  stitchChoiceActions.choose = (id, value) => {
    if (id === 'fillMethod') {
      const fillMethod = value === 'rows' ? null : value;
      if (selState().multi.size) editor.edit(orderedIds().map(oid => ({op: 'set_object', id: oid, fillMethod})));
      else editor.edit([{op: 'set_settings', fillMethod}]);
      return;
    }
    if (id === 'cap' || id === 'join') {
      const ids = [...selState().multi];
      if (ids.length) {
        editor.edit(ids.map(i => ({op: 'set_object', id: i, [id]: value === 'butt' && id === 'cap' || value === 'round' && id === 'join' ? null : value})));
      }
      return;
    }
    if (id === 'runStyle') {
      if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, runStyle: value === 'single' ? null : value}]);
      return;
    }
    if (id === 'type') {
      const sel = selectedObject();
      if (value === 'satin' && sel && sel.kind !== 'path') {
        editor.toast(t('Satin column needs a path. Convert to path first.'));
        return;
      }
      if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, stitch: value}]);
    }
  };

  capRowsActions.choose = (field, checked) => {
    if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, applique: checked ? true : null}]);
  };

  runRowsActions.commit = (field, text) => {
    if (field === 'borderWidth') {
      if (!inFieldRange(text, BORDER_WIDTH_RANGE)) {
        editor.toast(outOfRangeMessage('Border width', BORDER_WIDTH_RANGE, runRowsState.get().borderWidth));
        return false;
      }
      const ids = [...selState().multi];
      if (ids.length) editor.edit(ids.map(id => ({op: 'set_object', id, borderWidth: Number(text) > 0 ? Number(text) : null})));
      return;
    }
    if (selState().selected) {
      editor.edit([
        {op: 'set_object', id: selState().selected, [field]: field ===
        'lengthVariance' ? (Math.max(0, Math.min(50, Number(text) || 0)) / 100 || null) : (text === '' ? null : Number(text))}]);
    }
  };

  runRowsActions.choose = (field, value) => {
    if (field === 'borderThread') {
      const object = selectedObject();
      if (object) editor.edit([{op: 'set_object', id: object.id, borderThread: value}]);
      return;
    }
    if (field === 'border') {
      const object = selectedObject();
      if (object) editor.edit([{op: 'set_object', id: object.id, border: value}]);
      return;
    }
    if (field === 'stagger') {
      const stagger = Number(value);
      if (selState().multi.size) editor.edit(orderedIds().map(oid => ({op: 'set_object', id: oid, stagger})));
      else editor.edit([{op: 'set_settings', stagger}]);
      return;
    }
    if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, underpath: value ? null : false}]);
  };

  radiusActions.commit = (field, text) => {
    if (field === 'radius') {
      if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, radius: Number(text) > 0 ? Number(text) : null}]);
      return;
    }
    const object = selectedObject();
    if (!object || object.kind !== 'rect') return;
    const radii = /** @type {any[]} */ (cornerRadii(/** @type {any} */ (object))), index = ['radiusTL', 'radiusTR', 'radiusBR', 'radiusBL'].indexOf(field);
    radii[index] = Math.max(0, Math.min(500, Number(text) || 0));
    editor.edit([{op: 'set_object', id: object.id, radii}]);
  };

  loopRowsActions.choose = (field, value) => {
    if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, [field]: value}]);
  };

  pathRowsActions.choose = (field, checked) => {
    const object = selectedObject();
    if (!object) return;
    if (field === 'closed') {
      editor.edit([{op: 'set_path', id: object.id, closed: checked}, ...(checked ? [{op: 'set_object', id: object.id, stitch: 'fill'}] : [])]);
      return;
    }
    editor.edit([{op: 'set_path', id: object.id, smooth: checked}]);
  };

  fillValuesActions.commit = (field, text) => {
    if (field === 'spacing' && !inFieldRange(text, ROW_SPACING_RANGE)) {
      editor.toast(outOfRangeMessage('Row spacing', ROW_SPACING_RANGE, fillValuesState.get().spacing));
      return false;
    }
    // A multi-selection (from the list's Shift or Ctrl clicks, or the canvas) gets the value on every selected object.
    const ids = selState().multi.size ? orderedIds() : selState().selected ? [selState().selected] : [];
    // A batch across several objects is one undo step, named for the field and the count; the document setting, with nothing
    // selected, is named for the field.
    editor.edit(ids.length ? ids.map(id => ({op: 'set_object', id, [field]: Number(text)})) : [{op: 'set_settings', [field]: Number(text)}],
      undefined, undefined, ids.length ? batchEditLabel(field, ids.length) : settingEditLabel(field));
  };

  raisedRowsActions.choose = (field, checked) => {
    if (
      selState().selected) editor.edit([
      {op: 'set_object', id: selState().selected,
      ...(field === 'fillRaised' || field === 'satinRaised' ? {raised: checked} : field === 'satinButtonhole' ? {buttonhole: checked} :
      {edgeClose: checked})}]);
  };

  raisedRowsActions.commit = (field, text) => {
    if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, [field]: text === '' ? null : Number(text)}]);
  };

  typeRowsActions.commit = (field, text) => {
    if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, [field]: Number(text)}]);
  };

  satinEndRowsActions.commit = (field, text) => {
    if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, [field]: text === '' ? null : Number(text)}]);
  };

  capRowsActions.commit = (field, text) => {
    if (field === 'appliqueWidth') {
      if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, appliqueWidth: Number(text)}]);
      return;
    }
    if (field === 'compensation') {
      if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, compensation: text === '' ? null : Number(text)}]);
      return;
    }
    const object = selectedObject();
    if (object && selState().selNode !== null) editor.edit([{op: 'set_width_at_node', id: object.id, index: selState().selNode, width: Number(text)}]);
  };

  blingRowsActions.choose = (field, value) => {
    if (!selState().selected) return;
    if (field === 'motifPair') {
      editor.edit([{op: 'set_object', id: selState().selected, motifPair: value, ...(value ? {satinWidth: selectedObject()?.satinWidth ?? 4} : {})}]);
      return;
    }
    const next = field === 'blingRings' ? Number(value) : value;
    editor.edit([{op: 'set_object', id: selState().selected, [field]: next}]);
  };
}
