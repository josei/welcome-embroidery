import {stitchRowsState} from '../stitchRowsState.js';
import {useEffect, useRef, useSyncExternalStore} from 'react';
import {ActionButton} from './ActionButton';
import {useDraftInput} from './useDraftInput';
import {documentActions, documentState} from '../documentState.js';
import {setSettingsOpen} from '../settingsState.js';
import {agentLinkState, type AgentLink} from '../agentLinkState.js';
import {EMPTY_EXPORT_REASON} from '../exportDialogState.js';
import {openExportDialog} from '../exportCommands.js';
import {shortcutLabel} from '../shortcutLabels.js';
import {shortcutFor, shortcutForCommand} from '../shortcutTable.js';
import {importMachineFile, newProject, openProjectFile, projectSave} from '../projectIO.js';
import {saveState} from '../saveState.js';
import {dirtyMark, saveStatusWords} from '../saveMark.js';
import {toolbarActions} from '../toolbarCommands.js';
import {t} from '../i18n.js';
import {ArrangeMenu, EditMenu, FileMenu, PhoneMenu} from './MenuBar';
import {usePhoneMenu} from '../phoneSheetState.js';
// The project name field: it shows the document name, and a committed change is an edit (see documentActions).
function ProjectName() {
 const {doc, dirty} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const shown = t(doc.name ?? '');
 const field = useDraftInput(shown, text => documentActions.rename(text === shown ? (doc.name ?? '') : text));
 // The window title carries the same dot while there are unsaved changes (cleared by a successful .welcome save).
 useEffect(() => {
  document.title = `${dirty ? '• ' : ''}${shown} — ${t('Welcome Embroidery')}`;
 }, [dirty, shown]);
 // The dot sits before the wrapper, so it lands at the start of the name at every width.
 // The wrapper carries the shown name for the narrow-width ellipsis (styles.css): an input cannot show one itself.
 return (
  <>
   <span id="unsavedMarker" className="unsaved-marker" role="img" aria-label={t('Unsaved changes')} title={t('Unsaved changes')} hidden={!dirty} />
   <span className="name-field" data-shown={shown}><input id="name" aria-label={t('Design name')} {...field} /></span>
  </>
 );
}
// Undo and Redo: the name says which action the step takes back (or forward), e.g. "Undo delete Rectangle". With no
// step on that side, the name says so and the button is disabled (actionState). Icon-only; the tooltip adds the shortcut.
function HistoryButton({undo = false}: {undo?: boolean}) {
 const {history, future} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const last = (undo ? history : future).at(-1)?.label;
 const name = last === undefined ? t(undo ? 'Nothing to undo' : 'Nothing to redo') : t(undo ? 'Undo {action}' : 'Redo {action}', {action: last});
 const keys = shortcutForCommand(undo ? 'undo' : 'redo');
 const tip = keys ? `${name} (${keys})` : name;
 return (
  <ActionButton flag={undo ? 'undo' : 'redo'} className="icon-button" id={undo ? 'undo' : 'redo'} aria-label={name} title={tip} data-tooltip={tip}
   onClick={() => (undo ? toolbarActions.undo() : toolbarActions.redo())}>
   <svg className="icon"><use href={undo ? '#i-undo' : '#i-redo'} /></svg>
  </ActionButton>
 );
}

// The save feedback: the unsaved marker while the design has changes ("Autosaved in this browser" until a file exists), then the time of the last save in this tab and the
// file it wrote to. The words come from saveStatusWords, which the phone Menu shows too.
function SaveStatus() {
 const {dirty} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const {savedAt, savedFileName} = useSyncExternalStore(saveState.subscribe, saveState.get);
 // The status slot is always rendered (issue #435), so the bar keeps its shape as the state changes: a clean design that has not been saved
 // shows the same autosave words as a dirty one, with no unsaved marker.
 const text = saveStatusWords(dirty, savedAt, savedFileName, t);
 if (dirty) {
  const mark = dirtyMark(savedFileName, t);
  return <span id="unsavedMark" className={mark.unsaved ? 'save-status unsaved' : 'save-status autosaved'} title={text}>{text}</span>;
 }
 if (savedAt === null) return <span id="idleStatus" className="save-status autosaved" title={text}>{text}</span>;
 return <span id="savedStatus" className="save-status" role="status">{text}</span>;
}

