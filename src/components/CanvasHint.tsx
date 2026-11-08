import {useSyncExternalStore} from 'react';
import {documentState} from '../documentState.js';
import {viewMode} from '../viewMode.js';
import {t} from '../i18n.js';
// The call to action on a blank design's canvas: it shows in the design view while there are no objects, and goes as soon as one exists.
// It never takes pointer events, so the canvas underneath still works.
export function CanvasHint() {
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const view = useSyncExternalStore(viewMode.subscribe, viewMode.get);
 if (view !== 'design' || (doc.objects ?? []).length > 0) return null;
 return <p id="canvasHint" className="canvas-hint">{t('Start here: pick a tool on the left, or open an SVG or embroidery file.')}</p>;
}
