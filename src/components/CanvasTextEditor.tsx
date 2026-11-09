import {useEffect, useRef, useSyncExternalStore} from 'react';
import type {FormEvent, KeyboardEvent} from 'react';
import {interactionState} from '../interactionState.js';
import {finishCanvasText, liveCanvasText} from '../canvasText.js';

// The lettering text box over the canvas. interactionState.canvasText says which object is being edited and where its
// screen rectangle is; typing updates the object's text and width, Enter commits as one undo step, Shift+Enter adds a
// line, Escape cancels and restores the original text, and leaving the box commits.
export function CanvasTextEditor() {
  const {canvasText} = useSyncExternalStore(interactionState.subscribe, interactionState.get);
  const box = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    finished.current = false;
    box.current?.focus();
    box.current?.select();
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finish(true, e.currentTarget.value);
      document.getElementById('letter')?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false, e.currentTarget.value);
      document.getElementById('letter')?.focus();
    }
  };
  return (
    <textarea
      id="canvasText"
      ref={box}
      defaultValue={canvasText.original}
      maxLength={canvasText.maxLength}
      aria-label="Edit lettering text"
      style={{left: canvasText.left, top: canvasText.top, width: canvasText.width, height: canvasText.height}}
      onInput={input}
      onKeyDown={keyDown}
      onBlur={e => finish(true, e.currentTarget.value)}
    />
  );
}
