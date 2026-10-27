import {createStore} from './store.js';

// The keyboard shortcuts, in the order the dialog lists them. Titles and keys are translated when the dialog renders.
export const SHORTCUTS: Array<[string, Array<[string, string]>]> = [['Tools',[['V','Select'],['R','Rectangle'],['O','Ellipse'],['T','Lettering'],['N','Draw path'],['P','Pen with curves'],['L','Line'],['G','Polygon'],['S','Star'],['Enter','Edit nodes / finish a path'],['Esc','Cancel, go back to select']]],
 ['Edit',[['Ctrl+Z / Ctrl+Y','Undo / redo'],['Ctrl+C / X / V','Copy, cut, paste'],['Ctrl+D','Duplicate'],['Ctrl+Alt+C / V','Copy / paste style'],['Del','Delete'],['Ctrl+A','Select all'],['Ctrl+G / Ctrl+Shift+G','Group / ungroup'],['Ctrl+Shift+C','Convert to path'],['Arrow keys','Nudge (Shift = 5 mm, Alt = 0.1 mm)'],['Ctrl+Arrows','Resize'],['Ctrl+Alt+← / →','Rotate']]],
 ['Sewing order',[['[ and ]','Sew earlier / later'],['Home / End','Sew first / last']]],
 ['View',[['Shift+0','Fit the hoop'],['Shift+1','Fit everything'],['Shift+2','Zoom to selection'],['+ / −','Zoom in / out'],['?','This list']]]];;

/** Whether the keyboard shortcuts dialog is open. The dialog opens from the help button and the ? key. */
export const shortcutsState = createStore(false);

/** Opens or closes the keyboard shortcuts dialog. */
export function setShortcutsOpen(open: boolean) {
  shortcutsState.set(open);
}
