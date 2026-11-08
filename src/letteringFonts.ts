// The lettering panel's font side: the font index, loading bundled and project fonts, the font picker, and the edits the
// panel's fields run. LetteringPanel.tsx renders from letteringFieldsState; app.js supplies the editor commands through
// configureLettering and starts the picker with initFontPicker.
import {documentNow} from './documentState.js';
import {selState} from './selectionState.js';
import {letteringActions, letteringFieldsState, setLetteringFields} from './letteringFieldsState.js';
import {setStitchRow} from './stitchRowsState.js';
import {
  getFont,
  isRegistryFont,
  loadFont,
  registerFont,
  registerDocumentFonts,
  documentFontIds,
} from './fonts.js';
import {createFontPicker, fetchFontIndex, LEGACY} from './fontui.js';
import {ttfToFont} from './ttf.js';
import {measureText, objectBounds, hoopSize} from './engine.js';
import {t} from './i18n.js';

/** The text object fields the lettering panel and the font picker read. */
interface TextObject {
  id: string;
  kind: string;
  text: string;
  font?: string;
  h: number;
  w: number;
  x: number;
  y: number;
  tracking?: number;
  wordSpacing?: number;
  lineHeight?: number;
  bold?: number;
  italic?: number;
  align?: string;
  vertical?: boolean;
  nameDrop?: boolean;
  stitch?: string;
  thread?: string;
  along?: {points: Array<[number, number]>; closed?: boolean; offset?: number};
}

/** One row of the font index, as fontui.js builds it. */
interface FontEntry {
  fid: string;
  id?: string;
  name: string;
  kind: string;
  keywords: string[];
  license?: string;
  size: number;
  minScale: number;
  maxScale: number;
  original?: string;
  description?: string;
}

/** What the lettering edits need from the editor, supplied by app.js. */
export interface LetteringApi {
  /** Runs one undoable command through the document store. */
  edit(operations: unknown[], after?: () => void, coalesceKey?: string): boolean;
  /** Runs one undoable command that changes the document itself; false puts the document back. */
  transact(fn: () => void): boolean;
  /** Shows a short message to the user. */
  toast(message: string, kind?: 'status' | 'error'): void;
  /** Redraws the editor after a font finishes loading. */
  render(): void;
}

interface FontPicker {
  refreshButton(): void;
  refresh(): void;
}

let api: LetteringApi | null = null;
let fontPicker: FontPicker | null = null;
let fontIndex: FontEntry[] = [...LEGACY];
/** The font new lettering starts in: the last one picked, or the one loaded from a file. */
let newTextFont = 'welcome-mono/1';
const fontLoading = new Set<string>(), fontFailed = new Set<string>();

/** The wired editor commands. app.js calls configureLettering before anything can pick a font. */
function wired(): LetteringApi {
  if (!api) throw Error('The lettering panel is not wired.');
  return api;
}

const fetchJson = (path: string) =>
  fetch(new URL('../' + path, import.meta.url)).then(r => {
    if (!r.ok) throw Error(`Font file ${path} could not be loaded (${r.status}).`);
    return r.json();
  });

/** Loads a bundled font once; legacy and project fonts are already at hand. */
export const ensureFontLoaded = (id: string) =>
  !isRegistryFont(id) || id.startsWith('custom/') || getFont(id) ? Promise.resolve() : loadFont(id, fetchJson);

/** The font new text will be drawn in. */
export const letteringTextFont = () => newTextFont;

/** Makes sure every font the document uses is registered and loaded, before compiling or exporting. */
export async function ensureDocFonts() {
  registerDocumentFonts(documentNow().doc);
  await Promise.all(documentFontIds(documentNow().doc).map(ensureFontLoaded));
}

/** Starts loading every font the document uses, redrawing as each one arrives. */
export function kickFontLoads() {
  registerDocumentFonts(documentNow().doc);
  for (const id of documentFontIds(documentNow().doc)) {
    if (id.startsWith('custom/') || getFont(id) || fontLoading.has(id) || fontFailed.has(id)) continue;
    fontLoading.add(id);
    ensureFontLoaded(id).then(
      () => {
        fontLoading.delete(id);
        wired().render();
      },
      () => {
        fontLoading.delete(id);
        fontFailed.add(id);
        const name = fontIndex.find(f => f.fid === id)?.name;
        wired().toast(name ? t('Could not load the font {font}. Choose another font.', {font: name}) : t('Could not load this font. Choose another font.'), 'error');
      },
    );
  }
}

