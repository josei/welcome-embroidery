// The stitch panel's edits: every field, select and button runs one operation through the editor's edit command.
import {documentNow, settingsActions} from './documentState.js';
import {selState} from './selectionState.js';
import {setStitchPanel, stitchPanelActions, stitchPanelState} from './stitchPanelState.js';
import {underlayActions} from './underlayState.js';
import {accordionRowsActions} from './accordionRowsState.js';
import {capRowsActions} from './capRowsState.js';
import {t} from './i18n.js';
import {batchEditLabel, settingEditLabel} from './batchEditLabel.js';
import {STITCH_LENGTH_RANGE, inFieldRange, outOfRangeMessage} from './fieldRanges.js';
import type {StitchPanelApi} from './stitchPanel.js';

/** The fields the panel's own actions read from the selected object. */
interface ActionObject {
  id: string;
  kind: string;
  along?: unknown;
  accordionStart?: number | null;
  accordionEnd?: number | null;
}

let api: StitchPanelApi | null = null;

/** The wired editor commands. app.js calls configureStitchPanel before the panel can edit anything. */
function wired(): StitchPanelApi {
  if (!api) throw Error('The stitch panel is not wired.');
  return api;
}

/** Writes one accordion end, keeping the other end in step when it has no value of its own. */
function setAccordion(which: 'accordionStart' | 'accordionEnd', v: number | null) {
  const id = selState().selected;
  if (!id) return;
  // The engine stores objects as plain records; these are the fields these actions read.
  const objects = documentNow().doc.objects as ActionObject[];
  const o = objects.find(x => x.id === id);
  if (v === null) {
    wired().edit([{op: 'set_object', id, accordionStart: null, accordionEnd: null}]);
    return;
  }
  const otherValue = which === 'accordionStart' ? o?.accordionEnd : o?.accordionStart;
  wired().edit([{op: 'set_object', id, [which]: v, [which === 'accordionStart' ? 'accordionEnd' : 'accordionStart']: otherValue ?? v}]);
}

/** Wires the edits the stitch panel runs, once. */
export function configureStitchPanelActions(next: StitchPanelApi) {
  api = next;
  stitchPanelActions.commitValue = (field, text) => {
    if (field === 'stitchLength' && !inFieldRange(text, STITCH_LENGTH_RANGE)) {
      wired().toast(outOfRangeMessage('Stitch length', STITCH_LENGTH_RANGE, stitchPanelState.get().stitchLength));
      return false;
    }
    const v = Number(text);
    if (selState().multi.size) {
      const ids = wired().orderedIds();
      wired().edit(ids.map(id => ({op: 'set_object', id, [field]: v})), undefined, undefined, batchEditLabel(field, ids.length));
    } else wired().edit([{op: 'set_settings', [field]: v}], undefined, undefined, settingEditLabel(field));
  };
  stitchPanelActions.resetFill = () => {
    if (!selState().selected) return;
    wired().edit(wired().orderedIds().map(id => ({
      op: 'set_object',
      id,
      spacing: null,
      angle: null,
      stitchLength: null,
      stagger: null,
      underlayType: null,
      underlayInset: null,
      underlaySpacing: null,
    })));
  };
  stitchPanelActions.chooseThread = value => {
    if (selState().selected) wired().edit([{op: 'set_object', id: selState().selected, thread: value}]);
  };
  stitchPanelActions.chooseFollowPath = value => {
    // The engine stores objects as plain records; these are the fields these actions read.
    const objects = documentNow().doc.objects as ActionObject[];
    const o = objects.find(v => v.id === selState().selected);
    if (!o || o.kind !== 'text') return;
    if (value === '__custom') return;
    if (!value) {
      if (o.along) wired().edit([{op: 'text_off_path', textId: o.id}]);
    } else wired().edit([{op: 'text_on_path', textId: o.id, pathId: value}]);
  };
  stitchPanelActions.chooseBlendThread = value => {
    if (!selState().selected) return;
    wired().edit([{
      op: 'set_object',
      id: selState().selected,
      blendThread: value || null,
      blendPalette: null,
      ...(value ? {} : {blendStart: null, blendEnd: null}),
    }]);
  };
  stitchPanelActions.chooseBlendPalette = (index, value) => {
    if (!selState().selected) return;
    const palette = [...stitchPanelState.get().blendPalette];
    palette[index] = value;
    setStitchPanel({blendPalette: palette});
    const cols = palette.filter(Boolean);
    if (cols.length === 1) {
      wired().toast(t('Choose at least two colors for a palette.'));
      return;
    }
    wired().edit([{
      op: 'set_object',
      id: selState().selected,
      blendPalette: cols.length ? cols : null,
      blendThread: null,
      ...(cols.length ? {} : {blendStart: null, blendEnd: null}),
    }]);
  };
  stitchPanelActions.commitBlendAngle = text => {
    if (selState().selected) {
      wired().edit([{
        op: 'set_object',
        id: selState().selected,
        blendAngle: text === '' ? null : Number(text),
      }]);
    }
  };
  stitchPanelActions.commitBlendRange = (field, text) => {
    if (!selState().selected) return;
    const v = Math.max(0, Math.min(100, Number(text) || 0)) / 100;
    wired().edit([{op: 'set_object', id: selState().selected, [field]: v}]);
  };
  underlayActions.choose = v => {
    if (selState().multi.size) {
      wired().edit(wired().orderedIds().map(id => ({op: 'set_object', id, underlayType: v})));
    } else wired().edit([{op: 'set_settings', underlayType: v}]);
  };
  settingsActions.set = patch => {
    wired().edit([{op: 'set_settings', ...patch}]);
  };
  accordionRowsActions.commit = (field, text) => {
    if (field === 'crossSize') {
      if (selState().selected) {
        wired().edit([{op: 'set_object', id: selState().selected, crossSize: Number(text)}]);
      }
      return;
    }
    setAccordion(field, text === '' ? null : Number(text));
  };
  accordionRowsActions.choose = (field, value) => {
    if (selState().selected) {
      wired().edit([{op: 'set_object', id: selState().selected, accordionEase: value}]);
    }
  };
  capRowsActions.clearWidth = () => {
    if (selState().selected) wired().edit([{op: 'set_object', id: selState().selected, widthStops: null}]);
  };
}
