import type {MouseEvent, RefObject} from 'react';
import {t} from '../i18n.js';
import {closePhoneSheet, openPhoneSheet, type SheetDetent} from '../phoneSheetState.js';
import {setTraceDialogOpen} from '../traceDialogState.js';
import {shortcutFor} from '../shortcutTable.js';
import {PhotoStitch} from './PhotoStitch';
import {AddShapeButton, PenTool, PolygonTool, RailButton, StarTool} from './ToolButtons';

// At phone portrait the tool dock holds seven buttons on one row, and More tools
// opens this one panel. Its two groups are Tools (the drawing and tracing tools that do not fit the dock) and Panels (Layers and
// Properties, which are panels of their own). A tool closes the panel when it is pressed; a panel swaps it for its own.
// It has the product panel's header and a Close button, not a native-style grab handle. Rendered only at phone portrait and
// landscape, where styles.css shows it over the dimmed canvas.
export function MoreToolsSheet({asideRef, open, detent}: {asideRef: RefObject<HTMLElement | null>; open: boolean; detent: SheetDetent}) {
 // A tool button inside the Tools group closes the sheet after its own click handler has run.
 const closeAfterTool = (event: MouseEvent<HTMLDivElement>) => {
  if ((event.target as Element).closest('button')) closePhoneSheet();
 };
 return (
  <aside ref={asideRef} id={"moreToolsSheet"} className={open ? "panel sheet-open" : "panel"} data-detent={detent} aria-label={t('More tools')}>
   <div className={"sheet-head"}>
    <h2 className={"sheet-title"}>{t('More tools')}</h2>
    <button type={"button"} className={"sheet-close"} id={"moreToolsClose"} onClick={closePhoneSheet}>{t('Close')}</button>
   </div>
   <h3 className={"more-heading"}>{t('Tools')}</h3>
   <div className={"more-grid"} onClick={closeAfterTool}>
    <AddShapeButton kind={"ellipse"} id={"ellipse"} label={"Add ellipse"} icon={"ellipse"} tip={t('Add ellipse ({shortcut})', {shortcut: shortcutFor('ellipse')})} short={t('Ellipse')} />
    <PolygonTool />
    <StarTool />
    <RailButton id={"traceBtn"} icon={"trace"} label={t('Trace')} tip={t('Trace a picture into filled shapes')} onClick={() => setTraceDialogOpen(true)} />
    <PhotoStitch />
    <PenTool />
   </div>
   <h3 className={"more-heading"}>{t('Panels')}</h3>
   <div className={"more-grid"}>
    <RailButton id={"moreLayers"} icon={"layers"} label={t('Layers')} tip={t('Layers')} onClick={() => openPhoneSheet('layers')} />
    <RailButton id={"moreProperties"} icon={"sliders"} label={t('Properties')} tip={t('Properties')} onClick={() => openPhoneSheet('properties')} />
   </div>
  </aside>
 );
}
