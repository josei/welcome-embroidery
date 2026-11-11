// @ts-check
// Whether an imported stitch layer reaches past the hoop, read from the plan the compile of that document produced.
// The compile reports each object past the hoop in plan.issues with the object's id; a plan for another revision says nothing.

/**
 * @param {{revision?: number, issues?: {id: string}[]} | null | undefined} plan the compiled plan, or null
 * @param {number} revision the document revision the layer was imported into
 * @param {string} layerId the imported layer's id
 * @returns {boolean}
 */
export function layerPastHoop(plan, revision, layerId) {
  if (!plan || plan.revision !== revision) return false;
  return Boolean(plan.issues?.some(issue => issue.id === layerId));
}
