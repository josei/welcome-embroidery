// Keeps the toolbar's availability stores in step with the selection and the document: which buttons are hidden or
// disabled, whether align and distribute apply, and which path-node buttons show. The components read these stores;
// this module owns the rules, so nothing in app.js has to recompute them on every render.
import {documentState, documentNow} from './documentState.js';
import {selectionState, selState} from './selectionState.js';
import {setActions} from './actionState.js';
import {alignState} from './alignState.js';
import {selectionToolbarState} from './selectionToolbarState.js';
import {nodeButtonsState} from './nodeButtonsState.js';
import type {SelectionObject} from './selectionCommands.js';

function sync() {
  const selection = selState();
  const document = documentNow();
  const objects = (document.doc.objects ?? []) as SelectionObject[];
  const picked = [...selection.multi].map(id => objects.find(o => o.id === id)).filter((o): o is SelectionObject => Boolean(o));
  const count = selection.multi.size;
  const primary = objects.find(o => o.id === selection.selected);

  alignState.set({align: count < 1, distribute: count < 3});
  setActions({textOnPath: !(picked.length === 2 && picked.some(o => o.kind === 'text') && picked.some(o => o.kind === 'path'))});
  setActions({textOffPath: !picked.some(o => o.along)});
  setActions({group: count < 2});
  setActions({ungroup: !picked.some(o => o.groupId)});
  setActions({editNodes: count !== 1 || primary?.kind === 'stitch_layer'});
  selectionToolbarState.set({subtract: count < 2, union: count < 2, intersect: count < 2, flip: count < 1});
  nodeButtonsState.set({
    add: primary?.kind !== 'path',
    del: selection.selNode === null,
    smooth: selection.selNode === null,
    corner: selection.selNode === null || !primary?.handles?.[selection.selNode],
  });
  setActions({undo: !document.history.length});
  setActions({redo: !document.future.length});
  setActions({duplicate: !selection.selected, remove: !selection.selected});
}

selectionState.subscribe(sync);
documentState.subscribe(sync);
sync();
