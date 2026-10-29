import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {previewActions, previewState, type PreviewView} from '../previewState.js';
const VIEWS: [PreviewView, string][] = [['front', 'Front ¾'], ['close', 'Close-up'], ['turntable', 'Turntable']];
// The hint under the 3D preview, its view choice and loupe, and its pull estimate, rendered by React.
// Ids match the markup it replaced, because app.js wires them by id.
export function PreviewPanel() {
 const preview = useSyncExternalStore(previewState.subscribe, previewState.get);
 return (
  <>
   <div id="previewHint" hidden={!preview.threeD}>{t('Drag to orbit · scroll to zoom · double-click to reset')}</div>
   <div id="previewView" hidden={!preview.threeD} role="group" aria-label={t('3D view')}>
    {VIEWS.map(([view, label]) => (
     <button key={view} type="button" aria-pressed={preview.view === view} onClick={() => previewActions.chooseView(view)}>{t(label)}</button>
    ))}
    <button type="button" aria-pressed={preview.loupe} onClick={() => previewActions.chooseLoupe(!preview.loupe)}>{t('Loupe 8×')}</button>
   </div>
   <div id="previewPull" hidden={!preview.threeD}>
    <label><input type="checkbox" id="showPull" checked={preview.pull} onChange={e => previewActions.choosePull(e.target.checked)} /> {t('Show pull for the fabric')}</label>
    <p id="pullNote" hidden={!preview.pull} role="status">{preview.note}</p>
   </div>
  </>
 );
}
