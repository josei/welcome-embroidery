import {createStore} from './store.js';

/** The stitch layer's source file, as the inspector shows it above the transform fields. */
export interface SourceInfo {
  /** The source format, e.g. "JEF stitch layer". */
  format: string;
  /** The file's name and author, when the source carries them. */
  meta: string;
  /** The command and thread counts, the file and its size, and the source bounds. */
  details: string[];
  /** What the import warned about, one line each. */
  warnings: string[];
}

/**
 * The inspector heading (the selected object's name), the design summary line and a stitch layer's source details.
 * stitchPanel.ts sets the heading from the selection; inspector.ts sets the summary and the source details per render.
 */
export interface InspectorText {
  heading: string;
  summary: string;
  source: SourceInfo | null;
}

export const inspectorTextState = createStore<InspectorText>({
  heading: 'Select an object',
  summary: 'No generated stitches.',
  source: null,
});

/** Changes some of the inspector text. */
export function setInspectorText(patch: Partial<InspectorText>) {
  inspectorTextState.set({...inspectorTextState.get(), ...patch});
}
