import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useModalDialog} from './useModalDialog';
import {useNumberInput} from './useNumberInput';
import {setTraceDialogOpen, traceDialogState} from '../traceDialogState.js';
import {tracePicture} from '../traceCommands.js';
import {t} from '../i18n.js';
// The Trace a picture dialog, rendered by React. Its button opens it through traceDialogState; the choices stay as they
// were left, and the status line shows what happened to the last picture.
export function TraceDialog() {
 const open = useSyncExternalStore(traceDialogState.subscribe, traceDialogState.get);
 const [mode, setMode] = useState<'regions' | 'lines'>('regions');
 const [info, setInfo] = useState('');
 const dialog = useRef<HTMLDialogElement>(null);
 const file = useRef<HTMLInputElement>(null);
 const [colorsText, setColorsText] = useState('6');
 const colorsField = useNumberInput(colorsText, setColorsText, {min: 2, max: 16}, {unit: ''});
 const detail = useRef<HTMLSelectElement>(null);
 const [widthText, setWidthText] = useState('60');
 const widthField = useNumberInput(widthText, setWidthText, {min: 10, max: 200});
 const background = useRef<HTMLInputElement>(null);
 useModalDialog(dialog, open);
 useEffect(() => {
  if (open) setInfo('');
 }, [open]);
 async function trace() {
  const picture = file.current?.files?.[0];
  if (!picture) {
   setInfo(t('Choose a picture first.'));
   return;
  }
  setInfo(t('Tracing…'));
  try {
   const result = await tracePicture(picture, {
    mode,
    colors: Number(colorsText),
    detail: Number(detail.current?.value) || .5,
    widthMm: Number(widthText),
    background: Boolean(background.current?.checked),
   });
   setInfo(result.info);
   if (result.done) setTraceDialogOpen(false);
  } catch (error) {
   setInfo((error as Error).message || t('That picture could not be read.'));
  }
 }
 const lines = mode === 'lines';
 return (
  <dialog id="traceDialog" ref={dialog} onClose={() => setTraceDialogOpen(false)}>
   <form method="dialog" noValidate>
    <h2>{"Trace a picture"}</h2>
    <p className="dlg-note">
     {"Turns a logo, drawing or clip art into filled shapes, one per color region. For photographs use the photo stitch tool instead."}
    </p>
    <label className="agent-field">{"Picture"}<input id="traceFile" ref={file} type="file" accept="image/*" /></label>
    <label>{"Mode"}<select id="traceMode" value={mode} onChange={e => setMode(e.target.value === 'lines' ? 'lines' : 'regions')}>
     <option value="regions">{"Color regions (filled shapes)"}</option>
     <option value="lines">{"Line art (strokes)"}</option>
    </select></label>
    <label id="traceColorsRow" hidden={lines}>{"Colors"}<input id="traceColors" type="number" min="2" max="16" {...colorsField.inputProps} />{colorsField.note && <span className="clamp-note" role="status">{colorsField.note}</span>}</label>
    <label>{"Detail"}<select id="traceDetail" ref={detail} defaultValue="0.5">
     <option value="0.3">{"Fine"}</option>
     <option value="0.5">{"Normal"}</option>
     <option value="1.2">{"Smooth"}</option>
    </select></label>
    <label>{"Width (mm)"}<input id="traceWidth" type="number" min="10" max="200" step="1" {...widthField.inputProps} />{widthField.note && <span className="clamp-note" role="status">{widthField.note}</span>}</label>
    <label id="traceBgRow" hidden={lines}>{"Skip the background color "}<input id="traceBg" ref={background} type="checkbox" defaultChecked={true} /></label>
    <p id="traceInfo" role="status">{info}</p>
    <div className="agent-actions">
     <button type="button" id="traceGo" onClick={() => void trace()}>{"Trace"}</button>
     <button value="cancel">{"Cancel"}</button>
    </div>
   </form>
  </dialog>
 );
}
