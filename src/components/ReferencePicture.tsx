import {useRef, useSyncExternalStore} from 'react';
import type {ChangeEvent} from 'react';
import {documentState} from '../documentState.js';
import {referenceFieldsState, setReferenceFields} from '../referenceFieldsState.js';
import {interactionState} from '../interactionState.js';
import {t} from '../i18n.js';
import {
  chooseReference,
  commitReferenceField,
  commitReferenceOpacity,
  fitReference,
  loadReference,
  previewReferenceOpacity,
  removeReference,
  toggleReferenceMove,
} from '../referencePicture.js';
import {useDraftInput} from './useDraftInput';
// The reference image panel, rendered by React. Ids match the markup it replaced; the picture itself is ReferenceLayer.
export function ReferencePicture() {
  const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
  const fields = useSyncExternalStore(referenceFieldsState.subscribe, referenceFieldsState.get);
  const interaction = useSyncExternalStore(interactionState.subscribe, interactionState.get);
  const file = useRef<HTMLInputElement>(null);
  const ref = doc.reference;
  const refX = useDraftInput(fields.refX, (text: string) => commitReferenceField('refX', text));
  const refY = useDraftInput(fields.refY, (text: string) => commitReferenceField('refY', text));
  const refW = useDraftInput(fields.refW, (text: string) => commitReferenceField('refW', text));
  const refH = useDraftInput(fields.refH, (text: string) => commitReferenceField('refH', text));
  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (chosen) void loadReference(chosen);
  };
  return (
    <details
      id="secRef"
      className="sec-fold"
      open={fields.refOpen}
      onToggle={e => setReferenceFields({refOpen: e.currentTarget.open})}
    >
      <summary>Reference image</summary>
      <p id="refEmpty" className="sel-hint" hidden={Boolean(ref)}>
        Load a picture to draw over: it is shown under your shapes (never sewn), so you can trace it by hand with the drawing tools.
      </p>
      <input id="refFile" ref={file} type="file" accept="image/*" hidden onChange={pickFile} />
      <div className="btn-row">
        <button type="button" id="refLoad" onClick={() => file.current?.click()}>{t(ref ? 'Replace picture…' : 'Load picture…')}</button>
        <button type="button" id="refRemove" hidden={!ref} onClick={() => removeReference()}>Remove</button>
      </div>
      <div id="refControls" hidden={!ref}>
        <label>
          Opacity (%)
          <input
            id="refOpacity"
            type="range"
            min="5"
            max="100"
            step="5"
            value={Math.round(fields.refOpacity * 100)}
            onInput={e => previewReferenceOpacity(Number(e.currentTarget.value))}
            onPointerUp={e => commitReferenceOpacity(Number(e.currentTarget.value))}
            onKeyUp={e => commitReferenceOpacity(Number(e.currentTarget.value))}
            onBlur={e => commitReferenceOpacity(Number(e.currentTarget.value))}
          />
        </label>
        <label>
          Show the picture
          <input id="refVisible" type="checkbox" checked={fields.refVisible} onChange={e => chooseReference('refVisible', e.target.checked)} />
        </label>
        <label>
          Lock its position
          <input id="refLocked" type="checkbox" checked={fields.refLocked} onChange={e => chooseReference('refLocked', e.target.checked)} />
        </label>
        <div className="xywh">
          <label>X<input id="refX" type="number" step="0.5" {...refX} /></label>
          <label>Y<input id="refY" type="number" step="0.5" {...refY} /></label>
          <label>W<input id="refW" type="number" min="1" step="0.5" {...refW} /></label>
          <label>H<input id="refH" type="number" min="1" step="0.5" {...refH} /></label>
        </div>
        <div className="btn-row">
          <button type="button" id="refFit" onClick={() => fitReference()}>Fit to hoop</button>
          <button
            type="button"
            id="refMove"
            title="Drag the picture on the canvas to position it"
            disabled={fields.refLocked}
            className={interaction.refMoving ? 'armed' : undefined}
            onClick={() => toggleReferenceMove()}
          >
            Move on canvas
          </button>
        </div>
      </div>
    </details>
  );
}
