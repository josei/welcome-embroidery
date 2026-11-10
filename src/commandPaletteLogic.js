// @ts-check
// The command palette's rules, with no editor imports so the node tests can run them: which commands match a query,
// the Recent list, and what repeat-last-action does. commandRegistry.ts supplies the commands and runs them.

/** How many commands the Recent group keeps. */
export const RECENT_LIMIT = 5;

/**
 * @typedef {object} PaletteEntry
 * @property {string} id
 * @property {string} label the text the user sees, already translated
 */

/**
 * What the palette remembers between runs.
 * @typedef {object} PaletteMemory
 * @property {string[]} recent command ids, most recent first, no repeats, at most RECENT_LIMIT
 * @property {string | null} lastEdit the last command that recorded an undo entry; repeat-last-action runs it
 */

/** @type {PaletteMemory} */
export const EMPTY_MEMORY = {recent: [], lastEdit: null};

/**
 * The commands whose label contains the query, ignoring case. An empty query matches everything, in list order.
 * @template {PaletteEntry} T
 * @param {T[]} commands
 * @param {string} query
 * @returns {T[]}
 */
export function filterCommands(commands, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  return commands.filter(command => command.label.toLowerCase().includes(needle));
}

/**
 * The Recent group: the remembered ids that exist in the list, in recency order. The palette shows it only while the
 * query is empty, so typing narrows the full list alone.
 * @template {PaletteEntry} T
 * @param {T[]} commands
 * @param {string[]} recent
 * @returns {T[]}
 */
export function recentCommands(commands, recent) {
  /** @type {T[]} */
  const found = [];
  for (const id of recent) {
    const command = commands.find(c => c.id === id);
    if (command) found.push(command);
  }
  return found;
}

/**
 * Memory after a command runs. It moves to the front of Recent, and it becomes the repeat target only when it recorded
 * an undo entry. Running the repeat target again leaves it as the target.
 * @param {PaletteMemory} memory
 * @param {string} id
 * @param {boolean} recordedUndo
 * @returns {PaletteMemory}
 */
export function rememberRun(memory, id, recordedUndo) {
  return {
    recent: [id, ...memory.recent.filter(other => other !== id)].slice(0, RECENT_LIMIT),
    lastEdit: recordedUndo ? id : memory.lastEdit,
  };
}

/**
 * What repeat-last-action should do.
 * `run` re-runs the target; `none` means there is no previous edit; `disabled` means the target does not apply now.
 * @param {PaletteMemory} memory
 * @param {(id: string) => boolean} enabled
 * @returns {{kind: 'run', id: string} | {kind: 'none'} | {kind: 'disabled', id: string}}
 */
export function repeatPlan(memory, enabled) {
  if (!memory.lastEdit) return {kind: 'none'};
  return enabled(memory.lastEdit) ? {kind: 'run', id: memory.lastEdit} : {kind: 'disabled', id: memory.lastEdit};
}
