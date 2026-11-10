// The bounds of the numeric fields that the editor clamps (see numberField.js for the rule). Each one is the bound the validator
// (validate.js) enforces, or the field's declared range in code where the validator has none.
import type {FieldRange} from './numberField.js';

export type {FieldRange} from './numberField.js';
export {rangeText} from './numberField.js';

export const STITCH_LENGTH_RANGE: FieldRange = {min: 0.5, max: 7};
export const ROW_SPACING_RANGE: FieldRange = {min: 0.25, max: 1.2};
export const BORDER_WIDTH_RANGE: FieldRange = {min: 0, max: 12};
export const SATIN_WIDTH_RANGE: FieldRange = {min: 0.5, max: 12};
export const HOOP_SIDE_RANGE: FieldRange = {min: 10, max: 400};
/** A shape's width or height: the field's declared minimum; the validator sets no maximum. */
export const SHAPE_SIZE_RANGE: FieldRange = {min: 0.5, max: Infinity};
export const ANGLE_RANGE: FieldRange = {min: 0, max: 180};