/** The selected object, typed with the fields the lettering panel reads. */
function selectedObject(): TextObject | undefined {
  const objects = documentNow().doc.objects as TextObject[];
  return objects.find(o => o.id === selState().selected);
}

/** The selected text object, or null when the selection is not lettering. */
function textObj(): TextObject | null {
  const o = selectedObject();
  return o?.kind === 'text' ? o : null;
}

/** The font's design size for this text: its own size, shrunk (within its range) so the line fits 85% of the hoop width. */
export function fitHeight(fid: string, text: string, opts: TextObject | Record<string, never> = {}) {
  const f = isRegistryFont(fid) ? getFont(fid) : null;
  if (!f) return fid === 'neon-blinking/1' ? 20 : 8;
  const lo = f.size * f.minScale, hi = f.size * f.maxScale, limit = hoopSize(documentNow().doc).w * 0.85;
  const w = measureText(text, fid, f.size, opts);
  let h = f.size;
  if (w > limit) h = (f.size * limit) / w;
  return Math.max(lo, Math.min(hi, +h.toFixed(2)));
}

/** Copies the picked font's list into the lettering panel's select. */
export function populateFontSelect() {
  setLetteringFields({fontOptions: fontIndex.map(f => ({value: f.fid, label: f.name}))});
}

/**
 * Derives every lettering field from the selected object (or from the font new text will use) and from the font index:
 * the text, size range, spacing, style flags, vertical state, font list and font information line.
 */
export function syncTextInspector(o: TextObject | null) {
  const isText = o?.kind === 'text';
  const fid = isText ? o.font || 'welcome-mono/1' : newTextFont;
  const f = isRegistryFont(fid) ? getFont(fid) : null;
  const legacyNeon = fid === 'neon-blinking/1', registry = isRegistryFont(fid);
  const lo = f ? +(f.size * f.minScale).toFixed(2) : legacyNeon ? 20 : registry ? 2 : 4;
  const hi = f ? +(f.size * f.maxScale).toFixed(2) : legacyNeon ? 60 : registry ? 200 : 16;
  const entry = fontIndex.find(x => x.fid === fid);
  const custom = fid.startsWith('custom/') ? documentNow().doc.customFonts?.[fid.slice(7)] : null;
  let fontOptions = letteringFieldsState.get().fontOptions;
  if (!fontOptions.some(op => op.value === fid)) fontOptions = [...fontOptions, {value: fid, label: fid}];
  setLetteringFields({
    textOff: !isText,
    styleOff: !isText || !registry,
    text: isText ? o.text : '',
    height: String(isText ? +Number(o.h).toFixed(2) : (f?.size ?? (legacyNeon ? 20 : 8))),
    heightMin: String(lo),
    heightMax: String(hi),
    heightTitle: `${lo}–${hi} mm for this font`,
    fontOptions,
    fontValue: fid,
    tracking: String(o?.tracking ?? 0),
    wordSpacing: String(o?.wordSpacing ?? 0),
    lineHeight: String(o?.lineHeight ?? 1),
    boldMm: String(o?.bold ?? 0),
    italicDeg: String(o?.italic ?? 0),
    bold: Boolean(o?.bold && o.bold > 0),
    italic: Boolean(o?.italic && o.italic > 0),
    align: o?.align || 'left',
    vertical: Boolean(o?.vertical),
    nameDrop: Boolean(o?.nameDrop),
    stitch: o?.stitch === 'run' ? 'run' : 'fill',
    fontInfoHidden: !(entry || custom),
    fontInfoText: custom
      ? `${custom.name} — loaded from a file; stored inside this project. ` +
        `${custom.license || 'Check the licence of the font file before sharing the design.'}`
      : entry
        ? `${entry.name} — ${entry.license || ''}` +
          `${entry.original && entry.original !== entry.name ? ` · ${t('based on')} ${entry.original}` : ''}` +
          `${!registry ? ' · ' + t('single-line font: spacing, bold and italic apply to bundled outline/stitch fonts; ' +
            'pick a satin or fill font to set the stitch density') : ''}`
        : '',
  });
  setStitchRow('textStitchRow', !(isText && f?.kind === 'outline'));
  fontPicker?.refreshButton();
}

