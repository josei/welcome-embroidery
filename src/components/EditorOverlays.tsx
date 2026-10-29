import {KeysDialog} from './KeysDialog';
import {RestoreDialog} from './RestoreDialog';
import {useSyncExternalStore} from 'react';
import {agentLinkState} from '../agentLinkState.js';
import {documentState} from '../documentState.js';
import {bundledFontUsage, customFontUsage} from '../engine.js';
import {getFont} from '../fonts.js';
import {fontsDialogState, setFontsDialogOpen} from '../fontsDialogState.js';
import {SettingsDialog} from './SettingsDialog';
import {ThreadPopover} from './ThreadPopover';
// The dialogs and overlays that sit above the layout. Rendered by React; ids match the markup it replaced, because app.js wires them by id.
export function EditorOverlays() {
 const agent = useSyncExternalStore(agentLinkState.subscribe, agentLinkState.get);
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const fontsOpen = useSyncExternalStore(fontsDialogState.subscribe, fontsDialogState.get);
 const documentReady = Array.isArray(doc.objects) && fontsOpen; // the store starts empty; the lists are worked out when the dialog opens
 const customFonts = documentReady ? customFontUsage(doc) : [], bundledFonts = documentReady ? bundledFontUsage(doc) : [];
 return (
  <>
    <dialog id={"agentDialog"}>
      <form method={"dialog"}>
        <h2>
          {"Connect an AI agent"}
        </h2>
        <p id={"agentStatus"} role={"status"} aria-live={"polite"}>
          {agent.statusText}
        </p>
        <label className={"agent-field"}>
          {"MCP endpoint (private link)"}
          <input id={"agentUrl"} readOnly={true} spellCheck={"false"} value={agent.url} />
        </label>
        <div className={"agent-actions"}>
          <button type={"button"} id={"agentCopy"} disabled={!agent.ready}>
            {"Copy URL"}
          </button>
          <button type={"button"} id={"agentRevoke"} disabled={!agent.ready}>
            {"Revoke & make new link"}
          </button>
        </div>
        <p className={"agent-help"}>
          {"Anyone holding this link can read and edit the design open in this tab, so share it only with your agent. Your"}
          {" design stays in this browser; the server only relays the agent's requests while this tab is open. Closing the"}
          {" tab ends the link. In the agent, use "}
          <code>
            {"documentId: \"live\""}
          </code>
          {", for example: “Use the Welcome MCP to draw a leaf badge with BLOOM lettering on the live document, then expor"}
          {"t JEF.”"}
        </p>
        <button>
          {"Close"}
        </button>
      </form>
    </dialog>
    {" "}
    <div id={"fontPanel"} className={"font-panel"} role={"dialog"} aria-label={"Choose a font"} hidden={true}>
      <input id={"fontSearch"} type={"search"} placeholder={"Search 195 fonts…"} aria-label={"Search fonts"} />
      <div id={"fontChips"} className={"chips"} role={"group"} aria-label={"Font categories"}>
      </div>
      <div id={"fontList"} className={"font-list"} role={"listbox"} aria-label={"Fonts"}>
      </div>
      <div className={"font-foot"}>
        <button type={"button"} id={"fontLoadFile"}>
          {"Load a TrueType file…"}
        </button>
        <input id={"fontFile"} type={"file"} accept={".ttf,font/ttf,application/x-font-ttf"} hidden={true} />
        <span>
          {"Fonts shown with your text · OFL / CC-BY-SA licences listed per font"}
        </span>
      </div>
    </div>
    {" "}
    <dialog id={"fontsDialog"} aria-labelledby={"fontsTitle"} onClose={() => setFontsDialogOpen(false)}>
      <form method={"dialog"}>
        <h2 id={"fontsTitle"}>
          {"Organize fonts"}
        </h2>
        <ul id={"fontsList"}>
          {customFonts.map(f => <li key={"c" + f.id}>{`${f.name}: used by ${f.uses.length} lettering object${f.uses.length === 1 ? '' : 's'}${f.uses.length ? ' (' + f.uses.join(', ') + ')' : ''}`}</li>)}
          {bundledFonts.map(f => <li key={"b" + f.id}>{`${getFont(f.id)?.name || f.id} (bundled, not removed): used by ${f.uses.length} lettering object${f.uses.length === 1 ? '' : 's'} (${f.uses.join(', ')})`}</li>)}
        </ul>
        <p id={"fontsEmpty"} className={"sel-hint"} hidden={customFonts.length + bundledFonts.length > 0}>
          {"This document has no custom fonts. Load a .ttf from the font picker to add one."}
        </p>
        <p className={"dlg-note"}>
          {"Fonts used by lettering are kept. Removing a font that lettering uses is not offered."}
        </p>
        <button type={"button"} id={"removeUnusedFonts"} disabled={!customFontUsage(doc).some(f => !f.uses.length)}>
          {"Remove unused fonts"}
        </button>
        <button>
          {"Close"}
        </button>
      </form>
    </dialog>
    <dialog id={"traceDialog"}>
      <form method={"dialog"}>
        <h2>
          {"Trace a picture"}
        </h2>
        <p className={"dlg-note"}>
          {"Turns a logo, drawing or clip art into filled shapes, one per colour region. For photographs use the photo sti"}
          {"tch tool instead."}
        </p>
        <label className={"agent-field"}>
          {"Picture"}
          <input id={"traceFile"} type={"file"} accept={"image/*"} />
        </label>
        <label>
          {"Mode"}
          <select id={"traceMode"}>
            <option value={"regions"}>
              {"Colour regions (filled shapes)"}
            </option>
            <option value={"lines"}>
              {"Line art (strokes)"}
            </option>
          </select>
        </label>
        <label id={"traceColorsRow"}>
          {"Colours"}
          <input id={"traceColors"} type={"number"} min={"2"} max={"16"} defaultValue={"6"} />
        </label>
        <label>
          {"Detail"}
          <select id={"traceDetail"} defaultValue={"0.5"}>
            <option value={"0.3"}>
              {"Fine"}
            </option>
            <option value={"0.5"}>
              {"Normal"}
            </option>
            <option value={"1.2"}>
              {"Smooth"}
            </option>
          </select>
        </label>
        <label>
          {"Width (mm)"}
          <input id={"traceWidth"} type={"number"} min={"10"} max={"200"} step={"1"} defaultValue={"60"} />
        </label>
        <label id={"traceBgRow"}>
          {"Skip the background colour "}
          <input id={"traceBg"} type={"checkbox"} defaultChecked={true} />
        </label>
        <p id={"traceInfo"} role={"status"}>
        </p>
        <div className={"agent-actions"}>
          <button type={"button"} id={"traceGo"}>
            {"Trace"}
          </button>
          <button value={"cancel"}>
            {"Cancel"}
          </button>
        </div>
      </form>
    </dialog>
    <KeysDialog />
    <SettingsDialog />
    <RestoreDialog />
    <ThreadPopover />
    <dialog id={"exportDialog"}>
      <form method={"dialog"}>
        <h2>
          {"Export embroidery"}
        </h2>
        <select id={"format"}>
          <option value={"jef"}>
            {"JEF · Janome"}
          </option>
          <option value={"vp3"}>
            {"VP3 · Pfaff"}
          </option>
          <option value={"dst"}>
            {"DST · Tajima (widely supported)"}
          </option>
          <option value={"exp"}>
            {"EXP · Melco"}
          </option>
          <option value={"pec"}>
            {"PEC · Brother"}
          </option>
          <option value={"pes"}>
            {"PES · Brother (v1)"}
          </option>
          <option value={"pes6"}>
            {"PES · Brother (v6)"}
          </option>
          <option value={"sew"}>
            {"SEW · Janome (native)"}
          </option>
          <option value={"u01"}>
            {"U01 · Barudan"}
          </option>
          <option value={"xxx"}>
            {"XXX · Singer"}
          </option>
          <option value={"tbf"}>
            {"TBF · Tajima"}
          </option>
          <option value={"col"}>
            {"COL · thread colour list"}
          </option>
          <option value={"edr"}>
            {"EDR · thread colour list (binary)"}
          </option>
          <option value={"svg"}>
            {"SVG · vector design (Inkscape)"}
          </option>
          <option value={"print"}>
            {"Print template · 1:1 SVG (placement sheet)"}
          </option>
          <option value={"applique-print"}>
            {"Appliqué templates · 1:1 SVG"}
          </option>
          <option value={"dxf"}>
            {"DXF · paths (CAD)"}
          </option>
        </select>
        <label id={"worksheetRow"} className={"check-row"} hidden={true}>
          <input type={"checkbox"} id={"withWorksheet"} />
          {" Also download the sewing worksheet "}
          <select id={"withWorksheetFormat"} aria-label={"Worksheet format for the download"}>
            <option value={"text"}>
              {"Text (.txt)"}
            </option>
            <option value={"svg"}>
              {"SVG (printable)"}
            </option>
          </select>
        </label>
        <button id={"download"}>
          {"Compile & download"}
        </button>
        <button>
          {"Cancel"}
        </button>
        <p>
          {"Check hoop and thread choices for your machine and materials."}
        </p>
      </form>
    </dialog>
    <div id={"toast"} role={"status"}>
    </div>
  </>
 );
}
