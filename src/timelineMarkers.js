// @ts-check
// Places the colour-change markers on the simulation timeline. Each marker is a 24 px button centred on its change, and the
// CSS keeps the centre inside the track. Two changes closer than a button's width would sit on top of each other, so they
// are joined into one group whose button selects the first change in it. Every group's centre is at least `minGapPx` from
// the next, so no two buttons overlap, and every change is still reached by playing or dragging the timeline.

/** The button's half-width in px: the CSS clamps a marker's centre this far in from either end of the track. */
export const MARKER_EDGE_PX = 12;

/**
 * @typedef {{index: number, count: number, start: number, seconds: number, thread: string, at: number}} MarkerGroup
 * index is the span index of the first change in the group; at is its place along the track, from 0 to 1.
 */

/**
 * Groups the colour-change markers so that no two buttons overlap.
 * @param {{thread: string, start: number, seconds: number}[]} spans the playback spans; the first is the start of the plan, not a change
 * @param {number} seekMax the length of the seek range
 * @param {number} trackPx the track's width in px, or 0 when it is not measured yet (then nothing is grouped)
 * @param {number} [minGapPx] the least distance between two button centres, in px
 * @returns {MarkerGroup[]}
 */
export function groupColourMarkers(spans, seekMax, trackPx, minGapPx = 24) {
  const changes = spans.slice(1).map((s, i) => ({
    index: i + 1,
    count: 1,
    start: s.start,
    seconds: s.seconds,
    thread: s.thread,
    at: seekMax > 0 ? s.start / seekMax : 0,
  }));
  if (!(trackPx > 0)) return changes;
  // Where the CSS puts each centre, in px from the track's left edge.
  /** @param {MarkerGroup} m */
  const px = m => Math.min(Math.max(m.at * trackPx, MARKER_EDGE_PX), trackPx - MARKER_EDGE_PX);
  const groups = [];
  for (const change of changes) {
    const last = groups[groups.length - 1];
    if (last && px(change) - px(last) < minGapPx) {
      last.count++;
    } else {
      groups.push(change);
    }
  }
  return groups;
}
