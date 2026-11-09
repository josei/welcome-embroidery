// @ts-check
// The runtime the bootstrap fills once: the canvas, the render loop, the document transaction helpers and the services
// the unmounted controls call. Modules read these instead of importing the bootstrap, so the import graph stays acyclic.
/**
 * @typedef {{
 *   canvas: any,
 *   render: () => void,
 *   toast: (message: string, kind?: 'status' | 'error') => void,
 *   edit: (operations: any[], after?: () => void, coalesceKey?: string, label?: string) => boolean,
 *   transact: (fn: () => void) => boolean,
 *   compile: any,
 *   autosave: {schedule: () => void} | null,
 *   syncThreads: (() => void) | null,
 *   renderPlan: (() => void) | null,
 * }} EditorRuntime
 */

/** @type {EditorRuntime} */
export const editor = {
  canvas: null,
  render() {},
  toast() {},
  edit() { return false; },
  transact() { return false; },
  compile: null,
  autosave: null,
  syncThreads: null,
  renderPlan: null,
};
