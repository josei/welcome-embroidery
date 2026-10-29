import {layoutState} from '../layoutState.js';
import {PreviewPanel} from './PreviewPanel';
import {useSyncExternalStore} from 'react';
import {SelectionHint} from './SelectionHint';
import {ActionButton} from './ActionButton';
import {DesignSummary, SelectionHeading} from './InspectorText';
import {AlignButtons} from './AlignButtons';
import {ArrayPanel} from './ArrayPanel';
import {DocumentSettings} from './DocumentSettings';
import {HoopFields} from './HoopFields';
import {LetteringPanel} from './LetteringPanel';
import {PathNodeButtons} from './PathNodeButtons';
import {PathPanel} from './PathPanel';
import {ReferencePicture} from './ReferencePicture';
import {BooleanButtons, FlipButtons} from './SelectionToolbarButtons';
import {SewingOrder} from './SewingOrder';
import {SnapObjectButton} from './SnapObjectButton';
import {StatusRun} from './StatusRun';
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
import {PlaybackBar} from './PlaybackBar';
import {ViewSwitch} from './ViewSwitch';
// The editor layout: the object list, the canvas and the inspector. Rendered by React; ids match the markup it replaced, because app.js wires them by id.
export function EditorLayout() {
 const layout = useSyncExternalStore(layoutState.subscribe, layoutState.get);
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
      <main>
        <div className={"canvas"}>
          <div className={"tool-row tool-rail"} aria-label={"Tools"}>
            <SelectTool />
            <button className={"icon-button"} id={"rect"} aria-label={"Add rectangle"} title={"Add rectangle"} data-tooltip={"Add rectangle"}>
              <svg className={"icon"}>
                <use href={"#i-rect"} />
              </svg>
            </button>
            <button className={"icon-button"} id={"ellipse"} aria-label={"Add ellipse"} title={"Add ellipse"} data-tooltip={"Add ellipse"}>
              <svg className={"icon"}>
                <use href={"#i-ellipse"} />
              </svg>
            </button>
            <PathTool />
            <button className={"icon-button"} id={"letter"} aria-label={"Add lettering"} title={"Add lettering"} data-tooltip={"Add lettering"}>
              <svg className={"icon"}>
                <use href={"#i-text"} />
              </svg>
            </button>
            <ToolButtons />
            <button
              className={"icon-button"}
              id={"traceBtn"}
              aria-label={"Trace a picture into filled shapes"}
              title={"Trace a picture into filled shapes"}
              data-tooltip={"Trace a picture into filled shapes"}
            >
              <svg className={"icon"}>
                <use href={"#i-trace"} />
              </svg>
            </button>
            <button
              className={"icon-button"}
              id={"photo"}
              aria-label={"Photo stitch from a picture"}
              title={"Photo stitch from a picture"}
              data-tooltip={"Photo stitch from a picture"}
            >
              <svg className={"icon"}>
                <use href={"#i-photo"} />
              </svg>
            </button>
            <input id={"photoFile"} type={"file"} accept={"image/*"} hidden={true} />
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
          <div className={"zoombar"} role={"toolbar"} aria-label={"Zoom"}>
            <button type={"button"} id={"zoomOut"} className={"icon-button"} aria-label={"Zoom out (−)"} title={"Zoom out (−)"}>
              <svg className={"icon"}>
                <use href={"#i-minus"} />
              </svg>
            </button>
            <button type={"button"} id={"zoomPct"} className={"zoom-pct"} title={"Reset to 100% (Shift+0)"}>
              {"100%"}
            </button>
            <button type={"button"} id={"zoomIn"} className={"icon-button"} aria-label={"Zoom in (+)"} title={"Zoom in (+)"}>
              <svg className={"icon"}>
                <use href={"#i-new"} />
              </svg>
            </button>
            <button
              type={"button"}
              id={"handTool"}
              className={"icon-button"}
              aria-label={"Hand tool: drag to pan"}
              title={"Hand tool: drag to pan"}
              aria-pressed={"false"}
            >
              <svg className={"icon"}>
                <use href={"#i-hand"} />
              </svg>
            </button>
            <span className={"sep"}>
            </span>
            <button type={"button"} id={"zoomFit"} className={"zoom-text"} title={"Fit the hoop in view"}>
              {"Hoop"}
            </button>
            <button type={"button"} id={"zoomAll"} className={"zoom-text"} title={"Fit everything (Shift+1)"}>
              {"All"}
            </button>
          </div>
          <PreviewPanel />
          <div className={"floating"} role={"toolbar"} aria-label={"Canvas tools"}>
            <button className={"icon-button"} aria-label={"Snap to grid"} title={"Snap to grid"} data-tooltip={"Snap to grid"} id={"snap"}>
              <svg className={"icon"}>
                <use href={"#i-snap"} />
              </svg>
            </button>
            <SnapObjectButton />
            <select id={"grid"} className={"tb-wide"} aria-label={"Grid size"} defaultValue={"1"}>
              <option value={"0.1"}>
                {"0.1 mm"}
              </option>
              <option value={"0.25"}>
                {"0.25 mm"}
              </option>
              <option value={"0.5"}>
                {"0.5 mm"}
              </option>
              <option value={"1"}>
                {"1 mm"}
              </option>
              <option value={"2"}>
                {"2 mm"}
              </option>
              <option value={"5"}>
                {"5 mm"}
              </option>
            </select>
            <AlignButtons />
            <FlipButtons />
            <ActionButton flag="group" hideWhenDisabled className={"icon-button"} aria-label={"Group (Ctrl+G)"} title={"Group (Ctrl+G)"} data-tooltip={"Group (Ctrl+G)"} id={"group"}>
              <svg className={"icon"}>
                <use href={"#i-group"} />
              </svg>
            </ActionButton>
            <ActionButton flag="ungroup" hideWhenDisabled
              className={"icon-button"}
              aria-label={"Ungroup (Ctrl+Shift+G)"}
              title={"Ungroup (Ctrl+Shift+G)"}
              data-tooltip={"Ungroup (Ctrl+Shift+G)"}
              id={"ungroup"}
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
            >
              <svg className={"icon"}>
                <use href={"#i-text-detach"} />
              </svg>
            </ActionButton>
            <ActionButton flag="editNodes" hideWhenDisabled
              className={"icon-button tb-start"}
              aria-label={"Edit nodes (Enter) — converts rectangles and ellipses to paths"}
              title={"Edit nodes (Enter) — converts rectangles and ellipses to paths"}
              data-tooltip={"Edit nodes (Enter) — converts rectangles and ellipses to paths"}
              id={"editNodes"}
            >
              <svg className={"icon"}>
                <use href={"#i-node-edit"} />
              </svg>
            </ActionButton>
            <PathNodeButtons />
          </div>
          <svg id={"art"} viewBox={"-60 -60 120 120"}>
            <defs>
              <pattern id={"linen"} width={"2.6"} height={"2.6"} patternUnits={"userSpaceOnUse"}>
                <path d={"M0 0H2.6M0 0V2.6"} stroke={"#a9a397"} strokeOpacity={".11"} strokeWidth={".18"} />
              </pattern>
            </defs>
            <rect id={"hoopOuter"} className={"hoop-outer"} x={"-58"} y={"-58"} width={"116"} height={"116"} rx={"7"} />
            <rect id={"hoopRing"} className={"hoop"} x={"-54"} y={"-54"} width={"108"} height={"108"} rx={"4"} />
            <rect id={"hoopLinen"} className={"linen"} x={"-52.8"} y={"-52.8"} width={"105.6"} height={"105.6"} rx={"3"} />
            <g id={"refLayer"} pointerEvents={"none"}>
            </g>
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
        </div>
        <footer>
          <PlaybackBar />
          <StatusRun />
        </footer>
      </main>
      <aside className={"panel"}>
        <SelectionHeading />
        <div id={"sewTips"} className={"sew-tips"} role={"status"} hidden={true}>
        </div>
        <details id={"tipsSettings"} className={"tips-settings"}>
          <summary>
            {"Sewing tips to show"}
          </summary>
          <div id={"tipsList"} className={"tips-list"}>
          </div>
        </details>
        <SelectionHint />
        <section id={"sourceInfo"} hidden={true}>
        </section>
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
        <DocumentSettings />
        <DesignSummary />
      </aside>
    </div>
  </>
 );
}
