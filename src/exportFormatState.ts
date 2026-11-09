import {createStore} from './store.js';

/** The export formats, in the order the export dialog lists them. Machine formats (stitch files, and the thread colour lists a machine's software reads) come first; print and vector outputs follow in their own group. The export dialog's format select is the only format control. */
export const EXPORT_FORMATS: {value: string; label: string; group: 'machine' | 'print'}[] = [
  {value: 'jef', label: 'JEF · Janome', group: 'machine'},
  {value: 'vp3', label: 'VP3 · Pfaff', group: 'machine'},
  {value: 'dst', label: 'DST · Tajima (widely supported)', group: 'machine'},
  {value: 'exp', label: 'EXP · Melco', group: 'machine'},
  {value: 'pec', label: 'PEC · Brother', group: 'machine'},
  {value: 'pes', label: 'PES · Brother (v1)', group: 'machine'},
  {value: 'pes6', label: 'PES · Brother (v6)', group: 'machine'},
  {value: 'sew', label: 'SEW · Janome (native)', group: 'machine'},
  {value: 'u01', label: 'U01 · Barudan', group: 'machine'},
  {value: 'xxx', label: 'XXX · Singer', group: 'machine'},
  {value: 'tbf', label: 'TBF · Tajima', group: 'machine'},
  {value: 'col', label: 'COL · thread colour list', group: 'machine'},
  {value: 'edr', label: 'EDR · thread colour list (binary)', group: 'machine'},
  {value: 'svg', label: 'SVG · vector design (Inkscape)', group: 'print'},
  {value: 'print', label: 'Print template · 1:1 SVG (placement sheet)', group: 'print'},
  {value: 'applique-print', label: 'Appliqué templates · 1:1 SVG', group: 'print'},
  {value: 'dxf', label: 'DXF · paths (CAD)', group: 'print'},
];

/** The dialog's two option groups, in the order it shows them. */
export const EXPORT_FORMAT_GROUPS: {group: 'machine' | 'print'; label: string}[] = [
  {group: 'machine', label: 'Machine embroidery formats'},
  {group: 'print', label: 'Print and vector'},
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
