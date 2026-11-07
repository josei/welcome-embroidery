// @ts-check
// Stitch planning: turns shapes into runs of needle positions.
//   run = {pts:[[x,y],...], jump?:true}  consecutive points are stitched; `jump` forces a thread break before the run.
// Fills use an auto-fill planner: parallel rows are chained into continuous strips, the strips are ordered by travel
// cost, and travel between strips follows the shape's outline (or a hole's edge) with ordinary stitches instead of jumping.
// Needle penetrations in neighbouring rows are staggered so they do not line up into visible ridges.
// The planners live in ./stitchplan/: geometry helpers, row fills and the remaining fill patterns. This file is
// the public entry point, so importers keep using './stitchplan.js'.

/** @typedef {import('./geom.js').Pt} Pt */
/** @typedef {{pts: Pt[], jump?: boolean}} Run */
/** @typedef {{k: number, y: number, x0: number, x1: number, prev: Seg|null, next: Seg|null, chain: number}} Seg */
/** @typedef {{ring: number, d: number, s: number, i: number}} Best */
/** @typedef {{ci: number, reversed: boolean, startLeft: boolean, start: Pt}} Opt */
/** @typedef {{o: Opt, key: number}} Choice */
/**
 * @typedef {{spacing?: number, angle?: number, length?: number, stagger?: number, maxTravel?: number, travelStep?: number, linkTol?: number, insideTravel?:
  * number, from?: Pt|null, rowPick?: ((k: number, y: number, minY: number, maxY: number) => boolean)|null, variance?: number, underpath?: boolean, accordion?:
  * [number, number, (string|boolean)?]|null}} FillOptions
 */

export {sampleRun, buildBoundary, makeInside, insetRings, sampleLine} from './stitchplan/geometry.js';
export {rowOffset, chainRuns, planFill, planContour, planFillUnderlay, planContourFill} from './stitchplan/fill.js';
export {planSpiralFill, planGuidedFill, planMeanderFill, planCrossStitch, planRippleFill, planPhoto} from './stitchplan/patterns.js';
