import {layoutState} from '../layoutState.js';
import {inspectorOpenState, toggleInspectorOpen, TABLET_DRAWER_QUERY} from '../inspectorOpenState.js';
import {inspectorTabState, selectInspectorTab, useTabletPortrait} from '../tabletLayoutState.js';
import {closePhoneSheet, isPhoneSheetLayout, phoneSheetDetent, phoneSheetState, togglePhoneSheet, usePhonePortrait} from '../phoneSheetState.js';
import {selectionState} from '../selectionState.js';
import {watchTabletDrawerEscape} from '../tabletDrawerEscape.js';
import {attachSheetDrag, firstSheetControl} from '../phoneSheetDrag.js';
import {selectionLabelsState} from '../selectionLabelsState.js';
import {t} from '../i18n.js';
import {designName} from '../designName.js';
import {documentState} from '../documentState.js';
import {sewingCountsState} from '../sewingCountsState.js';
import {shortcutLabel} from '../shortcutLabels.js';
import {shortcutFor} from '../shortcutTable.js';
import {CanvasTextEditor} from './CanvasTextEditor';
import {PreviewPanel} from './PreviewPanel';
import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {SelectionHint} from './SelectionHint';
import {CanvasHint} from './CanvasHint';
import {ActionButton} from './ActionButton';
import {DesignSummary, SelectionHeading, SourceInfo} from './InspectorText';
import {AlignButtons} from './AlignButtons';
import {ArrayPanel} from './ArrayPanel';
import {DocumentSettings, FabricSection} from './DocumentSettings';
import {HoopFields, useHoopInProperties} from './HoopFields';
import {LetteringPanel} from './LetteringPanel';
import {PathNodeButtons} from './PathNodeButtons';
import {PathPanel} from './PathPanel';
import {selectionToolbarActions} from '../selectionToolbarState.js';
import {ReferenceLayer, referenceCanvasHandlers} from './ReferenceLayer';
import {ReferencePicture} from './ReferencePicture';
import {BooleanButtons, FlipButtons, SelectToggleButton} from './SelectionToolbarButtons';
import {ArrangeSheet} from './ArrangeSheet';
import {SewingOrder} from './SewingOrder';
import {SnapObjectButton} from './SnapObjectButton';
import {StatusRun} from './StatusRun';
import {ToastStack} from './ToastStack';
import {StitchAccordionRows} from './StitchAccordionRows';
import {StitchBlendRows} from './StitchBlendRows';
import {StitchBlingRows} from './StitchBlingRows';
import {StitchCapRows} from './StitchCapRows';
import {StitchFillRows} from './StitchFillRows';
import {StitchPathRows} from './StitchPathRows';
import {StitchRunRows} from './StitchRunRows';
import {StitchSatinEndRows} from './StitchSatinEndRows';
import {StitchTypeRows} from './StitchTypeRows';
import {ThreadPlan} from './ThreadPlan';
import {LineTool, MeasureTool, PathTool, PenTool, SelectTool, ToolButtons} from './ToolButtons';
import {MoreToolsSheet} from './MoreToolsSheet';
import {TransformPanel} from './TransformPanel';
import {ObjectList, ObjectListHead} from './ObjectList';
import {PhotoStitch} from './PhotoStitch';
import {PlaybackBar} from './PlaybackBar';
import {TipCard} from './TipCard';
import {GridControl} from './GridControl';
import {ViewSwitch} from './ViewSwitch';
import {ZoomBar} from './ZoomBar';
import {AddShapeButton, GridSnapButton} from './ToolButtons';
import {toolbarActions} from '../toolbarCommands.js';
import {viewMode} from '../viewMode.js';
import {gridSnapState} from '../gridSnapState.js';
import {gridShownState} from '../gridState.js';
import {useCompactLayout} from '../compactLayout';
import {editModeState} from '../editModeState.js';
import {deletingGuideState, handModeState, panningState} from '../canvasModeState.js';
import {setTraceDialogOpen} from '../traceDialogState.js';
const groupLabel = t('Group ({shortcut})', {shortcut: shortcutLabel([{mod: true, key: 'G'}])});
const ungroupLabel = t('Ungroup ({shortcut})', {shortcut: shortcutLabel([{mod: true, shift: true, key: 'G'}])});
// Landscape phones (the bar is 52 px tall there). Tablets keep the bar, which also holds the grid chip, without a selection.
const NARROW_QUERY = '(max-height: 500px)';
const subscribeNarrow = (listen: () => void) => {
 const media = window.matchMedia(NARROW_QUERY);
 media.addEventListener('change', listen);
 return () => media.removeEventListener('change', listen);
};
const narrowNow = () => window.matchMedia(NARROW_QUERY).matches;
// A landscape phone, where the tool rail is a two-column grid inside the window and More tools
// opens the More tools sheet. Same window as the landscape block in styles.css.
const LANDSCAPE_PHONE_QUERY = '(orientation: landscape) and (max-height: 500px) and (max-width: 1000px)';
const subscribeLandscapePhone = (listen: () => void) => {
 const media = window.matchMedia(LANDSCAPE_PHONE_QUERY);
 media.addEventListener('change', listen);
 return () => media.removeEventListener('change', listen);
};
const landscapePhoneNow = () => window.matchMedia(LANDSCAPE_PHONE_QUERY).matches;
const duplicateLabel = t('Duplicate selected object');
const deleteLabel = t('Delete selected object');

