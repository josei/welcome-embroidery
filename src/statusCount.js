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
 * How many issues and sewing tips the issues chip counts: the warning count that the phone and tablet bar shows.
 * @param {{issues?: unknown[], tips?: unknown[]}} lists
 */
export function issueCount({issues = [], tips = []}) {
  return issues.length + tips.length;
}
