import {createStore} from './store.js';

/** Whether the settings dialog is open. The header's settings button and the dialog both read and write it. */
export const settingsState = createStore<boolean>(false);

/** Opens or closes the settings dialog. */
export function setSettingsOpen(open: boolean) {
 settingsState.set(open);
}
