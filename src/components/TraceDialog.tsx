import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
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
 const colors = useRef<HTMLInputElement>(null);
 const detail = useRef<HTMLSelectElement>(null);
 const width = useRef<HTMLInputElement>(null);
 const background = useRef<HTMLInputElement>(null);
 useEffect(() => {
  const element = dialog.current;
  if (!element) return;
  if (open && !element.open) element.showModal();
  if (!open && element.open) element.close();
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
    colors: Number(colors.current?.value) || 6,
    detail: Number(detail.current?.value) || .5,
    widthMm: Number(width.current?.value) || 60,
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
   <form method="dialog">
    <h2>{"Trace a picture"}</h2>
    <p className="dlg-note">
     {"Turns a logo, drawing or clip art into filled shapes, one per colour region. For photographs use the photo stitch tool instead."}
    </p>
    <label className="agent-field">{"Picture"}<input id="traceFile" ref={file} type="file" accept="image/*" /></label>
    <label>{"Mode"}<select id="traceMode" value={mode} onChange={e => setMode(e.target.value === 'lines' ? 'lines' : 'regions')}>
     <option value="regions">{"Colour regions (filled shapes)"}</option>
     <option value="lines">{"Line art (strokes)"}</option>
    </select></label>
    <label id="traceColorsRow" hidden={lines}>{"Colours"}<input id="traceColors" ref={colors} type="number" min="2" max="16" defaultValue="6" /></label>
    <label>{"Detail"}<select id="traceDetail" ref={detail} defaultValue="0.5">
     <option value="0.3">{"Fine"}</option>
     <option value="0.5">{"Normal"}</option>
     <option value="1.2">{"Smooth"}</option>
    </select></label>
    <label>{"Width (mm)"}<input id="traceWidth" ref={width} type="number" min="10" max="200" step="1" defaultValue="60" /></label>
    <label id="traceBgRow" hidden={lines}>{"Skip the background colour "}<input id="traceBg" ref={background} type="checkbox" defaultChecked={true} /></label>
    <p id="traceInfo" role="status">{info}</p>
    <div className="agent-actions">
     <button type="button" id="traceGo" onClick={() => void trace()}>{"Trace"}</button>
     <button value="cancel">{"Cancel"}</button>
    </div>
   </form>
  </dialog>
 );
}