/** Switches the selected lettering (or new text) to a font, resizing it to that font's design size. */
export async function setFont(fid: string) {
  try {
    await ensureFontLoaded(fid);
  } catch (error) {
    wired().toast((error as Error).message, 'error');
    syncTextInspector(textObj());
    return;
  }
  newTextFont = fid;
  const o = textObj(), f = isRegistryFont(fid) ? getFont(fid) : null;
  if (o) {
    const legacy = !isRegistryFont(fid);
    const longest = o.text.split('\n').reduce((a, b) => (a.length >= b.length ? a : b), '');
    const height = fitHeight(fid, longest, o);
    const text = legacy ? o.text.replace(/\n/g, ' ').toUpperCase().slice(0, 24) : o.text;
    wired().edit([
      {
        op: 'set_object',
        id: o.id,
        font: fid,
        text,
        stitch: f?.kind === 'outline' ? (getFont(o.font)?.kind === 'outline' && o.stitch === 'run' ? 'run' : 'fill') : 'run',
      },
      {op: 'transform', id: o.id, height, width: measureText(text, fid, height, o)},
    ]);
  } else syncTextInspector(null);
}

/**
 * Vertical lettering fits the hoop: a column taller than 90% of the hoop height is scaled down by its height ratio, with
 * the width kept in proportion (the same transform the lettering height field uses).
 */
export function fitVerticalToHoop(id: string) {
  const o = (documentNow().doc.objects as TextObject[]).find(v => v.id === id);
  if (!o?.vertical) return;
  const b = objectBounds(o), colH = b[3] - b[1], limit = hoopSize(documentNow().doc).h * 0.9;
  if (!(colH > limit) || !(o.h > 0)) return;
  const height = +(o.h * limit / colH).toFixed(2);
  const ok = wired().edit([
    {op: 'transform', id, height, width: measureText(o.text, o.font || 'welcome-mono/1', height, o)},
  ]);
  if (ok) {
    const o2 = (documentNow().doc.objects as TextObject[]).find(v => v.id === id)!;
    const b2 = objectBounds(o2), cx = (b2[0] + b2[2]) / 2, cy = (b2[1] + b2[3]) / 2;
    wired().edit([{op: 'transform', id, x: o2.x - cx, y: o2.y - cy}]);
    wired().toast(t('Vertical lettering fitted to the hoop at {h} mm.', {h: height}));
  }
}