// The editor layout: the object list, the canvas and the inspector. Rendered by React; ids match the markup it
// replaced, because the keyboard shortcuts and tests address them.
export function EditorLayout() {
 const canvasDoc = useSyncExternalStore(documentState.subscribe, documentState.get);
 const canvasCounts = useSyncExternalStore(sewingCountsState.subscribe, sewingCountsState.get);
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const inspectorOpen = useSyncExternalStore(inspectorOpenState.subscribe, inspectorOpenState.get);
 const inspectorTab = useSyncExternalStore(inspectorTabState.subscribe, inspectorTabState.get);
 const tablet = useTabletPortrait();
 // Phones and tablets stack the panels, so the hoop size and rotation move into Properties; desktop keeps them under Layers.
 const hoopInProperties = useHoopInProperties();
 const phoneSheet = useSyncExternalStore(phoneSheetState.subscribe, phoneSheetState.get);
 const detent = useSyncExternalStore(phoneSheetDetent.subscribe, phoneSheetDetent.get);
 const phone = usePhonePortrait();
 const landscapePhone = useSyncExternalStore(subscribeLandscapePhone, landscapePhoneNow);
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const hasSelection = selection.selected !== null || selection.multi.size > 0;
 // On a landscape phone the selection bar is contextual, so it is shown only with a selection.
 const narrow = useSyncExternalStore(subscribeNarrow, narrowNow);
 const selectionLabels = useSyncExternalStore(selectionLabelsState.subscribe, selectionLabelsState.get);
 const view = useSyncExternalStore(viewMode.subscribe, viewMode.get);
 const snapping = useSyncExternalStore(gridSnapState.subscribe, gridSnapState.get);
 const gridShown = useSyncExternalStore(gridShownState.subscribe, gridShownState.get);
 // At phone and tablet widths the grid and snap chips are not on the canvas; the View menu holds them.
 const compact = useCompactLayout();
 const editing = useSyncExternalStore(editModeState.subscribe, editModeState.get);
 const hand = useSyncExternalStore(handModeState.subscribe, handModeState.get);
 const panning = useSyncExternalStore(panningState.subscribe, panningState.get);
 const deletingGuide = useSyncExternalStore(deletingGuideState.subscribe, deletingGuideState.get);
 // The sheets' asides: a portrait sheet can be dragged by its grab handle or title row (phoneSheetDrag.ts).
 const layersSheet = useRef<HTMLElement>(null);
 const inspectorSheet = useRef<HTMLElement>(null);
 const toolsSheet = useRef<HTMLElement>(null);
 useEffect(() => {
  const detach = [layersSheet.current, inspectorSheet.current, toolsSheet.current].map(el => el && attachSheetDrag(el));
  return () => detach.forEach(off => off?.());
 }, []);
 // An open sheet takes focus on its first control, and Escape closes it. Closing returns focus to the opener (closePhoneSheet).
 useEffect(() => {
  if (phoneSheet === 'none') return;
  const sheet = document.getElementById(phoneSheet === 'layers' ? 'layersSheet' : phoneSheet === 'tools' ? 'moreToolsSheet' : 'inspector');
  if (sheet) firstSheetControl(sheet)?.focus();
  const escape = (e: KeyboardEvent) => {
   if (e.key !== 'Escape' || e.defaultPrevented || !isPhoneSheetLayout() || document.querySelector('dialog[open]')) return;
   e.preventDefault();
   closePhoneSheet();
  };
  document.addEventListener('keydown', escape);
  return () => document.removeEventListener('keydown', escape);
 }, [phoneSheet]);
 // Escape folds the portrait tablet's inspector drawer too, and focuses its collapse strip (tabletDrawerEscape.ts).
 useEffect(() => watchTabletDrawerEscape(), []);
 const canvasClass = ['canvas', hand && 'hand', snapping && 'snapping', (gridShown || snapping) && 'grid-shown', view === 'preview' && 'preview-mode', panning && 'panning',
  deletingGuide && 'deleting-guide'].filter(Boolean).join(' ');
 // At phone portrait the dock is one row of seven buttons, each with its label under the icon. Pen,
 // Polygon, Star, Trace, Photo stitch, Ellipse and the panels are in More tools (MoreToolsSheet), so nothing scrolls sideways.
 const phoneDock = (
   <div className={"tool-row tool-rail"} aria-label={"Tools"}>
     <SelectTool />
     <AddShapeButton kind={"rect"} id={"rect"} label={"Add rectangle"} icon={"rect"} tip={t('Add rectangle ({shortcut})', {shortcut: shortcutFor('rect')})} short={t('Shape')} />
     <PathTool />
     <AddShapeButton kind={"text"} id={"letter"} label={"Add lettering"} icon={"text"} tip={t('Add lettering ({shortcut})', {shortcut: shortcutFor('letter')})} short={t('Text')} />
     <LineTool />
     <MeasureTool />
     <button
       type={"button"}
       className={"icon-button tool-more"}
       id={"toolMore"}
       aria-label={t('More tools')}
       aria-expanded={phoneSheet === 'tools'}
       aria-controls={"moreToolsSheet"}
       title={t('More tools')}
       data-tooltip={t('More tools')}
       onClick={() => togglePhoneSheet('tools')}
     >
       <svg className={"icon"}>
         <use href={"#i-chevron"} />
       </svg><span className={"rail-label"}>{t('More')}</span>
     </button>
   </div>
  );
 const deskToolRail = (
   <>
             <div className={"tool-row tool-rail"} aria-label={"Tools"}>
               {phone ? null : <>
               {/* On a phone the dock (portrait) or rail (landscape) opens Layers and Properties as sheets. */}
               <button type="button" className={"icon-button phone-sheet-btn"} id={"layersBtn"} aria-label={t('Layers')} title={t('Layers')} data-tooltip={t('Layers')}
                aria-expanded={phoneSheet === 'layers'} aria-controls={"layersSheet"} onClick={() => togglePhoneSheet('layers')}>
                <svg className={"icon"}><use href={"#i-layers"} /></svg>
               </button>
               <button type="button" className={"icon-button phone-sheet-btn"} id={"propertiesBtn"} aria-label={t('Properties')} title={t('Properties')} data-tooltip={t('Properties')}
                aria-expanded={phoneSheet === 'properties'} aria-controls={"inspector"} onClick={() => togglePhoneSheet('properties')}>
                <svg className={"icon"}><use href={"#i-sliders"} /></svg>
               </button>
               </>}
               <SelectTool />
               <AddShapeButton kind={"rect"} id={"rect"} label={"Add rectangle"} icon={"rect"} tip={t('Add rectangle ({shortcut})', {shortcut: shortcutFor('rect')})} short={t('Shape')} />
               {landscapePhone ? null : <AddShapeButton kind={"ellipse"} id={"ellipse"} label={"Add ellipse"} icon={"ellipse"} tip={t('Add ellipse ({shortcut})', {shortcut: shortcutFor('ellipse')})} short={t('Ellipse')} />}
               <PathTool />
               <AddShapeButton kind={"text"} id={"letter"} label={"Add lettering"} icon={"text"} tip={t('Add lettering ({shortcut})', {shortcut: shortcutFor('letter')})} short={t('Text')} />
               {landscapePhone ? <><LineTool /><MeasureTool /></> : <ToolButtons />}
               {landscapePhone ? null : <button
                 className={"icon-button"}
                 id={"traceBtn"}
                 aria-label={"Trace a picture into filled shapes"}
                 title={"Trace a picture into filled shapes"}
                 data-tooltip={"Trace a picture into filled shapes"}
                 onClick={() => setTraceDialogOpen(true)}
               >
                 <svg className={"icon"}>
                   <use href={"#i-trace"} />
                 </svg><span className={"rail-label"}>{t('Trace')}</span>
               </button>}
               {landscapePhone ? null : <PhotoStitch />}
               {landscapePhone ? null : <PenTool />}
               {/* On a landscape phone More tools is the last cell of the rail, and opens the More tools sheet with the tools that do not fit. */}
               {landscapePhone ? <button
                 type={"button"}
                 className={"icon-button tool-more"}
                 id={"toolMore"}
                 aria-label={t('More tools')}
                 aria-expanded={phoneSheet === 'tools'}
                 aria-controls={"moreToolsSheet"}
                 title={t('More tools')}
                 data-tooltip={t('More tools')}
                 onClick={() => togglePhoneSheet('tools')}
               >
                 <svg className={"icon"}>
                   <use href={"#i-chevron"} />
                 </svg><span className={"rail-label"}>{t('More')}</span>
               </button> : null}
             </div>
   </>
  );
 const toolRail = phone ? phoneDock : deskToolRail;
 const floatingBar = (
             <div className={"floating"} role={"toolbar"} aria-label={"Canvas tools"} hidden={phone ? (view !== 'design' || !hasSelection) : (narrow && !hasSelection)}>
               {/* Select, Duplicate, Delete and Arrange lead the bar, so they stay in view at phone widths. */}
               <SelectToggleButton />
               <ActionButton flag="duplicate" className={"icon-button bar-edit"} id={"barDuplicate"} aria-label={duplicateLabel} title={duplicateLabel}
                 data-tooltip={duplicateLabel} onClick={() => toolbarActions.duplicate()}>
                 <svg className={"icon"}>
                   <use href={"#i-copy"} />
                 </svg>
               </ActionButton>
               <ActionButton flag="remove" className={"icon-button bar-edit"} id={"barDelete"} aria-label={deleteLabel} title={deleteLabel}
                 data-tooltip={deleteLabel} onClick={() => toolbarActions.remove()}>
                 <svg className={"icon"}>
                   <use href={"#i-delete"} />
                 </svg>
               </ActionButton>
               <ArrangeSheet />
               {/* The Arrange sheet holds these at every size. From 1025px the bar also keeps them as direct buttons, where it has room. */}
               {compact ? null : <GridSnapButton />}
               {compact ? null : <SnapObjectButton />}
               {compact ? null : <GridControl />}
               <span className={"bar-direct"}>
                 <AlignButtons />
                 <FlipButtons />
               </span>
               <ActionButton flag="group" hideWhenDisabled className={"icon-button"} aria-label={groupLabel} title={groupLabel}
                 data-tooltip={groupLabel} id={"group"} onClick={(
                 ) => toolbarActions.group()}>
                 <svg className={"icon"}>
                   <use href={"#i-group"} />
                 </svg>
               </ActionButton>
               <ActionButton flag="ungroup" hideWhenDisabled
                 className={"icon-button"}
                 aria-label={ungroupLabel}
                 title={ungroupLabel}
                 data-tooltip={ungroupLabel}
                 id={"ungroup"}
                 onClick={() => toolbarActions.ungroup()}
               >
                 <svg className={"icon"}>
                   <use href={"#i-ungroup"} />
                 </svg>
               </ActionButton>
               <span className={"bar-direct"}>
                 <BooleanButtons />
               </span>
               <ActionButton flag="clip" hideWhenDisabled
                 className={"icon-button tb-start"}
                 aria-label={"Clip: use the top selected shape as a mask for the other selected objects"}
                 title={"Clip: use the top selected shape as a mask for the other selected objects"}
                 data-tooltip={"Clip: use the top selected shape as a mask for the other selected objects"}
                 id={"clipBtn"}
                 onClick={() => selectionToolbarActions.clip()}
               >
                 <svg className={"icon"}>
                   <use href={"#i-clip"} />
                 </svg>
               </ActionButton>
               <ActionButton flag="unclip" hideWhenDisabled
                 className={"icon-button"}
                 aria-label={"Release the clipping mask"}
                 title={"Release the clipping mask"}
                 data-tooltip={"Release the clipping mask"}
                 id={"unclipBtn"}
                 onClick={() => selectionToolbarActions.unclip()}
               >
                 <svg className={"icon"}>
                   <use href={"#i-unclip"} />
                 </svg>
               </ActionButton>
               <ActionButton flag="textOnPath" hideWhenDisabled
                 className={"icon-button tb-start"}
                 aria-label={"Put the selected text on the selected path"}
                 title={"Put the selected text on the selected path"}
                 data-tooltip={"Put the selected text on the selected path"}
                 id={"textOnPath"}
                 onClick={() => selectionToolbarActions.textOnPath()}
               >
                 <svg className={"icon"}>
                   <use href={"#i-text-path"} />
                 </svg>
               </ActionButton>
               <ActionButton flag="textOffPath" hideWhenDisabled
                 className={"icon-button"}
                 aria-label={"Detach text from its path"}
                 title={"Detach text from its path"}
                 data-tooltip={"Detach text from its path"}
                 id={"textOffPath"}
                 onClick={() => selectionToolbarActions.textOffPath()}
               >
                 <svg className={"icon"}>
                   <use href={"#i-text-detach"} />
                 </svg>
               </ActionButton>
               <ActionButton flag="editNodes" hideWhenDisabled
                 className={editing ? "icon-button tb-start active-tool" : "icon-button tb-start"}
                 aria-label={"Edit nodes (Enter)"}
                 title={"Edit nodes (Enter) — converts rectangles and ellipses to paths"}
                 data-tooltip={"Edit nodes (Enter) — converts rectangles and ellipses to paths"}
                 id={"editNodes"}
                 onClick={() => toolbarActions.editNodes()}
               >
                 <svg className={"icon"}>
                   <use href={"#i-node-edit"} />
                 </svg>
               </ActionButton>
               <PathNodeButtons />
             </div>
  );
 return (
  <>
    <div className={"layout"}>
      {phoneSheet === 'none' ? null : <div className={"sheet-scrim"} aria-hidden={"true"} onClick={closePhoneSheet} />}
      <aside ref={layersSheet} className={[phoneSheet === 'layers' ? "panel sheet-open" : "panel", tablet && inspectorOpen && inspectorTab === 'layers' && 'tab-active'].filter(Boolean).join(' ')} data-detent={detent} id={"layersSheet"} aria-label={t('Objects')}>
        <div className={"sheet-grip"} data-sheet-drag={""} aria-hidden={"true"} />
        <ObjectListHead />
        <label className={"sides-row"} hidden={true}>
          {"Sides / star points "}
          <input id={"sides"} type={"number"} min={"3"} max={"12"} defaultValue={"5"} />
        </label>
        <ObjectList />
        {hoopInProperties ? null : <HoopFields />}
      </aside>
      {/* On a portrait tablet the Layers and Properties tabs sit at the top of the inspector column; the panels below them switch. */}
      <div className={"inspector-tabs"} role={"tablist"} aria-label={t('Inspector')}>
        <button type={"button"} role={"tab"} className={"inspector-tab"} data-tab={"layers"} id={"tabLayers"} aria-selected={inspectorTab === 'layers'}
         aria-controls={"layersSheet"} onClick={() => selectInspectorTab('layers')}>{t('Layers')}</button>
        <button type={"button"} role={"tab"} className={"inspector-tab"} data-tab={"properties"} id={"tabProperties"} aria-selected={inspectorTab === 'properties'}
         aria-controls={"inspector"} onClick={() => selectInspectorTab('properties')}>{t('Properties')}</button>
        <button type={"button"} className={"inspector-collapse"} aria-expanded={inspectorOpen} aria-label={inspectorOpen ? t('Collapse inspector') : t('Expand inspector')}
         title={inspectorOpen ? t('Collapse inspector') : t('Expand inspector')} data-tooltip={inspectorOpen ? t('Collapse inspector') : t('Expand inspector')} onClick={toggleInspectorOpen}>
          <span className={"collapse-glyph"} aria-hidden={"true"}>{inspectorOpen ? '›' : '‹'}</span>
        </button>
      </div>
      {phone || landscapePhone ? <MoreToolsSheet asideRef={toolsSheet} open={phoneSheet === 'tools'} detent={detent} /> : null}
      <main className={view === 'design' ? 'design-view' : undefined}>
        <div className={canvasClass} onClick={(e) => {
          // On a portrait tablet a tap on the canvas closes the Properties drawer (controls inside the canvas keep it open).
          if (inspectorOpen && window.matchMedia(TABLET_DRAWER_QUERY).matches && !(e.target as Element).closest('button,input,select,textarea,label,a')) toggleInspectorOpen();
        }}>
          {phone ? null : toolRail}
          {/* On a portrait tablet the 2D / Stitches / 3D switch is in the top bar, not over the canvas. */}
          {tablet ? null : <div className={"canvas-views"}>
            <ViewSwitch />
          </div>}
          <canvas id={"rulerTop"} aria-hidden={"true"}>
          </canvas>
          <canvas id={"rulerLeft"} aria-hidden={"true"}>
          </canvas>
          <div className={"ruler-corner"} aria-hidden={"true"}>
          </div>
          <canvas id={"preview3d"} hidden={true} aria-label={"3D thread preview. Drag to orbit, scroll to zoom, double-click to reset."}>
          </canvas>
          <CanvasHint />
          <ZoomBar />
          <PreviewPanel />
          {phone ? null : floatingBar}
          <svg id={"art"} viewBox={"-60 -60 120 120"} tabIndex={0} role={"application"} aria-label={designName(canvasDoc.doc.objects ?? [], canvasCounts)} {...referenceCanvasHandlers}>
            <defs>
              <pattern id={"linen"} width={"2.6"} height={"2.6"} patternUnits={"userSpaceOnUse"}>
                <path d={"M0 0H2.6M0 0V2.6"} stroke={"#a9a397"} strokeOpacity={".11"} strokeWidth={".18"} />
              </pattern>
            </defs>
            <rect id={"hoopOuter"} className={"hoop-outer"} x={"-58"} y={"-58"} width={"116"} height={"116"} rx={"7"} />
            <rect id={"hoopRing"} className={"hoop"} x={"-54"} y={"-54"} width={"108"} height={"108"} rx={"4"} />
            <rect id={"hoopLinen"} className={"linen"} x={"-52.8"} y={"-52.8"} width={"105.6"} height={"105.6"} rx={"3"} />
            <ReferenceLayer />
            <g id={"shapes"}>
            </g>
            <g id={"controls"}>
            </g>
            <g id={"guides"}>
            </g>
            <g id={"overlay"}>
            </g>
            <g id={"stitches"}>
            </g>
          </svg>
          <CanvasTextEditor />
        </div>
        {phone && view !== 'design' ? <div className={"phone-playback"}><PlaybackBar /></div> : null}
        {phone ? floatingBar : null}
        {phone ? toolRail : null}
        <footer>
          <ToastStack />
          {phone ? null : <PlaybackBar />}
          <StatusRun />
        </footer>
      </main>
      <aside ref={inspectorSheet} className={[inspectorOpen ? "panel" : "panel inspector-collapsed", phoneSheet === 'properties' && 'sheet-open', tablet && inspectorOpen && inspectorTab === 'properties' && 'tab-active'].filter(Boolean).join(' ')} id={"inspector"} data-detent={detent} aria-label={t('Properties')}>
        <div className={"sheet-grip"} data-sheet-drag={""} aria-hidden={"true"} />
        <div className={"sheet-head"} data-sheet-drag={""}>
          <h2 className={"sheet-title"}>{t('Properties')}</h2>
        </div>
        <SelectionHeading />
        <TipCard />
        <SelectionHint />
        {selectionLabels.hintHidden ? null : (
          <div className={"scope-document"}>
            <h3 className={"section-heading scope-heading"}>
              {"Document"}
            </h3>
            <DocumentSettings />
          </div>
        )}
        <SourceInfo />
        <TransformPanel />
        <section id={"secStitch"} data-sec={""} hidden={layout.secStitch}>
          <StitchTypeRows />
          <StitchBlingRows />
          <StitchFillRows />
          <StitchBlendRows />
          <StitchAccordionRows />
          <StitchRunRows />
          <StitchCapRows />
          <StitchSatinEndRows />
          <StitchPathRows />
          {" "}
        </section>
        <LetteringPanel />
        <PathPanel />
        <ArrayPanel />
        <SewingOrder />
        <ReferencePicture />
        <ThreadPlan />
        <div className={"scope-document"}>
          <h3 className={"section-heading scope-heading"}>
            {"Document"}
          </h3>
          {hoopInProperties ? <HoopFields /> : null}
          {selectionLabels.hintHidden ? <DocumentSettings /> : null}
          <DesignSummary />
          <FabricSection />
        </div>
      </aside>
    </div>
  </>
 );
}
