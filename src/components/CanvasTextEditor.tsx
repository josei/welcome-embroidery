import {useEffect, useRef, useSyncExternalStore} from 'react';
import type {FormEvent, KeyboardEvent} from 'react';
import {interactionState} from '../interactionState.js';
import {finishCanvasText, liveCanvasText} from '../canvasText.js';
import {t} from '../i18n.js';
import {selectAllInField} from './selectAllKey';

// The lettering text box over the canvas. interactionState.canvasText says which object is being edited and where its
// screen rectangle is; typing updates the object's text and width, Enter commits as one undo step, Shift+Enter adds a
// line, Escape cancels and restores the original text, and leaving the box commits.
// Whether the most recent input was from the keyboard. A box opened from the keyboard (Add lettering, Enter) shows a
// focus ring; one opened by a mouse or touch press does not, so mouse editing looks as it always did.
let keyboardInput = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { keyboardInput = true; }, true);
  window.addEventListener('pointerdown', () => { keyboardInput = false; }, true);
}

// The box keeps its place over the object, but never runs past the canvas edge. A left offset is a percentage of the canvas
// width (the box is positioned in .canvas), so the right edge stays 8 px inside it even when the canvas is narrower than
// the box wants; the width shrinks to the canvas on a phone. The box is never shorter than 44 px, a touch target.
function fitInCanvas(c: {left: number; top: number; width: number; height: number}) {
  return {
    left: `min(${c.left}px, calc(100% - ${c.width}px - 8px))`,
    top: c.top,
    width: `min(${c.width}px, calc(100% - 16px))`,
    height: c.height,
  };
}

export function CanvasTextEditor() {
  const {canvasText} = useSyncExternalStore(interactionState.subscribe, interactionState.get);
  const box = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    finished.current = false;
    const focusAndSelect = () => {
      box.current?.focus();
      box.current?.select();
    };
    focusAndSelect();
    box.current?.classList.toggle('keyboard-focus', keyboardInput);
    // A box placed by a canvas click opens under the pointer, so the release of that click lands on the textarea and
    // moves the caret to the end of the placeholder. Two cases, both covered so the result does not depend on how
    // fast React commits: a release that already happened before this effect ran is handled by the zero-delay timer,
    // and a release still to come is handled by the listener. Only a release within a second of opening counts, so a
    // later click in the box still places the caret where the user clicks.
    // Each re-select applies only while the box still holds its original text, so a late one can never select over
    // characters the user has already typed.
    const original = canvasText?.original ?? null;
    const reselect = () => {
      if (box.current && box.current.value === original) focusAndSelect();
    };
    const opened = performance.now();
    const timer = window.setTimeout(reselect, 0);
    const onRelease = () => {
      if (performance.now() - opened < 1000) window.setTimeout(reselect, 0);
    };
    window.addEventListener('pointerup', onRelease, {once: true, capture: true});
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerup', onRelease, {capture: true});
    };
  }, [canvasText]);
  if (!canvasText) return null;
  const finish = (commit: boolean, value: string) => {
    if (finished.current) return;
    finished.current = true;
    finishCanvasText(commit, value);
  };
  const input = (e: FormEvent<HTMLTextAreaElement>) => liveCanvasText(canvasText.id, e.currentTarget.value);
  // Enter and Escape close the box from the keyboard, so focus goes to the Add lettering button rather than being lost to
  // BODY. Leaving the box by clicking elsewhere (blur) keeps focus where the user put it.
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    selectAllInField(e);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finish(true, e.currentTarget.value);
      document.getElementById('letter')?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false, e.currentTarget.value);
      document.getElementById('letter')?.focus();
    } else if (e.key === 'Tab' && e.shiftKey) {
      // Shift+Tab from the box goes back to the object it edits (its first selection handle, the one Tab reaches
      // from Add lettering), not to BODY. The text is committed as when the box is left by clicking outside.
      e.preventDefault();
      finish(true, e.currentTarget.value);
      document.querySelector<HTMLElement>('#art .sel-handle')?.focus();
    }
  };
  // The caption sits at the bottom of the canvas, away from the floating toolbar at the top, and says what each key and a
  // click outside do while the box is open. It is described by the box, so screen readers announce it too.
  return (
    <>
      <textarea
        id="canvasText"
        ref={box}
        defaultValue={canvasText.original}
        maxLength={canvasText.maxLength}
        aria-label="Edit text content"
        aria-describedby="canvasTextHint"
        style={fitInCanvas(canvasText)}
        onInput={input}
        onKeyDown={keyDown}
        onPointerDown={e => e.currentTarget.classList.remove('keyboard-focus')}
        onBlur={e => finish(true, e.currentTarget.value)}
      />
      <p id="canvasTextHint" className="canvas-hint canvas-text-hint">
        {t('Enter or clicking outside saves the text. Escape cancels.')}
      </p>
    </>
  );
}
