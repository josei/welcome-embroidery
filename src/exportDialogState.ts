import {createStore} from './store.js';

/**
 * The export dialog: whether it is open, whether the machine file comes with its sewing worksheet, and which form that
 * worksheet takes. The header's Export button opens it; the dialog's own controls change the rest.
 *
 * `busy` is true while an export runs. `error` is the last export's failure, shown in the dialog. `refusal` is why the
 * current design cannot be exported (the last compile's errors, such as an object past the hoop); it disables the button.
 */
export interface ExportDialog {
  open: boolean;
  withWorksheet: boolean;
  worksheetFormat: 'text' | 'svg';
  busy: boolean;
  error: string;
  refusal: string;
}

/** Why a design with no objects cannot be exported. Shown beside the disabled Export button and as its tooltip. */
export const EMPTY_EXPORT_REASON = 'Add an object to export';

export const exportDialogState = createStore<ExportDialog>({
  open: false, withWorksheet: false, worksheetFormat: 'text', busy: false, error: '', refusal: '',
});

/** Changes some of the export dialog state. */
export function setExportDialog(patch: Partial<ExportDialog>) {
  exportDialogState.set({...exportDialogState.get(), ...patch});
}

/** Records why the compiled design cannot be exported, or clears it with the empty string. */
export function setExportRefusal(refusal: string) {
  if (exportDialogState.get().refusal !== refusal) setExportDialog({refusal});
}
