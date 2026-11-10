import {createStore} from './store.js';
import {threadName} from './threadPalette.js';

/** One option of a select the stitch panel draws. */
export interface PanelOption {
  value: string;
  label: string;
}

/**
 * The selection-derived values the stitch panel shows that no other store holds: the stitch length and the underlay
 * inset and spacing, the thread and follow-path selects, the blend values, and which path tools apply to the selection.
 * stitchPanel.ts sets them from the selection; the panel components read them and call stitchPanelActions.
 */
export interface StitchPanelState {
  stitchLength: string;
  underlayInset: string;
  underlaySpacing: string;
  threadOptions: PanelOption[];
  threadValue: string;
  followPathOptions: PanelOption[];
  followPathValue: string;
  blendThread: string;
  blendPalette: string[];
  blendAngle: string;
  blendStart: string;
  blendEnd: string;
  pathOffset: boolean;
  pathStroke: boolean;
  pathSimplify: boolean;
  pathReverse: boolean;
  pathSplit: boolean;
  pathJoin: boolean;
}

const DEFAULT_THREADS = ['#527461', '#d9897e', '#d3ad61', '#89a377'];

export const stitchPanelState = createStore<StitchPanelState>({
  stitchLength: '3',
  underlayInset: '0.4',
  underlaySpacing: '2.2',
  threadOptions: DEFAULT_THREADS.map(value => ({value, label: threadName(value)})),
  threadValue: DEFAULT_THREADS[0],
  followPathOptions: [],
  followPathValue: '',
  blendThread: '',
  blendPalette: ['', '', '', ''],
  blendAngle: '',
  blendStart: '0',
  blendEnd: '100',
  pathOffset: true,
  pathStroke: true,
  pathSimplify: true,
  pathReverse: true,
  pathSplit: true,
  pathJoin: true,
});

/** Changes some of the stitch panel values. */
export function setStitchPanel(patch: Partial<StitchPanelState>) {
  stitchPanelState.set({...stitchPanelState.get(), ...patch});
}

/** The panel's fields call these when the user commits a value or picks an option. stitchPanel.ts runs the edit. */
export const stitchPanelActions: {
  commitValue: (field: 'stitchLength' | 'underlayInset' | 'underlaySpacing', text: string) => boolean | void;
  resetFill: () => void;
  chooseThread: (value: string) => void;
  chooseFollowPath: (value: string) => void;
  chooseBlendThread: (value: string) => void;
  chooseBlendPalette: (index: number, value: string) => void;
  commitBlendAngle: (text: string) => void;
  commitBlendRange: (field: 'blendStart' | 'blendEnd', text: string) => void;
} = {
  commitValue() {},
  resetFill() {},
  chooseThread() {},
  chooseFollowPath() {},
  chooseBlendThread() {},
  chooseBlendPalette() {},
  commitBlendAngle() {},
  commitBlendRange() {},
};
