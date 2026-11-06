import {viewActions, viewMode} from './viewMode.js';

/** What switching the view needs from the editor, supplied by app.js. */
export interface ViewApi {
  /** Whether a compiled plan is already there, so leaving Design does not recompile. */
  hasPlan(): boolean;
  /** Stops the stitch simulation and clears its position. */
  stopPlayback(): void;
  /** Compiles the document for the stitch or 3D view. */
  compile(): void;
  render(): void;
}

/** Wires the header's view switch, once: it stops playback, compiles when needed and redraws. */
export function configureViewCommands(next: ViewApi) {
  viewActions.choose = chosen => {
    viewMode.set(chosen);
    if (chosen === 'design') next.stopPlayback();
    if (chosen !== 'design' && !next.hasPlan()) next.compile();
    next.render();
  };
}
