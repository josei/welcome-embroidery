import {documentNow} from './documentState.js';
import {t} from './i18n.js';
import {setSelection} from './selectionState.js';
import {selectedObject} from './selectionCommands.js';
import {photoRowsActions} from './photoRowsState.js';
import {hoopSize} from './engine.js';

/** What photo stitch needs from the editor, supplied by app.js. */
export interface PhotoApi {
  /** Runs one undoable command through the document store. */
  edit(operations: Record<string, unknown>[], after?: () => void): boolean;
  toast(message: string, kind?: 'status' | 'error'): void;
}

let api: PhotoApi | null = null;

/** The wired editor commands. app.js calls configurePhotoCommands before the photo buttons can edit anything. */
function wired(): PhotoApi {
  if (!api) throw Error('The photo stitch commands are not wired.');
  return api;
}

/** Changes the selected picture's photo settings, spreading them over the ones it already has. */
function setPhoto(patch: Record<string, unknown>) {
  const object = selectedObject();
  if (object?.photo) wired().edit([{op: 'set_object', id: object.id, photo: {...(object.photo as object), ...patch}}]);
}

/** The second to fourth threads of a picture, in the order a thread is cleared from. */
const PHOTO_THREAD_KEYS = ['thread2', 'thread3', 'thread4'] as const;

/** Wires the photo rows and the picture import, once. */
export function configurePhotoCommands(next: PhotoApi) {
  api = next;
  photoRowsActions.commit = (field, text) => setPhoto({[field]: Number(text)}); // the field clamps to its range before this runs
  photoRowsActions.choose = (field, checked) => setPhoto({invert: checked});
  photoRowsActions.pickThread = (key, hex) => {
    const object = selectedObject();
    if (!object?.photo) return;
    const photo = {...(object.photo as Record<string, unknown>)};
    if (hex) photo[key] = hex;
    else for (const drop of PHOTO_THREAD_KEYS.slice(PHOTO_THREAD_KEYS.indexOf(key))) delete photo[drop];
    wired().edit([{op: 'set_object', id: object.id, photo}]);
  };
}

/**
 * Adds the chosen picture as a rectangle with grey samples, sized to fit the hoop, and selects it. The zigzag rows are
 * planned at compile time.
 */
export async function addPhoto(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const hoop = hoopSize(documentNow().doc);
    const wMm = Math.max(10, Math.min(80, hoop.w - 10));
    const hMm0 = wMm * bitmap.height / bitmap.width;
    const hMm = Math.min(hMm0, hoop.h - 10);
    const w = hMm < hMm0 ? hMm * bitmap.width / bitmap.height : wMm;
    const h = hMm;
    const pw = Math.max(8, Math.min(320, Math.round(w / .45)));
    const ph = Math.max(8, Math.min(320, Math.round(pw * h / w)));
    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    const context = canvas.getContext('2d');
    if (!context) throw Error('That picture could not be read.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, pw, ph);
    context.drawImage(bitmap, 0, 0, pw, ph);
    const pixels = context.getImageData(0, 0, pw, ph).data;
    const gray = new Uint8Array(pw * ph);
    for (let i = 0; i < pw * ph; i++) gray[i] = Math.round(.299 * pixels[i * 4] + .587 * pixels[i * 4 + 1] + .114 * pixels[i * 4 + 2]);
    let binary = '';
    for (let i = 0; i < gray.length; i += 0x8000) binary += String.fromCharCode(...gray.subarray(i, i + 0x8000));
    const id = crypto.randomUUID();
    wired().edit([
      {op: 'add_shape', id, kind: 'rect', name: 'Photo', x: +(-w / 2).toFixed(2), y: +(-h / 2).toFixed(2), width: +w.toFixed(2), height: +h.toFixed(2)},
      {op: 'set_object', id, photo: {pw, ph, data: btoa(binary), spacing: .7, contrast: 1.4}},
    ], () => {
      setSelection({selected: id});
      setSelection({multi: new Set([id])});
    });
    wired().toast(t('Photo stitch added. Adjust spacing and contrast in the sidebar.'));
  } catch (error) {
    wired().toast((error as Error).message || t('That picture could not be read.'), 'error');
  }
}
