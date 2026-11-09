import {createStore} from './store.js';

/** The export formats, in the order the export dialog lists them. The export dialog's format select is the only format control. */
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

/** The kind of file a format makes, as the dialog's download button names it: "JEF" in "Download JEF file". Print and appliqué templates are SVG files. */
export function exportKind(format: string): string {
  if (format === 'print' || format === 'applique-print') return 'SVG';
  return (format === 'pes6' ? 'pes' : format).toUpperCase();
}

/** Chooses the export format, from the header or the export dialog. */
export function setExportFormat(format: string) {
  exportFormatState.set({format});
}
