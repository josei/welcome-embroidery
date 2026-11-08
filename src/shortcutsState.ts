import {createStore} from './store.js';
import {shortcutLabel} from './shortcutLabels.js';

// The keyboard shortcuts, in the order the dialog lists them. Titles and keys are translated when the dialog renders.
// Labels come from shortcutLabel, so Apple platforms read ⌘ ⌥ ⇧ and other platforms read Ctrl and Alt.
const M = {mod: true} as const;
export const SHORTCUTS: Array<[string, Array<[string, string]>]>
  = [[
  'File',[[shortcutLabel([{...M, key: 'S'}]),'Save'],[shortcutLabel([{...M, shift: true, key: 'S'}]),'Save As'],[shortcutLabel([{...M, key: 'O'}]),'Open'],[shortcutLabel([{...M, key: 'N'}]),'New']]],
 [
  'Tools',[['V','Select'],['R','Rectangle'],['O','Ellipse'],['T','Lettering'],['N','Draw path'],['P','Pen with curves'],['L','Line'],['G','Polygon'],['S',
  'Star'],['Enter','Edit nodes / finish a path'],['Esc','Cancel, go back to select']]],
 [
   'Edit',[[shortcutLabel([{...M, key: 'Z'}, ' / ', {...M, key: 'Y'}]),'Undo / redo'],[shortcutLabel([{...M, key: 'C'}, ' / X / V']),'Copy, cut, paste'],
   [shortcutLabel([{...M, key: 'D'}]),'Duplicate'],[shortcutLabel([{...M, alt: true, key: 'C'}, ' / ', {...M, alt: true, key: 'V'}]),'Copy / paste style'],['Del',
   'Delete'],[shortcutLabel([{...M, key: 'A'}]),'Select all'],[shortcutLabel([{...M, key: 'G'}, ' / ', {...M, shift: true, key: 'G'}]),'Group / ungroup'],
   [shortcutLabel([{...M, shift: true, key: 'C'}]),'Convert to path'],['Arrow keys',
   'Nudge (Shift = 5 mm, Alt = 0.1 mm)'],[shortcutLabel([{...M, key: 'Arrows', appleKey: '←↑→↓'}]),'Resize'],[shortcutLabel([{...M, alt: true, key: '←'}, ' / →']),'Rotate']]],
 ['Sewing order',[['[ and ]','Sew earlier / later'],['Home / End','Sew first / last']]],
 ['View',[[shortcutLabel([{shift: true, key: '0'}]),'Fit the hoop'],[shortcutLabel([{shift: true, key: '1'}]),'Fit everything'],[shortcutLabel([{shift: true, key: '2'}]),'Zoom to selection'],['+ / −','Zoom in / out'],['?','This list']]]];;

/** Whether the keyboard shortcuts dialog is open. The dialog opens from the help button and the ? key. */
export const shortcutsState = createStore(false);

/** Opens or closes the keyboard shortcuts dialog. */
export function setShortcutsOpen(open: boolean) {
  shortcutsState.set(open);
}
