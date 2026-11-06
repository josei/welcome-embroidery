// The zoom bar's buttons and percentage. The canvas supplies the functions when it is created, so the buttons work
// before any edit is made and keep working when the viewport changes.
import {createStore} from './store.js';

/** The zoom percentage the bar shows. The canvas sets it as the viewport changes. */
export const zoomPercent = createStore('100%');

/** Sets the shown percentage. */
export function setZoomPercent(text: string) {
  zoomPercent.set(text);
}

/** The zoom bar's buttons. Each calls the canvas function set up by configureZoom. */
export const zoomActions: {
  zoomIn: () => void;
  zoomOut: () => void;
  fitHoop: () => void;
  fitAll: () => void;
  zoom100: () => void;
} = {
  zoomIn() {},
  zoomOut() {},
  fitHoop() {},
  fitAll() {},
  zoom100() {},
};

/** Wires the zoom bar to the canvas. app.js passes it as the canvas's zoomUi callback. */
export function configureZoom(zoomAt: (factor: number) => void, fitHoop: () => void, fitAll: () => void, zoom100: () => void) {
  zoomActions.zoomIn = () => zoomAt(1.25);
  zoomActions.zoomOut = () => zoomAt(1 / 1.25);
  zoomActions.fitHoop = fitHoop;
  zoomActions.fitAll = fitAll;
  zoomActions.zoom100 = zoom100;
}
