import {inspectorOpenState, toggleInspectorOpen, TABLET_DRAWER_QUERY} from './inspectorOpenState.js';

/**
 * Makes Escape fold the portrait-tablet inspector drawer, as it closes the phone sheets. Focus then goes to the collapse strip: the
 * tabs and the Properties button in the Layers header are hidden while the drawer is folded, so they cannot take focus, and the
 * strip is the one visible control that opens the drawer again. Does nothing when the drawer is already folded, or at any other
 * width. Returns a function that removes the listener.
 */
export function watchTabletDrawerEscape(): () => void {
 const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented || !inspectorOpenState.get()) return;
  if (!window.matchMedia(TABLET_DRAWER_QUERY).matches) return;
  e.preventDefault();
  toggleInspectorOpen();
  document.querySelector<HTMLElement>('.inspector-collapse')?.focus();
 };
 document.addEventListener('keydown', onKeyDown);
 return () => document.removeEventListener('keydown', onKeyDown);
}
