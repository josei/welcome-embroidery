// @ts-check
// Warnings about an export that a machine may refuse.

/**
 * @param {{bounds?: number[] | null}} plan
 * @param {string} [format]
 * @returns {string[]}
 */
export function jefWarnings(plan, format = 'jef'){if(format!=='jef'||!plan.bounds)return [];const w=plan.bounds[2]-plan.bounds[0],h=plan.bounds[3]-plan.bounds[1];return w>=200||h>=200?[`Warning: ${w.toFixed(0)} × ${h.toFixed(0)} mm is beyond the largest JEF hoop code (200 × 200 mm); the file gets hoop code 0 and no hoop-edge distances, and machines may reject it.`]:[];}