/** Loads a .ttf from disk into the project, storing its glyph subset in the document and switching to it. */
export async function loadFontFile(file: File) {
  const {transact, toast} = wired();
  try {
    if (file.size > 12_000_000) throw Error('Font files over 12 MB are not supported.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 32) || 'font';
    let id = base, n = 1;
    while (documentNow().doc.customFonts?.[id] || getFont(`custom/${id}`)) id = `${base}_${++n}`;
    const font = ttfToFont(bytes, {
      id,
      name: file.name.replace(/\.[^.]+$/, ''),
      license: 'Loaded from a local file — check its licence',
      keywords: ['truetype', 'outline', 'custom'],
    });
    if (Object.keys(font.glyphs).length < 10) throw Error('That font has too few Latin glyphs.');
    delete font.id;
    const key = `custom/${id}`;
    registerFont(key, {...font, id});
    const o = textObj();
    const ok = transact(() => {
      documentNow().doc.customFonts ||= {};
      documentNow().doc.customFonts[id] = font;
      if (o) {
        const target = (documentNow().doc.objects as TextObject[]).find(v => v.id === o.id)!;
        target.font = key;
        target.stitch = 'fill';
        target.h = font.size;
        target.w = measureText(target.text, key, font.size, target);
      }
    });
    if (ok) {
      newTextFont = key;
      fontIndex = [
        ...fontIndex.filter(f => f.fid !== key),
        {
          fid: key,
          id,
          name: font.name,
          kind: 'outline',
          keywords: ['truetype', 'outline', 'custom'],
          license: font.license,
          size: font.size,
          minScale: font.minScale,
          maxScale: font.maxScale,
        },
      ];
      populateFontSelect();
      toast(t('Loaded {name}. It is stored in this project.', {name: font.name}));
      syncTextInspector(selectedObject() ?? null);
    }
  } catch (error) {
    toast((error as Error).message, 'error');
  }
}

/** Every font the picker offers: the bundled index plus the project's own loaded fonts not already in it. */
function pickerIndex(): FontEntry[] {
  const custom = Object.entries((documentNow().doc.customFonts || {}) as Record<string, FontEntry>);
  return [
    ...fontIndex,
    ...custom
      .filter(([id]) => !fontIndex.some(f => f.fid === `custom/${id}`))
      .map(([id, f]) => ({
        fid: `custom/${id}`,
        id,
        name: f.name,
        kind: 'outline',
        keywords: ['truetype', 'custom'],
        license: f.license,
        size: f.size,
        minScale: f.minScale,
        maxScale: f.maxScale,
      })),
  ];
}

/** Builds the font picker over the markup the lettering panel and overlays draw, and loads the bundled font index. */
export function initFontPicker() {
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  const picker: FontPicker = createFontPicker({
    button: byId('fontButton'),
    buttonPreview: byId('fontButtonPreview'),
    buttonName: byId('fontButtonName'),
    panel: byId('fontPanel'),
    search: byId('fontSearch') as HTMLInputElement,
    chips: byId('fontChips'),
    list: byId('fontList'),
    loadFile: byId('fontLoadFile'),
    fileInput: byId('fontFile') as HTMLInputElement,
    getIndex: pickerIndex,
    getCurrent: () => textObj()?.font || newTextFont,
    getSample: () => (textObj()?.text || 'Hello 123').split('\n')[0].slice(0, 14),
    getColor: () => textObj()?.thread || '#1d2925',
    ensureLoaded: ensureFontLoaded,
    onPick: setFont,
    onLoadFile: loadFontFile,
  });
  fontPicker = picker;
  fetchFontIndex().then((index: FontEntry[]) => {
    fontIndex = index;
    populateFontSelect();
    syncTextInspector(selectedObject() ?? null);
    picker.refresh();
  });
}

/** The text as the document stores it: one line, upper case, at most 24 characters, unless the font is a registry font. */
function storedLetteringText(o: NonNullable<ReturnType<typeof textObj>>, text: string): string {
  return isRegistryFont(o.font) ? text : text.replace(/\n/g, ' ').toUpperCase().slice(0, 24);
}

/** Wires the lettering edits and the font picker. app.js calls this once, before the first render. */
export function configureLettering(next: LetteringApi) {
  api = next;
  letteringActions.preview = text => {
    const o = textObj();
    if (!o) return;
    const value = storedLetteringText(o, text);
    if (!value.trim() || value === o.text) return;
    wired().edit([{op: 'set_object', id: o.id, text: value}], undefined, `lettering-text:${o.id}`);
  };
  letteringActions.commit = (field, text) => {
    if (field === 'alongOffset') {
      const o = selectedObject();
      if (o?.along) wired().edit([{op: 'set_along_offset', textId: o.id, offset: Number(text)}]);
      return;
    }
    const o = textObj();
    if (!o) return;
    if (field === 'text') {
      const value = storedLetteringText(o, text);
      if (!value.trim()) {
        wired().toast(t('Lettering needs some text.'), 'error');
        syncTextInspector(o);
        return false;
      }
      if (value !== o.text) wired().edit([{op: 'set_object', id: o.id, text: value}]);
      return;
    }
    if (field === 'height') {
      const height = Number(text);
      wired().edit([
        {op: 'transform', id: o.id, height, width: measureText(o.text, o.font || 'welcome-mono/1', height, o)},
      ]);
      return;
    }
    const key = {
      tracking: 'tracking',
      wordSpacing: 'wordSpacing',
      lineHeight: 'lineHeight',
      boldMm: 'bold',
      italicDeg: 'italic',
    } as const;
    wired().edit([{op: 'set_object', id: o.id, [key[field]]: Number(text)}]);
  };
  letteringActions.choose = (field, value) => {
    if (field === 'font') {
      void setFont(String(value));
      return;
    }
    const o = textObj();
    if (!o) return;
    if (field === 'vertical') {
      if (value && !isRegistryFont(o.font)) {
        wired().toast(t('Vertical lettering needs a bundled or loaded font. Choose one in Font.'), 'error');
        return false;
      }
      if (wired().edit([{op: 'set_object', id: o.id, vertical: Boolean(value)}]) && value) fitVerticalToHoop(o.id);
      return;
    }
    if (field === 'nameDrop') {
      wired().edit([{op: 'set_object', id: o.id, nameDrop: Boolean(value)}]);
      return;
    }
    if (field === 'stitch') wired().edit([{op: 'set_object', id: o.id, stitch: String(value)}]);
  };
  letteringActions.press = (name, value) => {
    const o = textObj();
    if (!o) return;
    if (name === 'bold') {
      wired().edit([{op: 'set_object', id: o.id, bold: (o.bold ?? 0) > 0 ? 0 : Math.max(0.4, Math.round(o.h * 0.03 * 10) / 10)}]);
    } else if (name === 'italic') {
      wired().edit([{op: 'set_object', id: o.id, italic: (o.italic ?? 0) > 0 ? 0 : 12}]);
    } else wired().edit([{op: 'set_object', id: o.id, align: value}]);
  };
}
