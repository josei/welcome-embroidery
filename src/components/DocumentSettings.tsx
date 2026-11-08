import {useState, useSyncExternalStore} from 'react';
import {documentState, settingsActions} from '../documentState.js';
import {useDecimalNumber} from './useDecimalInput';
import {FABRIC_PROFILES} from '../engine.js';
import {setFontsDialogOpen} from '../fontsDialogState.js';
// The document stitch settings panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
// The fabric choice, at the bottom of the inspector: it sets the document's density, underlay, pull compensation and stabilizer tip.
export function FabricSection() {
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const settings = doc.settings ?? {};
 return (
  <section className="fabric-section" aria-labelledby="fabricHeading">
   <h4 id="fabricHeading">Fabric</h4>
   <label className="block">
    <select
     id="fabric"
     aria-label="Fabric"
     value={settings.fabric ?? 'woven'}
     onChange={e => settingsActions.set({fabric: e.target.value})}
     title="Sets the spacing, stitch length, underlay and pull compensation for the fabric, and names a stabilizer. Explicit settings still apply."
    >
     {Object.entries(FABRIC_PROFILES).map(([key, profile]) => <option key={key} value={key}>{profile.label}</option>)}
    </select>
   </label>
   <p className="fabric-hint">Sets density, underlay, pull compensation and the stabilizer tip for the design. Objects with their own values keep them.</p>
  </section>
 );
}

// The document stitch settings panel, rendered by React. Ids match the markup it replaced, because app.js wires them by id.
// The panel is remounted when the selection changes (it sits in a different place in the inspector then), so its open state is kept here.
let documentSettingsOpen = false;
export function DocumentSettings() {
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const [open, setOpen] = useState(documentSettingsOpen);
 const settings = doc.settings ?? {};
 const trim = useDecimalNumber(String(settings.trimMm ?? ''), text => settingsActions.set({trimMm: text === '' ? 5 : Number(text)}), {min: 2, max: 30}, {allowEmpty: true});
 const comp = useDecimalNumber(String(settings.compensation ?? ''), text => settingsActions.set({compensation: Number(text)}), {min: 0, max: 2});
 return (
  <details id="secDoc" className="doc-settings" open={open} onToggle={e => {documentSettingsOpen = e.currentTarget.open; setOpen(e.currentTarget.open);}}><summary>Document stitch settings</summary><label>Tie-in /
    tie-off <input id="ties" type="checkbox" checked={Boolean(settings.ties)} onChange={e =>
    settingsActions.set({ties: e.target.checked})} /></label><label>Trim long jumps <input id="trims" type="checkbox" checked={Boolean(
    settings.trims)} onChange={e => settingsActions.set({trims: e.target.checked})} /></label><label>{"Trim jumps from (mm)"}<input id="trimMm" type="text" inputMode="decimal" min="2" max="30" step="0.5" placeholder="5"
      {...trim.inputProps} title="A jump at least this long is trimmed when Trim long jumps is on (2-30 mm, default 5)" />{trim.note && <span className="clamp-note" role="status">{trim.note}</span>}</label><label title="Underlay: a first layer of stitches under the top stitches that holds the fabric flat. Automatic by default.">Underlay <input
        id="underlay" type="checkbox" checked={Boolean(
    settings.underlay)} onChange={e =>
    settingsActions.set(
    {underlay: e.target.checked})} /></label><button type="button" id="organizeFonts"
      title="List the custom fonts in this document and remove the ones no lettering uses" onClick={(
    ) => setFontsDialogOpen(true)}>Organize fonts</button><label>{"Pull compensation (mm)"}<input id="comp" type="text" inputMode="decimal" min="0" max="2" step="0.05" {...comp.inputProps} />{comp.note && <span className="clamp-note" role="status">{comp.note}</span>}</label></details>
 );
}
