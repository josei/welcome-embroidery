import {t} from './i18n.js';
// @ts-check
// Start/end/ripple points and the guided fill: arm a button, then click the canvas. Each point is stored as a fraction
// of the object's bounding box, so it follows the object when the object changes.
import {interactionNow, setInteraction} from './interactionState.js';
import {pinState, pinActions, pinClearActions} from './pinState.js';
import {selState} from './selectionState.js';
import {selectedObject} from './selectionCommands.js';
import {objectBounds} from './engine.js';
import {editor} from './editorContext.js';

/** Mounts the pin and guided-fill commands and their canvas listeners. */
export function mountPinGuide() {
  const art = /** @type {HTMLElement} */ (document.getElementById('art'));
  const setArmed = (/** @type {boolean} */ on) => {
    art.classList.toggle('art-pin', on);
  };

  pinActions.press = key => {
    pinState.set(pinState.get() === key ? null : key);
    setArmed(Boolean(pinState.get()));
    if (pinState.get()) {
      editor.toast(t(key === 'startAt' ? 'Click the canvas to place the start point.' : key === 'endAt' ? 'Click the canvas to place the end point.' :
        'Click the canvas to place the ripple centre.'));
    }
  };

  pinClearActions.clear = () => {
    if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, startAt: null, endAt: null, rippleCenter: null}]);
  };

  art.addEventListener('pointerdown', e => {
    if (!pinState.get() || e.button !== 0) return;
    const object = selectedObject();
    if (!object) { pinState.set(null); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    const point = editor.canvas.coord(e), box = objectBounds(object);
    const width = box[2] - box[0] || 1, height = box[3] - box[1] || 1, pinKey = String(pinState.get());
    pinState.set(null);
    setArmed(false);
    editor.edit([{op: 'set_object', id: object.id, [pinKey]: [
      Math.max(0, Math.min(1, +((point[0] - box[0]) / width).toFixed(4))),
      Math.max(0, Math.min(1, +((point[1] - box[1]) / height).toFixed(4))),
    ]}]);
  }, true);

  const drawGuide = /** @type {HTMLElement | null} */ (document.getElementById('guideDraw'));
  if (drawGuide) {
    drawGuide.onclick = () => {
      const object = selectedObject();
      if (!object) return;
      const draft = interactionNow().guideDraft;
      if (draft) {
        setInteraction({guideDraft: null});
        setArmed(false);
        if (draft.length >= 2) editor.edit([{op: 'set_object', id: object.id, guide: draft}]);
        else editor.render();
        return;
      }
      setInteraction({guideDraft: []});
      pinState.set(null);
      setArmed(true);
      editor.toast(t('Click points for the guide, then press Finish guide.'));
      editor.render();
    };
  }

  const clearGuide = /** @type {HTMLElement | null} */ (document.getElementById('guideClear'));
  if (clearGuide) {
    clearGuide.onclick = () => {
      if (selState().selected) editor.edit([{op: 'set_object', id: selState().selected, guide: null}]);
    };
  }

  art.addEventListener('pointerdown', e => {
    const draft = interactionNow().guideDraft;
    if (!draft || e.button !== 0) return;
    const object = selectedObject();
    if (!object) { setInteraction({guideDraft: null}); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    const point = editor.canvas.coord(e), box = objectBounds(object);
    const width = box[2] - box[0] || 1, height = box[3] - box[1] || 1;
    if (draft.length < 50) {
      setInteraction({guideDraft: [...draft, [+((point[0] - box[0]) / width).toFixed(4), +((point[1] - box[1]) / height).toFixed(4)]]});
    }
    editor.canvas.drawControls();
  }, true);

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && interactionNow().guideDraft) {
      setInteraction({guideDraft: null});
      setArmed(false);
      editor.render();
    }
  });
}