// Export: the one Export button opens the export dialog, where the format is chosen. Its name never changes with the format.
function ExportSplit() {
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 const exportTip = t('Export ({shortcut})', {shortcut: shortcutFor('export')});
 const blank = (doc.objects ?? []).length === 0;
 // A blank design keeps the button focusable (aria-disabled, not disabled) so keyboard users reach the reason,
 // which sits outside the teal fill, and activating it does nothing.
 return (
  <>
   {blank && <span id="exportReason" className="export-reason">{t(EMPTY_EXPORT_REASON)}</span>}
   <div className={blank ? 'export-split is-blank' : 'export-split'}>
    <button id="export" aria-disabled={blank} aria-describedby={blank ? 'exportReason' : undefined} title={exportTip} data-tooltip={exportTip} onClick={() => { if (!blank) openExportDialog(); }}>{t('Export')}</button>
   </div>
  </>
 );
}
// The agent connection shows on the Settings button, which opens the dialog where the agent link lives: a dot while an
// agent is waiting or active, and the tooltip says which.
function settingsButtonClass(agent: AgentLink) {
 return ['icon-button', agent.waiting || agent.active ? 'agent-on' : '', agent.active ? 'agent-active' : ''].filter(Boolean).join(' ');
}
function settingsTip(agent: AgentLink) {
 return agent.active ? t('Settings: agent connected') : agent.waiting ? t('Settings: waiting for agent') : t('Settings');
}
// A tooltip for a command with a shortcut in the table: the name, then the key in brackets.
function withKeys(name: string, command: string) {
 const keys = shortcutForCommand(command);
 return keys ? `${t(name)} (${keys})` : t(name);
}
// The editor header, rendered by React. Ids and attributes match the markup this replaced,
// because app.js wires its controls by id.
export function Header() {
 const phone = usePhoneMenu();
 // The toolbar Save names the action and its shortcut, the same label the File menu and shortcut sheet use.
 const saveLabel = `${t('Save')} (${shortcutLabel([{mod: true, key: 'S'}])})`;
 const rows = useSyncExternalStore(stitchRowsState.subscribe, stitchRowsState.get);
 const agent = useSyncExternalStore(agentLinkState.subscribe, agentLinkState.get);
 const projectFile = useRef<HTMLInputElement>(null);
 const machineFile = useRef<HTMLInputElement>(null);
 const newTip = withKeys('New design', 'new');
 const openTip = withKeys('Open project or SVG', 'open');
 const duplicateTip = withKeys('Duplicate', 'duplicate');
 const deleteTip = withKeys('Delete', 'delete');
 return (
  <><header className="top"><h1 className="sr-only">{t('Welcome Embroidery')}</h1><a className="logo" href="/" aria-label="Welcome"><svg className="logo-mark" viewBox="50 -939 3454 944" width="95.1" height="26"
    role="img" aria-label="Welcome"><path fillRule="evenodd"
      d={"M804 -305L817 -302L827 -295L835 -268L830 -233L814 -209L768 -189L710 -180L646 -182L606 -191L527 -73L485 -26L443 0L409 5L374 -3L360 -12L341 -40L326 " +
        "-101L318 -201L263 -73L238 -36L214 -12L177 3L137 3L104 -13L92 -27L76 -58L65 -102L51 -299L50 -408L52 -428L68 -454L98 -466L142 -464L158 -455L167 " +
        "-440L184 -118L245 -254L317 -434L336 -456L353 -464L396 -464L411 -456L418 -441L435 -118L525 -260L514 -292L510 -329L514 -362L525 -395L554 -436L584 " +
        "-458L604 -465L643 -465L672 -446L682 -431L688 -411L689 -368L681 -328L666 -284L798 -305ZM733 -208L739 -147L751 -111L768 -79L791 -52L819 -29L852 " +
        "-13L889 -1L931 4L976 4L1018 -2L1059 -14L1117 -44L1179 -91L1203 -116L1217 -142L1222 -178L1215 -211L1206 -220L1194 -223L1180 -219L1121 -163L1086 " +
        "-137L1045 -115L1003 -100L965 -95L923 -100L892 -115L880 -127L870 -141L961 -171L1026 -209L1062 -249L1078 -282L1087 -338L1081 -381L1074 -400L1065 " +
        "-417L1037 -444L1020 -454L981 -465L938 -465L897 -457L860 -442L811 -405L784 -373L754 -319L738 -265L734 -227ZM854 -219L858 -267L870 -307L893 -344L924 " +
        "-365L958 -365L971 -356L978 -343L979 -308L962 -276L947 -261L916 -241L877 -225ZM1148 -282L1159 -167L1182 -91L1201 -58L1224 -31L1252 -11L1284 1L1321 " +
        "5L1362 1L1400 -10L1436 -29L1500 -83L1529 -116L1543 -142L1548 -178L1546 -197L1532 -220L1520 -223L1506 -219L1414 -128L1381 -111L1342 -105L1326 " +
        "-107L1300 -122L1290 -137L1277 -181L1362 -308L1431 -437L1481 -557L1500 -620L1521 -733L1517 -832L1508 -867L1495 -895L1469 -924L1454 -933L1437 " +
        "-938L1402 -939L1355 -922L1312 -885L1273 -828L1222 -715L1190 -607L1167 -490L1150 -340ZM1270 -316L1284 -486L1299 -576L1339 -741L1367 -811L1388 " +
        "-838L1397 -841L1407 -838L1415 -829L1424 -792L1425 -765L1418 -684L1383 -550L1352 -472L1314 -394ZM1451 -197L1454 -242L1467 -302L1494 -359L1520 " +
        "-393L1550 -421L1583 -443L1618 -458L1673 -466L1730 -454L1745 -445L1770 -420L1788 -370L1784 -311L1771 -279L1757 -263L1741 -253L1705 -252L1692 " +
        "-259L1683 -270L1680 -284L1690 -341L1684 -361L1665 -368L1650 -366L1622 -347L1599 -314L1590 -292L1579 -236L1582 -173L1603 -128L1628 -109L1660 " +
        "-100L1696 -100L1731 -109L1783 -136L1815 -161L1861 -209L1874 -219L1888 -223L1900 -220L1909 -211L1916 -178L1911 -143L1897 -116L1837 -58L1766 -18L1729 " +
        "-5L1676 4L1634 4L1591 -3L1553 -17L1520 -37L1493 -65L1472 -97L1459 -134L1452 -175ZM1820 -205L1824 -161L1834 -120L1852 -83L1876 -50L1907 -24L1937 " +
        "-8L1971 2L2029 4L2085 -11L2120 -32L2149 -59L2173 -88L2192 -122L2211 -180L2271 -186L2343 -204L2356 -211L2365 -223L2372 -261L2365 -294L2357 -304L2345 " +
        "-307L2219 -285L2211 -327L2197 -365L2177 -399L2151 -428L2102 -457L2063 -466L2022 -466L1983 -459L1946 -444L1913 -422L1884 -393L1859 -360L1841 " +
        "-323L1825 -267L1821 -226ZM1945 -214L1952 -276L1972 -322L2001 -351L2019 -359L2043 -361L2041 -310L2049 -274L2077 -226L2104 -202L2092 -159L2073 " +
        "-127L2047 -107L2017 -101L1999 -104L1967 -130L1953 -157L1946 -193ZM2288 -163L2297 -290L2325 -410L2342 -442L2355 -452L2370 -460L2412 -466L2440 " +
        "-461L2448 -442L2417 -300L2407 -227L2441 -308L2472 -359L2522 -419L2568 -451L2605 -464L2644 -464L2661 -459L2681 -437L2687 -401L2685 -374L2657 " +
        "-231L2710 -337L2756 -398L2819 -448L2851 -461L2882 -466L2902 -464L2931 -450L2945 -421L2947 -401L2940 -336L2908 -170L2906 -145L2913 -115L2922 " +
        "-107L2935 -105L2965 -116L2994 -140L3069 -219L3083 -223L3095 -220L3109 -197L3111 -178L3106 -142L3092 -116L3032 -54L3000 -29L2965 -10L2908 4L2868 " +
        "4L2835 -6L2821 -14L2801 -37L2785 -89L2789 -159L2811 -297L2808 -309L2800 -313L2790 -309L2763 -279L2725 -212L2693 -134L2658 -21L2639 -2L2623 3L2589 " +
        "3L2564 -13L2555 -26L2539 -81L2542 -161L2556 -297L2553 -309L2545 -313L2521 -297L2489 -245L2449 -148L2416 -36L2403 -11L2391 -2L2357 5L2339 3L2313 " +
        "-17L2295 -67L2290 -110ZM3015 -208L3021 -147L3033 -111L3050 -79L3073 -52L3101 -29L3134 -13L3171 -1L3213 4L3258 4L3300 -2L3341 -14L3399 -44L3433 " +
        "-67L3485 -116L3499 -142L3504 -178L3497 -211L3488 -220L3476 -223L3462 -219L3403 -163L3368 -137L3327 -115L3285 -100L3247 -95L3205 -100L3174 -115L3162 " +
        "-127L3152 -141L3243 -171L3308 -209L3344 -249L3360 -282L3369 -338L3363 -381L3356 -400L3347 -417L3319 -444L3302 -454L3263 -465L3220 -465L3179 " +
        "-457L3142 -442L3093 -405L3066 -373L3036 -319L3020 -265L3016 -227ZM3136 -219L3140 -267L3152 -307L3175 -344L3206 -365L3240 -365L3253 -356L3260 " +
        "-343L3261 -308L3244 -276L3229 -261L3198 -241L3159 -225Z"}/></svg></a>{phone ? <PhoneMenu /> : <><FileMenu /><EditMenu /><ArrangeMenu /></>}<span className="sep" aria-hidden="true" /><button className="icon-button" id="new"
          aria-label="New design" title={newTip} data-tooltip={newTip} onClick={() => newProject()}><svg className="icon"><use href="#i-new"/></svg></button><button className="icon-button" id="open" aria-label="Open project or SVG"
      title={openTip} data-tooltip={openTip} onClick={() => projectFile.current?.click()}><svg className="icon"><use href="#i-open"/></svg></button><button className="icon-button" id="importMachine"
      aria-label="Import JEF / VP3…" title="Import JEF / VP3…" data-tooltip="Import JEF / VP3…" onClick={() => machineFile.current?.click()}><svg className="icon"><use href="#i-import"/></svg></button><button className="icon-button" id="save" aria-label={saveLabel}
      title={saveLabel} data-tooltip={saveLabel} onClick={() => projectSave()}><svg className="icon"><use href="#i-save"/></svg></button><span className="sep" aria-hidden="true" /><div className="edit-tools"><HistoryButton undo /><HistoryButton /><ActionButton flag="duplicate" className="icon-button" id="duplicate"
      aria-label="Duplicate selected object" title={duplicateTip} data-tooltip={duplicateTip} onClick={() => toolbarActions.duplicate()}><svg className="icon"><use href="#i-copy"/></svg></ActionButton><ActionButton flag="remove" className="icon-button" id="remove"
      aria-label="Delete selected object" title={deleteTip} data-tooltip={deleteTip} onClick={() => toolbarActions.remove()}><svg className="icon"><use href="#i-delete"/></svg></ActionButton></div><span className="sep" aria-hidden="true" /><ProjectName /><SaveStatus /><span className="sep" aria-hidden="true" /><ExportSplit /><button className="icon-button" id="helpBtn" aria-label="Keyboard shortcuts (?)"
      title="Keyboard shortcuts (?)" data-tooltip="Keyboard shortcuts (?)"><svg className="icon"><use href="#i-keys"/></svg></button><button type="button" className={settingsButtonClass(agent)}
      id="settingsBtn" aria-label="Settings" title={settingsTip(agent)} data-tooltip="Settings" onClick={() => setSettingsOpen(true)}><svg className="icon"><use href="#i-gear"/></svg></button><input id="file" ref={projectFile} type="file"
      accept=".welcome,.welcome,.svg,.dxf,application/json,image/svg+xml" hidden onChange={async e =>
    { const chosen = e.target.files?.[0]; if (!chosen) return;
    try { await openProjectFile(chosen); } finally { e.target.value = '';
    } }} /><input id="machineFile" ref={machineFile} type="file"
      accept=".jef,.vp3,.dst,.sew,.pec,.pes,.exp,.hus,.xxx,.dsb,.dsz,.tap,.tbf,.pcs,.shv,.stx,.bro,.emd,.ksm,.10o,.u01,application/octet-stream" hidden
        onChange={async e =>
    { const chosen = e.target.files?.[0]; if (!chosen) return; try { await importMachineFile(chosen); } finally { e.target.value = ''; } }} /></header></>
 );
}
