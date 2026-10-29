import {createStore} from './store.js';

/** One thread block of the plan: its thread, and its range in the command list. */
export interface PlaybackSpan {
  thread: string;
  start: number;
  end: number;
}

/**
 * The simulation bar's state. app.js sets it on each change: the play state, the seek position (commands before it are sewn)
 * and its range, the sewn stitches and time, the thread blocks, and the summary figures. The bar's controls call playbackActions.
 */
export interface Playback {
  hasPlan: boolean;
  ready: boolean;
  playing: boolean;
  index: number;
  seekMax: number;
  count: number;
  sewn: number;
  sewnSeconds: number;
  totalSeconds: number;
  spans: PlaybackSpan[];
  colourChanges: number;
  trims: number;
  metres: number;
}

export const playbackState = createStore<Playback>({
  hasPlan: false,
  ready: true,
  playing: false,
  index: 0,
  seekMax: 1,
  count: 0,
  sewn: 0,
  sewnSeconds: 0,
  totalSeconds: 0,
  spans: [],
  colourChanges: 0,
  trims: 0,
  metres: 0,
});

/** Replaces the bar's state. app.js calls it whenever the plan or the playback position changes. */
export function setPlayback(next: Playback) {
  playbackState.set(next);
}

/** The bar's controls call these. app.js runs them. */
export const playbackActions: {togglePlay: () => void; restart: () => void; seek: (index: number) => void} = {
  togglePlay() {},
  restart() {},
  seek() {},
};
