import {closePhoneSheet, isPhoneSheetLayout, isPortraitSheetLayout, lowerPhoneSheet, raisePhoneSheet} from './phoneSheetState.js';

// A portrait bottom sheet follows a downward drag that starts on its grab handle or its title row (any element marked
// data-sheet-drag). Released after at least 60 px down, it moves one detent lower (or closes from peek); after 60 px up, one detent
// higher. A shorter drag snaps back. Controls in the title row (buttons, fields) keep their own clicks and do not start a drag.
const STEP_PX = 60;
// On a landscape phone the sheets are right-edge side sheets. An open sheet closes after a rightward swipe of at least
// 80 px on its head (the same head that starts a portrait drag). The sheet follows the finger to the right while it is dragged.
const SWIPE_CLOSE_PX = 80;
const CONTROL = 'button,input,select,textarea,a,label,summary';

/** Attaches the drag to one sheet. Returns a function that removes the listeners. */
export function attachSheetDrag(sheet: HTMLElement): () => void {
 let pointer: number | null = null;
 let startX = 0;
 let startY = 0;
 let dx = 0;
 let dy = 0;
 // Whether this drag is a side-sheet swipe (landscape phone) rather than a bottom-sheet drag (portrait).
 let side = false;

 const down = (e: PointerEvent) => {
  if (e.button !== 0) return;
  side = isPhoneSheetLayout() && !isPortraitSheetLayout();
  if (side ? !sheet.classList.contains('sheet-open') : !isPortraitSheetLayout()) return;
  const target = e.target as Element;
  if (!target.closest('[data-sheet-drag]') || target.closest(CONTROL)) return;
  pointer = e.pointerId;
  startX = e.clientX;
  startY = e.clientY;
  dx = 0;
  dy = 0;
 };
 const move = (e: PointerEvent) => {
  if (e.pointerId !== pointer) return;
  if (side) {
   dx = e.clientX - startX;
   if (Math.abs(dx) > 4) {
    sheet.dataset.dragging = '';
    sheet.setPointerCapture?.(e.pointerId);
   }
   sheet.style.transform = dx > 0 ? `translateX(${dx}px)` : '';
   return;
  }
  dy = e.clientY - startY;
  if (Math.abs(dy) > 4) {
   sheet.dataset.dragging = '';
   sheet.setPointerCapture?.(e.pointerId);
  }
  sheet.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
 };
 const up = (e: PointerEvent) => {
  if (e.pointerId !== pointer) return;
  pointer = null;
  delete sheet.dataset.dragging;
  sheet.style.transform = '';
  if (side) {
   if (dx >= SWIPE_CLOSE_PX) closePhoneSheet();
   return;
  }
  if (dy >= STEP_PX) lowerPhoneSheet();
  else if (dy <= -STEP_PX) raisePhoneSheet();
 };

 sheet.addEventListener('pointerdown', down);
 sheet.addEventListener('pointermove', move);
 sheet.addEventListener('pointerup', up);
 sheet.addEventListener('pointercancel', up);
 return () => {
  sheet.removeEventListener('pointerdown', down);
  sheet.removeEventListener('pointermove', move);
  sheet.removeEventListener('pointerup', up);
  sheet.removeEventListener('pointercancel', up);
 };
}

/** The first control in a sheet that is drawn, in reading order: where focus goes when the sheet opens. */
export function firstSheetControl(sheet: HTMLElement): HTMLElement | null {
 const controls = sheet.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([type=hidden]):not(.sr-only),select,textarea,summary,[tabindex="0"]');
 return Array.from(controls).find(el => el.getClientRects().length > 0 && !el.closest('.sr-only,[hidden]')) ?? null;
}
