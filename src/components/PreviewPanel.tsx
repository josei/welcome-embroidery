import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {previewActions, previewState} from '../previewState.js';
// The hint under the 3D preview, and its pull estimate, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function PreviewPanel() {
 const preview = useSyncExternalStore(previewState.subscribe, previewState.get);
 return (
  <>
   <div id="previewHint" hidden={!preview.threeD}>{t('Drag to orbit · scroll to zoom · double-click to reset')}</div>
   <div id="previewPull" hidden={!preview.threeD}>
    <label><input type="checkbox" id="showPull" checked={preview.pull} onChange={e => previewActions.choosePull(e.target.checked)} /> {t('Show pull for the fabric')}</label>
    <p id="pullNote" hidden={!preview.pull} role="status">{preview.note}</p>
   </div>
  </>
 );
}
