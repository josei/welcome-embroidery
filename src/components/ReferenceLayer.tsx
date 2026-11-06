import {useEffect, useSyncExternalStore} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {documentState} from '../documentState.js';
import {interactionState} from '../interactionState.js';
import {referenceFieldsState} from '../referenceFieldsState.js';
import {viewMode} from '../viewMode.js';
import {
  cancelReferenceDrag,
  continueReferenceDrag,
  endReferenceDrag,
  startReferenceDrag,
} from '../referencePicture.js';

// The reference picture under the shapes, and the canvas pointer handlers that move it while Move on canvas is on.
export function ReferenceLayer() {
  const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
  const interaction = useSyncExternalStore(interactionState.subscribe, interactionState.get);
  const view = useSyncExternalStore(viewMode.subscribe, viewMode.get);
  const {refOpacity} = useSyncExternalStore(referenceFieldsState.subscribe, referenceFieldsState.get);
  const ref = doc.reference;
  const drag = interaction.refDrag;
  useEffect(() => {
    document.getElementById('art')?.classList.toggle('ref-moving', interaction.refMoving);
  }, [interaction.refMoving]);
  const x = drag?.nx ?? ref?.x, y = drag?.ny ?? ref?.y;
  return (
    <g id="refLayer" pointerEvents="none">
      {ref && ref.visible !== false && view !== 'preview' && (
        <image
          href={ref.data}
          x={x}
          y={y}
          width={ref.w}
          height={ref.h}
          preserveAspectRatio="none"
          opacity={refOpacity}
        />
      )}
    </g>
  );
}

// The canvas handlers: the picture starts dragging on a capture-phase pointerdown, so it beats the canvas's own
// selection and pan tools, and the pointer stays captured until release.
export const referenceCanvasHandlers = {
  onPointerDownCapture(e: ReactPointerEvent<SVGSVGElement>) {
    if (!startReferenceDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
  },
  onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    continueReferenceDrag(e);
  },
  onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    endReferenceDrag(e);
  },
  onPointerCancel(e: ReactPointerEvent<SVGSVGElement>) {
    cancelReferenceDrag(e);
  },
};
