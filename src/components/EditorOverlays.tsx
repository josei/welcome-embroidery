import {useRef, useSyncExternalStore} from 'react';
import {useModalDialog} from './useModalDialog';
import {KeysDialog} from './KeysDialog';
import {MessagesDialog} from './ToastStack';
import {RestoreDialog} from './RestoreDialog';
import {SaveAsDialog} from './SaveAsDialog';
import {TraceDialog} from './TraceDialog';
import {agentLinkState} from '../agentLinkState.js';
import {agentDialogState, copyAgentLink, revokeAgentLink, setAgentDialogOpen} from '../agentDialog.js';
import {EXPORT_FORMATS, exportFormatState, setExportFormat} from '../exportFormatState.js';
import {exportDialogState, setExportDialog} from '../exportDialogState.js';
import {exportCurrent, exportFileName, MACHINE_FORMATS} from '../exportCommands.js';
import {documentState} from '../documentState.js';
import {bundledFontUsage, customFontUsage} from '../engine.js';
import {getFont} from '../fonts.js';
import {fontsDialogState, setFontsDialogOpen} from '../fontsDialogState.js';
import {removeUnusedFonts} from '../fontsDialogCommands.js';
import {SettingsDialog} from './SettingsDialog';
import {ThreadPopover} from './ThreadPopover';
// The dialogs and overlays that sit above the layout. Rendered by React; ids match the markup it replaced, because tests
// and the commands address them.
export function EditorOverlays() {
 const agent = useSyncExternalStore(agentLinkState.subscribe, agentLinkState.get);
 const agentOpen = useSyncExternalStore(agentDialogState.subscribe, agentDialogState.get);
 const exportFormat = useSyncExternalStore(exportFormatState.subscribe, exportFormatState.get);
 const exportDialog = useSyncExternalStore(exportDialogState.subscribe, exportDialogState.get);
 // Why the export cannot run: the design's refusal (such as an object past the hoop) first, else the last export's failure.
 const exportProblem = exportDialog.refusal || exportDialog.error;
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const fontsOpen = useSyncExternalStore(fontsDialogState.subscribe, fontsDialogState.get);
 const documentReady = Array.isArray(doc.objects) && fontsOpen; // the store starts empty; the lists are worked out when the dialog opens
 const customFonts = documentReady ? customFontUsage(doc) : [], bundledFonts = documentReady ? bundledFontUsage(doc) : [];
 const agentDialog = useRef<HTMLDialogElement>(null);
 const fontsDialog = useRef<HTMLDialogElement>(null);
 const exportElement = useRef<HTMLDialogElement>(null);
 const agentUrl = useRef<HTMLInputElement>(null);
 // Each dialog is opened with showModal, which React cannot render; the store says whether it should be open.
 useModalDialog(agentDialog, agentOpen);
 useModalDialog(fontsDialog, fontsOpen);
 useModalDialog(exportElement, exportDialog.open);
 return (
  <>
    <dialog id={"agentDialog"} ref={agentDialog} onClose={() => setAgentDialogOpen(false)}>
      <form method={"dialog"}>
        <h2>
          {"Connect an AI agent"}
        </h2>
        <p id={"agentStatus"} role={"status"} aria-live={"polite"}>
          {agent.statusText}
        </p>
        <label className={"agent-field"}>
          {"MCP endpoint (private link)"}
          <input id={"agentUrl"} ref={agentUrl} readOnly={true} spellCheck={"false"} value={agent.url} onFocus={e => e.target.select()} />
        </label>
        <div className={"agent-actions"}>
          <button
            type={"button"}
            id={"agentCopy"}
            disabled={!agent.ready}
            onClick={async () => { if (!(await copyAgentLink())) agentUrl.current?.select(); }}
          >
            {"Copy URL"}
          </button>
          <button type={"button"} id={"agentRevoke"} disabled={!agent.ready} onClick={() => void revokeAgentLink()}>
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
    <dialog id={"fontsDialog"} ref={fontsDialog} aria-labelledby={"fontsTitle"} onClose={() => setFontsDialogOpen(false)}>
      <form method={"dialog"}>
        <h2 id={"fontsTitle"}>
          {"Organize fonts"}
        </h2>
        <ul id={"fontsList"}>
          {customFonts.map(f =>
            <li key={"c" +
              f.id}>{`${f.name}: used by ${f.uses.length} lettering object${f.uses.length === 1 ? '' : 's'}` +
              `${f.uses.length ? ' (' + f.uses.join(', ') + ')' : ''}`}</li>)}
          {bundledFonts.map(f =>
            <li key={"b" +
              f.id}>{`${getFont(f.id)?.name || f.id} (bundled, not removed): used by ${f.uses.length} lettering ` +
              `object${f.uses.length === 1 ? '' : 's'} (${f.uses.join(', ')})`}</li>)}
        </ul>
        <p id={"fontsEmpty"} className={"sel-hint"} hidden={customFonts.length + bundledFonts.length > 0}>
          {"This document has no custom fonts. Load a .ttf from the font picker to add one."}
        </p>
        <p className={"dlg-note"}>
          {"Fonts used by lettering are kept. Removing a font that lettering uses is not offered."}
        </p>
        <button type={"button"} id={"removeUnusedFonts"} disabled={!customFontUsage(doc).some(f => !f.uses.length)} onClick={() => removeUnusedFonts()}>
          {"Remove unused fonts"}
        </button>
        <button>
          {"Close"}
        </button>
      </form>
    </dialog>
    <TraceDialog />
    <KeysDialog />
    <SettingsDialog />
    <RestoreDialog />
    <SaveAsDialog />
    <ThreadPopover />
    <dialog id={"exportDialog"} ref={exportElement} onClose={() => setExportDialog({open: false})}>
      <form method={"dialog"}>
        <h2>
          {"Export machine file"}
        </h2>
        <select id={"format"} value={exportFormat.format} onChange={e => setExportFormat(e.target.value)}>
          {EXPORT_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <p id={"exportFile"}>
          {"Output file: "}
          <code id={"exportFileName"}>
            {exportFileName(exportFormat.format)}
          </code>
        </p>
        <p id={"exportNotice"}>
          {"Exporting does not save your project. Use Save to keep it as a .welcome file."}
        </p>
        <label id={"worksheetRow"} className={"check-row"} hidden={!MACHINE_FORMATS.includes(exportFormat.format)}>
          <input
            type={"checkbox"}
            id={"withWorksheet"}
            checked={exportDialog.withWorksheet}
            onChange={e => setExportDialog({withWorksheet: e.target.checked})}
          />
          {" Also download the sewing worksheet "}
          <select
            id={"withWorksheetFormat"}
            aria-label={"Worksheet format for the download"}
            value={exportDialog.worksheetFormat}
            onChange={e => setExportDialog({worksheetFormat: e.target.value === 'svg' ? 'svg' : 'text'})}
          >
            <option value={"text"}>
              {"Text (.txt)"}
            </option>
            <option value={"svg"}>
              {"SVG (printable)"}
            </option>
          </select>
        </label>
        {exportProblem ? (
          <p id={"exportError"} role={"alert"} className={"export-error"}>
            {exportProblem}
          </p>
        ) : null}
        <button
          id={"download"}
          disabled={exportDialog.busy || Boolean(exportDialog.refusal)}
          aria-busy={exportDialog.busy}
          onClick={e => { e.preventDefault(); void exportCurrent(); }}
        >
          {exportDialog.busy ? "Compiling…" : "Compile & download"}
        </button>
        <button>
          {"Cancel"}
        </button>
        <p>
          {"Check hoop and thread choices for your machine and materials."}
        </p>
      </form>
    </dialog>
    <MessagesDialog />
    <div id={"openElsewhere"} role={"status"} hidden={true}>
      {"This document is open in another tab. Each tab keeps its own edits and autosave copy."}
    </div>
  </>
 );
}
