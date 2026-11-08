import {useEffect, useRef, type RefObject} from 'react';

// Shared by every modal <dialog> the editor opens with showModal. The store says whether the dialog is open; this hook shows
// or closes it and keeps keyboard focus honest: Tab and Shift+Tab stay inside the dialog, and when it closes (by Escape, by a
// button, or by the store) focus goes back to whatever opened it. `fallback` is a selector for when nothing was focused,
// such as the ? key pressed over the canvas, so the help button gets focus back instead of the page.

const FOCUSABLE = [
 'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean, fallback?: string) {
 const opener = useRef<HTMLElement | null>(null);
 const wasOpen = useRef(false);
 useEffect(() => {
  const dialog = ref.current;
  if (!dialog) return;
  if (open) {
   wasOpen.current = true;
   if (!dialog.open) {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body && !dialog.contains(active) ? active : null;
    dialog.showModal();
   }
   return;
  }
  if (dialog.open) dialog.close();
  if (!wasOpen.current) return;
  wasOpen.current = false;
  const back = opener.current ?? (fallback ? document.querySelector<HTMLElement>(fallback) : null);
  opener.current = null;
  if (back?.isConnected) back.focus();
 }, [open]);

 useEffect(() => {
  if (!open) return;
  const trap = (e: KeyboardEvent) => {
   const dialog = ref.current;
   if (e.key !== 'Tab' || !dialog?.open) return;
   const stops = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0);
   if (!stops.length) { e.preventDefault(); return; }
   const first = stops[0], last = stops[stops.length - 1];
   const active = document.activeElement;
   const inside = active instanceof Node && dialog.contains(active);
   if (e.shiftKey ? !inside || active === first : !inside || active === last) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
   }
  };
  document.addEventListener('keydown', trap, true);
  return () => document.removeEventListener('keydown', trap, true);
 }, [open]);
}
