import type {MouseEvent, RefObject} from 'react';
import {t} from '../i18n.js';
import {closePhoneSheet, openPhoneSheet, type SheetDetent} from '../phoneSheetState.js';
import {setTraceDialogOpen} from '../traceDialogState.js';
import {shortcutFor} from '../shortcutTable.js';
import {PhotoStitch} from './PhotoStitch';
import {AddShapeButton, PenTool, PolygonTool, StarTool} from './ToolButtons';

// Issue #479 (part of #468, spec #470 sections 1 and 2): at phone portrait the tool dock holds seven buttons on one row, and More tools
// opens this one sheet. Its two groups are Tools (the drawing and tracing tools that do not fit the dock) and Panels (Layers and
// Properties, which are sheets of their own). A tool closes the sheet when it is pressed; a panel swaps the sheet for its own.
// Rendered only at phone portrait, where styles.css shows it as a bottom sheet.
export function MoreToolsSheet({asideRef, open, detent}: {asideRef: RefObject<HTMLElement | null>; open: boolean; detent: SheetDetent}) {
 // A tool button inside the Tools group closes the sheet after its own click handler has run.
 const closeAfterTool = (event: MouseEvent<HTMLDivElement>) => {
  if ((event.target as Element).closest('button')) closePhoneSheet();
 };
 return (
  <aside ref={asideRef} id={"moreToolsSheet"} className={open ? "panel sheet-open" : "panel"} data-detent={detent} aria-label={t('More tools')}>
   <div className={"sheet-grip"} data-sheet-drag={""} aria-hidden={"true"} />
   <div className={"sheet-head"} data-sheet-drag={""}>
    <h2 className={"sheet-title"}>{t('More tools')}</h2>
   </div>
   <h3 className={"more-heading"}>{t('Tools')}</h3>
   <div className={"more-grid"} onClick={closeAfterTool}>
    <AddShapeButton kind={"ellipse"} id={"ellipse"} label={"Add ellipse"} icon={"ellipse"} tip={t('Add ellipse ({shortcut})', {shortcut: shortcutFor('ellipse')})} short={t('Ellipse')} />
    <PolygonTool />
    <StarTool />
    <button type={"button"} className={"icon-button"} id={"traceBtn"} aria-label={"Trace a picture into filled shapes"} title={"Trace a picture into filled shapes"}
     data-tooltip={"Trace a picture into filled shapes"} onClick={() => setTraceDialogOpen(true)}>
     <svg className={"icon"}><use href={"#i-trace"} /></svg><span className={"rail-label"}>{t('Trace')}</span>
    </button>
    <PhotoStitch />
    <PenTool />
   </div>
   <h3 className={"more-heading"}>{t('Panels')}</h3>
   <div className={"more-grid"}>
    <button type={"button"} className={"icon-button"} id={"moreLayers"} aria-label={t('Layers')} title={t('Layers')} onClick={() => openPhoneSheet('layers')}>
     <svg className={"icon"}><use href={"#i-layers"} /></svg><span className={"rail-label"}>{t('Layers')}</span>
    </button>
    <button type={"button"} className={"icon-button"} id={"moreProperties"} aria-label={t('Properties')} title={t('Properties')} onClick={() => openPhoneSheet('properties')}>
     <svg className={"icon"}><use href={"#i-sliders"} /></svg><span className={"rail-label"}>{t('Properties')}</span>
    </button>
   </div>
  </aside>
 );
}
