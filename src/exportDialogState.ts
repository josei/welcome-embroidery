import {createStore} from './store.js';

/**
 * The export dialog: whether it is open, whether the machine file comes with its sewing worksheet, and which form that
 * worksheet takes. The header's Export button opens it; the dialog's own controls change the rest.
 */
export interface ExportDialog {
  open: boolean;
  withWorksheet: boolean;
  worksheetFormat: 'text' | 'svg';
}

export const exportDialogState = createStore<ExportDialog>({open: false, withWorksheet: false, worksheetFormat: 'text'});

/** Changes some of the export dialog state. */
export function setExportDialog(patch: Partial<ExportDialog>) {
  exportDialogState.set({...exportDialogState.get(), ...patch});
}
