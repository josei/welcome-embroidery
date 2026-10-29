import {createStore} from './store.js';

/** The export formats, in the order the export dialog lists them. The header's format choice and the dialog's select share one value. */
export const EXPORT_FORMATS: {value: string; label: string}[] = [
  {value: 'jef', label: 'JEF · Janome'},
  {value: 'vp3', label: 'VP3 · Pfaff'},
  {value: 'dst', label: 'DST · Tajima (widely supported)'},
  {value: 'exp', label: 'EXP · Melco'},
  {value: 'pec', label: 'PEC · Brother'},
  {value: 'pes', label: 'PES · Brother (v1)'},
  {value: 'pes6', label: 'PES · Brother (v6)'},
  {value: 'sew', label: 'SEW · Janome (native)'},
  {value: 'u01', label: 'U01 · Barudan'},
  {value: 'xxx', label: 'XXX · Singer'},
  {value: 'tbf', label: 'TBF · Tajima'},
  {value: 'col', label: 'COL · thread colour list'},
  {value: 'edr', label: 'EDR · thread colour list (binary)'},
  {value: 'svg', label: 'SVG · vector design (Inkscape)'},
  {value: 'print', label: 'Print template · 1:1 SVG (placement sheet)'},
  {value: 'applique-print', label: 'Appliqué templates · 1:1 SVG'},
  {value: 'dxf', label: 'DXF · paths (CAD)'},
];

export const exportFormatState = createStore<{format: string}>({format: 'jef'});

/** Chooses the export format, from the header or the export dialog. */
export function setExportFormat(format: string) {
  exportFormatState.set({format});
}
