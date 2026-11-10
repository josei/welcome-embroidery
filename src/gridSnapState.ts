import {createStore} from './store.js';
import {t} from './i18n.js';
import {gridState} from './gridState.js';

/** Whether drawing and dragging snap to the grid. Off at start-up. */
export const gridSnapState = createStore(false);

/** What turning the grid snap on or off needs from the editor. */
export interface GridSnapApi {
  render(): void;
  toast(message: string, kind?: 'status' | 'error'): void;
}

let api: GridSnapApi | null = null;

function wired(): GridSnapApi {
  if (!api) throw Error('The grid snap is not wired.');
  return api;
}

/** The snap button calls toggle(): it flips the setting, redraws and says what changed. */
export const gridSnapActions: {toggle: () => void} = {
  toggle() {
    const on = !gridSnapState.get();
    gridSnapState.set(on);
    wired().render();
    wired().toast(on ? t('Snap to {n} mm grid on.', {n: Number(gridState.get().value)}) : t('Snap off.'));
  },
};

/** Wires the grid snap toggle, once. */
export function configureGridSnap(next: GridSnapApi) {
  api = next;
}
