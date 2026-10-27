// The align and distribute buttons above the canvas. Which are disabled comes from alignState, set by app.js from the selection.
import {useSyncExternalStore} from 'react';
import {alignActions, alignState} from '../alignState.js';

export function AlignButtons() {
 const state = useSyncExternalStore(alignState.subscribe, alignState.get);
 return (
  <>
   <button
    className="icon-button tb-start"
    data-align="left"
    aria-label="Align left"
    title="Align left"
    data-tooltip="Align left"
    disabled={state.align}
    onClick={() => alignActions.press('left')}
   ><svg className="icon"><use href="#i-al-left"/></svg></button>
   <button
    className="icon-button"
    data-align="hcenter"
    aria-label="Align horizontal centers"
    title="Align horizontal centers"
    data-tooltip="Align horizontal centers"
    disabled={state.align}
    onClick={() => alignActions.press('hcenter')}
   ><svg className="icon"><use href="#i-al-hcenter"/></svg></button>
   <button
    className="icon-button"
    data-align="right"
    aria-label="Align right"
    title="Align right"
    data-tooltip="Align right"
    disabled={state.align}
    onClick={() => alignActions.press('right')}
   ><svg className="icon"><use href="#i-al-right"/></svg></button>
   <button
    className="icon-button"
    data-align="top"
    aria-label="Align top"
    title="Align top"
    data-tooltip="Align top"
    disabled={state.align}
    onClick={() => alignActions.press('top')}
   ><svg className="icon"><use href="#i-al-top"/></svg></button>
   <button
    className="icon-button"
    data-align="vcenter"
    aria-label="Align vertical centers"
    title="Align vertical centers"
    data-tooltip="Align vertical centers"
    disabled={state.align}
    onClick={() => alignActions.press('vcenter')}
   ><svg className="icon"><use href="#i-al-vcenter"/></svg></button>
   <button
    className="icon-button"
    data-align="bottom"
    aria-label="Align bottom"
    title="Align bottom"
    data-tooltip="Align bottom"
    disabled={state.align}
    onClick={() => alignActions.press('bottom')}
   ><svg className="icon"><use href="#i-al-bottom"/></svg></button>
   <button
    className="icon-button tb-start"
    data-distribute="horizontal"
    aria-label="Distribute horizontally"
    title="Distribute horizontally"
    data-tooltip="Distribute horizontally"
    disabled={state.distribute}
    onClick={() => alignActions.press('horizontal')}
   ><svg className="icon"><use href="#i-dist-h"/></svg></button>
   <button
    className="icon-button"
    data-distribute="vertical"
    aria-label="Distribute vertically"
    title="Distribute vertically"
    data-tooltip="Distribute vertically"
    disabled={state.distribute}
    onClick={() => alignActions.press('vertical')}
   ><svg className="icon"><use href="#i-dist-v"/></svg></button>
  </>
 );
}
