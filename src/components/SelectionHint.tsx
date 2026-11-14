import {useSyncExternalStore} from 'react';
import {selectionLabelsState} from '../selectionLabelsState.js';
import {inputMode} from '../inputMode.js';
import {isTouchFitPointer} from '../fitMargin.js';
import {t} from '../i18n.js';

// The hint shown when nothing is selected. It hides as soon as something is, through selectionLabelsState. A touch screen
// has no click or box drag, so its wording names taps; a mouse keeps the original wording.
export function SelectionHint() {
 const {hintHidden} = useSyncExternalStore(selectionLabelsState.subscribe, selectionLabelsState.get);
 const touch = useSyncExternalStore(inputMode.subscribe, inputMode.get) === 'touch' || isTouchFitPointer();
 const text = touch
   ? t('Nothing selected. Tap an object to select it, tap another to add it, or pick a tool on the left.')
   : t('Nothing selected. Click an object, drag a box around several, or pick a tool on the left.');
 return (
  <p id="selHint" className="sel-hint" hidden={hintHidden}>{text}</p>
 );
}
