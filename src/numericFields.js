// @ts-check
// Stepping for numeric fields, the same on every field. Up and Down move the value by the field's own step attribute;
// Shift multiplies that step by 10 and Alt by 0.1, as the canvas nudge keys do in spirit. Ctrl and Cmd do nothing here.
// Dragging across a field's label scrubs its value with the same multipliers. Both clamp to the field's min and max.
// Nothing commits while the value changes: the field keeps the typed text and commits once on Enter or blur (useDraftInput),
// so an arrow run or a scrub drag is one undo step, the same as typing one value.

/** The step multiplier for the modifier keys: Shift is ten times coarser, Alt a tenth. */
/** @param {{shiftKey: boolean, altKey: boolean}} mods */
export function stepMultiplier(mods) {
  if (mods.shiftKey) return 10;
  if (mods.altKey) return 0.1;
  return 1;
}

/** The number of decimals in a step such as 0.05 (2) or 5 (0). */
/** @param {number} step */
function decimalsOf(step) {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * The value one step away from current. step is the field's step attribute (1 when missing or 'any'); dir is 1 for Up
 * and -1 for Down. The result is rounded past the step's own precision so 2 + 0.05 reads 2.05, and clamped to min and
 * max when they are given.
 */
/**
 * @param {number} current
 * @param {1 | -1} dir
 * @param {number} step
 * @param {{shiftKey: boolean, altKey: boolean}} mods
 * @param {{min?: number, max?: number}} [bounds]
 */
export function steppedValue(current, dir, step, mods, bounds = {}) {
  const amount = step * stepMultiplier(mods);
  const raw = current + dir * amount;
  return clamp(round(raw, decimalsOf(step) + 2), bounds);
}

/** The value a scrub reaches: the start value moved by whole steps of pixels, then clamped and rounded. */
/**
 * @param {number} start
 * @param {number} dx
 * @param {number} pixelsPerStep
 * @param {number} step
 * @param {{shiftKey: boolean, altKey: boolean}} mods
 * @param {{min?: number, max?: number}} [bounds]
 */
export function scrubValue(start, dx, pixelsPerStep, step, mods, bounds = {}) {
  const steps = Math.round(dx / pixelsPerStep);
  const raw = start + steps * step * stepMultiplier(mods);
  return clamp(round(raw, decimalsOf(step) + 2), bounds);
}

/** @param {number} value @param {number} decimals */
function round(value, decimals) {
  return Number(value.toFixed(decimals));
}

/** @param {number} value @param {{min?: number, max?: number}} bounds */
function clamp(value, bounds) {
  let v = value;
  if (bounds.min !== undefined && v < bounds.min) v = bounds.min;
  if (bounds.max !== undefined && v > bounds.max) v = bounds.max;
  return v;
}

/** A field's step attribute as a number; 1 (the browser's default) when missing, 'any' or not a positive number. */
/** @param {HTMLInputElement} input */
export function stepOf(input) {
  const step = Number.parseFloat(input.step);
  return Number.isFinite(step) && step > 0 ? step : 1;
}

/** @param {HTMLInputElement} input */
function boundsOf(input) {
  const min = input.min === '' ? NaN : Number(input.min);
  const max = input.max === '' ? NaN : Number(input.max);
  return {min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined};
}

/**
 * Sets a React-controlled input's value and tells React, as typing does, so its onChange sees the new text.
 * React tracks the value it last rendered, so the native setter is used to bypass that tracking.
 */
/** @param {HTMLInputElement} input @param {string} text */
function setFieldText(input, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', {bubbles: true}));
}

const PIXELS_PER_STEP = 5;
const DRAG_THRESHOLD = 3;

/** Mounts the stepping and label scrubbing for every number field. Call once at start-up. */
export function mountNumericFields() {
  document.addEventListener('keydown', e => {
    const input = /** @type {EventTarget | null} */ (e.target);
    if (!(input instanceof HTMLInputElement) || input.type !== 'number') return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) return;
    const current = Number.parseFloat(input.value);
    const next = steppedValue(Number.isFinite(current) ? current : 0, e.key === 'ArrowUp' ? 1 : -1, stepOf(input), e, boundsOf(input));
    setFieldText(input, String(next));
  }, true);

  // A drag that starts on a field's label scrubs that field. Below the threshold it is an ordinary click on the label,
  // which focuses the field as it always did. Past it, the field takes focus, follows the pointer and commits on release.
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    const label = e.target.closest('label');
    if (!label || e.target.closest('input, select, textarea, button')) return;
    const input = label.querySelector('input[type="number"]');
    if (!(input instanceof HTMLInputElement) || input.disabled) return;
    const startX = e.clientX;
    const startValue = Number.parseFloat(input.value);
    if (!Number.isFinite(startValue)) return;
    let scrubbing = false;
    /** @param {PointerEvent} m */
    const move = m => {
      const dx = m.clientX - startX;
      if (!scrubbing) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        scrubbing = true;
        input.focus();
        document.body.style.userSelect = 'none';
      }
      m.preventDefault();
      setFieldText(input, String(scrubValue(startValue, dx, PIXELS_PER_STEP, stepOf(input), m, boundsOf(input))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!scrubbing) return;
      document.body.style.userSelect = '';
      // The click that ends a drag on the label would focus the field again; it is part of the scrub, so drop it.
      window.addEventListener('click', swallowClick, {capture: true, once: true});
      input.blur();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

/** @param {Event} e */
function swallowClick(e) {
  e.preventDefault();
  e.stopPropagation();
}
