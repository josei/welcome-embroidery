// @ts-check
// Turns the first `limit` items of a compiled plan into SVG path data: sewn thread per colour, and the travel
// moves (jumps) as one path. The machine starts at the hoop centre (0, 0), so a plan that opens with a jump has its
// approach drawn as travel from the origin. Pure: no DOM, so it can be tested under node.

/**
 * @param {{x: number, y: number, cmd: string, thread?: string}[]} stitches
 * @param {number} limit how many items to read from the start
 * @param {string} defaultColour thread colour used before the plan names one
 * @returns {{paths: Map<string, string>, travel: string, needle: {x: number, y: number} | null}}
 */
export function buildThreadPaths(stitches, limit, defaultColour) {
  /** @type {Map<string, string>} */
  const paths = new Map();
  let travel = '', needle = null, color = defaultColour;
  // `last` is where the needle is; null after a trim or end, so no line is drawn from it. `started` is false until
  // the first command, so a leading jump is drawn from the hoop centre rather than from nowhere.
  let last = /** @type {{x: number, y: number} | null} */ (null), started = false;
  const origin = {x: 0, y: 0};
  for (let i = 0; i < limit; i++) {
    const item = stitches[i];
    if (item.cmd === 'jump') {
      const from = last || (started ? null : origin);
      if (from) travel += `M${from.x},${from.y}L${item.x},${item.y}`;
      last = item; started = true;
      continue;
    }
    started = true;
    if (item.cmd === 'color') { color = item.thread || color; last = {x: item.x, y: item.y}; continue; }
    if (item.cmd === 'trim' || item.cmd === 'end') { last = null; continue; }
    if (item.cmd === 'stop') continue;
    if (item.cmd === 'stitch') {
      if (last) paths.set(color, (paths.get(color) || '') + `M${last.x},${last.y}L${item.x},${item.y}`);
      last = item;
      needle = item;
    }
  }
  return {paths, travel, needle};
}
