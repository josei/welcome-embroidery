import {layoutState} from '../layoutState.js';
import {t} from '../i18n.js';
import {shortcutLabel} from '../shortcutLabels.js';
import {CanvasTextEditor} from './CanvasTextEditor';
import {PreviewPanel} from './PreviewPanel';
import {useSyncExternalStore} from 'react';
import {SelectionHint} from './SelectionHint';
import {CanvasHint} from './CanvasHint';
import {ActionButton} from './ActionButton';
import {DesignSummary, SelectionHeading, SourceInfo} from './InspectorText';
import {AlignButtons} from './AlignButtons';
import {ArrayPanel} from './ArrayPanel';
import {DocumentSettings, FabricSection} from './DocumentSettings';
import {HoopFields} from './HoopFields';
import {LetteringPanel} from './LetteringPanel';
import {PathNodeButtons} from './PathNodeButtons';
import {PathPanel} from './PathPanel';
import {selectionToolbarActions} from '../selectionToolbarState.js';
import {ReferenceLayer, referenceCanvasHandlers} from './ReferenceLayer';
import {ReferencePicture} from './ReferencePicture';
import {BooleanButtons, FlipButtons} from './SelectionToolbarButtons';
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
import {PathTool, PenTool, SelectTool, ToolButtons} from './ToolButtons';
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
import {editModeState} from '../editModeState.js';
import {deletingGuideState, handModeState, panningState} from '../canvasModeState.js';
import {setTraceDialogOpen} from '../traceDialogState.js';
const groupLabel = t('Group ({shortcut})', {shortcut: shortcutLabel([{mod: true, key: 'G'}])});
const ungroupLabel = t('Ungroup ({shortcut})', {shortcut: shortcutLabel([{mod: true, shift: true, key: 'G'}])});

// The editor layout: the object list, the canvas and the inspector. Rendered by React; ids match the markup it
// replaced, because the keyboard shortcuts and tests address them.
export function EditorLayout() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
 const view = useSyncExternalStore(viewMode.subscribe, viewMode.get);
 const snapping = useSyncExternalStore(gridSnapState.subscribe, gridSnapState.get);
 const editing = useSyncExternalStore(editModeState.subscribe, editModeState.get);
 const hand = useSyncExternalStore(handModeState.subscribe, handModeState.get);
 const panning = useSyncExternalStore(panningState.subscribe, panningState.get);
 const deletingGuide = useSyncExternalStore(deletingGuideState.subscribe, deletingGuideState.get);
 const canvasClass = ['canvas', hand && 'hand', snapping && 'snapping', view === 'preview' && 'preview-mode', panning && 'panning',
  deletingGuide && 'deleting-guide'].filter(Boolean).join(' ');
 return (
  <>
    <div className={"layout"}>
      <aside className={"panel"}>
        <ObjectListHead />
        <label className={"sides-row"} hidden={true}>
          {"Sides / star points "}
          <input id={"sides"} type={"number"} min={"3"} max={"12"} defaultValue={"5"} />
        </label>
        <ObjectList />
        <HoopFields />
      </aside>
      <main className={view === 'design' ? 'design-view' : undefined}>
        <div className={canvasClass}>
          <div className={"tool-row tool-rail"} aria-label={"Tools"}>
            <SelectTool />
            <AddShapeButton kind={"rect"} id={"rect"} label={"Add rectangle"} icon={"rect"} />
            <AddShapeButton kind={"ellipse"} id={"ellipse"} label={"Add ellipse"} icon={"ellipse"} />
            <PathTool />
            <AddShapeButton kind={"text"} id={"letter"} label={"Add lettering"} icon={"text"} />
            <ToolButtons />
            <button
              className={"icon-button"}
              id={"traceBtn"}
              aria-label={"Trace a picture into filled shapes"}
              title={"Trace a picture into filled shapes"}
              data-tooltip={"Trace a picture into filled shapes"}
              onClick={() => setTraceDialogOpen(true)}
            >
              <svg className={"icon"}>
                <use href={"#i-trace"} />
              </svg>
            </button>
            <PhotoStitch />
            <PenTool />
          </div>
          <div className={"canvas-views"}>
            <ViewSwitch />
          </div>
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
          <div className={"floating"} role={"toolbar"} aria-label={"Canvas tools"}>
            <GridSnapButton />
            <SnapObjectButton />
            <GridControl />
            <AlignButtons />
            <FlipButtons />
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
            <BooleanButtons />
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
              aria-label={"Put the selected lettering on the selected path"}
              title={"Put the selected lettering on the selected path"}
              data-tooltip={"Put the selected lettering on the selected path"}
              id={"textOnPath"}
              onClick={() => selectionToolbarActions.textOnPath()}
            >
              <svg className={"icon"}>
                <use href={"#i-text-path"} />
              </svg>
            </ActionButton>
            <ActionButton flag="textOffPath" hideWhenDisabled
              className={"icon-button"}
              aria-label={"Detach lettering from its path"}
              title={"Detach lettering from its path"}
              data-tooltip={"Detach lettering from its path"}
              id={"textOffPath"}
              onClick={() => selectionToolbarActions.textOffPath()}
            >
              <svg className={"icon"}>
                <use href={"#i-text-detach"} />
              </svg>
            </ActionButton>
            <ActionButton flag="editNodes" hideWhenDisabled
              className={editing ? "icon-button tb-start active-tool" : "icon-button tb-start"}
              aria-label={"Edit nodes (Enter) — converts rectangles and ellipses to paths"}
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
          <svg id={"art"} viewBox={"-60 -60 120 120"} {...referenceCanvasHandlers}>
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
        <footer>
          <ToastStack />
          <PlaybackBar />
          <StatusRun />
        </footer>
      </main>
      <aside className={"panel"}>
        <SelectionHeading />
        <TipCard />
        <details id={"tipsSettings"} className={"tips-settings"}>
          <summary>
            {"Sewing tips to show"}
          </summary>
          <div id={"tipsList"} className={"tips-list"}>
          </div>
        </details>
        <SelectionHint />
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
          <h3 className={"scope-heading"}>
            {"Document"}
          </h3>
          <DocumentSettings />
          <DesignSummary />
          <FabricSection />
        </div>
      </aside>
    </div>
  </>
 );
}
