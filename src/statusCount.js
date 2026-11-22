// @ts-check
// What the status run's design count and issues chip show for a compile. Kept apart from the editor so a unit test can
// check the state without a browser.

/**
 * The design count's state, in every view. `figure` is whether a compile that did not fail gives a count, which a phone or
 * tablet shows as an icon and its number. `error` is whether the design has an error (a compile failure, or an object past
 * the hoop), which the bar shows in the warning colour.
 * @param {{plan: {errors?: unknown[]} | null | undefined, compileError: string | null | undefined}} input
 */
export function designCountState({plan, compileError}) {
  return {
    figure: Boolean(plan && !compileError),
    error: Boolean(compileError) || Boolean(plan?.errors?.length),
  };
}

/**
 * The objects the issues chip points at, each once and in the order they were reported. A past-the-hoop issue and a
 * sewing tip about the same object share its id, so the chip counts and cycles through that object once.
 * @param {{issues?: {id: string}[], tips?: {id: string}[]}} lists
 * @returns {string[]}
 */
export function issueObjectIds({issues = [], tips = []}) {
  return [...new Set([...issues, ...tips].map(item => item.id))];
}

/**
 * How many objects the issues chip counts: each object that has an issue or a sewing tip, counted once.
 * @param {{issues?: {id: string}[], tips?: {id: string}[]}} lists
 */
export function issueCount(lists) {
  return issueObjectIds(lists).length;
}
