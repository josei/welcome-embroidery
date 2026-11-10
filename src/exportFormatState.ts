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
  {value: 'col', label: 'COL · thread color list', group: 'machine'},
  {value: 'edr', label: 'EDR · thread color list (binary)', group: 'machine'},
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

/**
 * The machine brands the export dialog asks about first. Each lists the stitch formats that brand's machines read; the
 * dialog offers only those (plus the print and vector outputs). `unsure` is the fallback and offers DST, the format most
 * machines accept. `format` is the default for the brand, so choosing a brand selects its usual file.
 */
export const MACHINE_BRANDS: {value: string; label: string; formats: string[]; format: string}[] = [
  {value: 'janome', label: 'Janome / Elna', formats: ['jef', 'sew'], format: 'jef'},
  {value: 'pfaff', label: 'Pfaff', formats: ['vp3'], format: 'vp3'},
  {value: 'brother', label: 'Brother / Babylock', formats: ['pec', 'pes', 'pes6'], format: 'pes6'},
  {value: 'melco', label: 'Melco (EXP)', formats: ['exp'], format: 'exp'},
  {value: 'tajima', label: 'Tajima', formats: ['dst', 'tbf'], format: 'dst'},
  {value: 'barudan', label: 'Barudan', formats: ['u01'], format: 'u01'},
  {value: 'singer', label: 'Singer', formats: ['xxx'], format: 'xxx'},
  {value: 'unsure', label: 'Other / not sure', formats: ['dst'], format: 'dst'},
];

/** The brand used when the dialog opens: not sure, so DST. */
export const DEFAULT_MACHINE_BRAND = 'unsure';

/** The formats the dialog offers for a brand. Unknown brands fall back to the not-sure list. */
export function formatsForBrand(brand: string): string[] {
  return (MACHINE_BRANDS.find(b => b.value === brand) ?? MACHINE_BRANDS[MACHINE_BRANDS.length - 1]).formats;
}

/**
 * `brand` is the machine the user owns; `format` is the file to export; `showAll` lists every format regardless of brand,
 * so advanced users can still reach any of them.
 */
export const exportFormatState = createStore<{brand: string; format: string; showAll: boolean}>({
  brand: DEFAULT_MACHINE_BRAND, format: 'dst', showAll: false,
});

/** The kind of file a format makes, as the dialog's download button names it: "JEF" in "Download JEF file". Print and appliqué templates are SVG files. */
export function exportKind(format: string): string {
  if (format === 'print' || format === 'applique-print') return 'SVG';
  return (format === 'pes6' ? 'pes' : format).toUpperCase();
}

/** Chooses the export format, from the header or the export dialog. */
export function setExportFormat(format: string) {
  exportFormatState.set({...exportFormatState.get(), format});
}

/** Chooses the machine brand, and selects that brand's usual format. */
export function setExportBrand(brand: string) {
  const info = MACHINE_BRANDS.find(b => b.value === brand) ?? MACHINE_BRANDS[MACHINE_BRANDS.length - 1];
  exportFormatState.set({...exportFormatState.get(), brand: info.value, format: info.format});
}

/** Shows every format in the dialog, or only the chosen brand's. */
export function setExportShowAll(showAll: boolean) {
  exportFormatState.set({...exportFormatState.get(), showAll});
}
