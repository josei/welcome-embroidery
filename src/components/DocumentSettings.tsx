import {useSyncExternalStore} from 'react';
import {documentState, settingsActions} from '../documentState.js';
import {useDraftInput} from './useDraftInput';
// The document stitch settings panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
export function DocumentSettings() {
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const settings = doc.settings ?? {};
 const trim = useDraftInput(String(settings.trimMm ?? ''), text => settingsActions.set({trimMm: text === '' ? 5 : Number(text)}));
 return (
  <details id="secDoc" className="doc-settings"><summary>Document stitch settings</summary><label>Tie-in / tie-off <input id="ties" type="checkbox" checked={Boolean(settings.ties)} onChange={e => settingsActions.set({ties: e.target.checked})} /></label><label>Trim long jumps <input id="trims" type="checkbox" checked={Boolean(settings.trims)} onChange={e => settingsActions.set({trims: e.target.checked})} /></label><label>Trim jumps from (mm)<input id="trimMm" type="number" min="2" max="30" step="0.5" placeholder="5" title="A jump at least this long is trimmed when Trim long jumps is on (2-30 mm, default 5)" {...trim} /></label><label>Underlay <input id="underlay" type="checkbox" defaultChecked={true} /></label><label>Fabric<select id="fabric" title="Sets pull compensation, stitch length, stagger and underlay for the fabric. Explicit settings still apply after it."><option value="woven">Woven (default)</option><option value="knit">Knit</option><option value="towel">Towel or fleece</option></select></label><button type="button" id="organizeFonts" title="List the custom fonts in this document and remove the ones no lettering uses">Organize fonts</button><label>Pull compensation (mm)<input id="comp" type="number" min="0" max="2" defaultValue="0.2" step="0.05" /></label></details>
 );
}
