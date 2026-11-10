// @ts-check
// Drag and drop of a file onto the editor. The browser would otherwise open a dropped file in the tab and lose unsaved
// work, so every file drag is taken here. An SVG, .welcome, .json or .dxf file opens exactly as the File menu's Open
// does (same import, same discard prompt, same undo step). A picture is refused: pictures come in through Trace or a
// reference picture. Anything else gets a message that names the accepted types.
import {t} from './i18n.js';
import {toast} from './editorChrome.js';
import {openProjectFile} from './projectIO.js';

const OPENABLE = /\.(svg|welcome|json|dxf)$/i;
const PICTURE = /\.(png|jpe?g|gif|webp|bmp|avif|heic)$/i;

/** @param {DataTransfer|null} data */
function carriesFiles(data) {
  return !!data && Array.from(data.types || []).includes('Files');
}

/**
 * Routes one dropped file: opens it when the editor reads it, refuses a picture, or names the accepted types.
 * @param {File} file
 */
export async function handleDroppedFile(file) {
  if (OPENABLE.test(file.name)) return openProjectFile(file);
  if (PICTURE.test(file.name) || /^image\//.test(file.type)) {
    toast(t('Drop an SVG, or use Trace for a picture'), 'error');
    return;
  }
  toast(t('Drop an SVG, .welcome, .dxf or JSON file to open it.'), 'error');
}

/** Listens for file drags on the whole window, so a drop anywhere on the editor is handled. */
export function mountFileDrop() {
  const indicator = document.createElement('div');
  indicator.id = 'dropIndicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.hidden = true;
  indicator.textContent = t('Drop an SVG file to import it');
  document.body.appendChild(indicator);

  let depth = 0;
  /** @param {boolean} on */
  const show = (on) => { indicator.hidden = !on; };

  window.addEventListener('dragenter', event => {
    if (!carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    depth += 1;
    show(true);
  });
  window.addEventListener('dragover', event => {
    // Always cancel the default so the browser never navigates to a dropped file.
    event.preventDefault();
    if (event.dataTransfer && carriesFiles(event.dataTransfer)) event.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', event => {
    if (!carriesFiles(event.dataTransfer)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) show(false);
  });
  window.addEventListener('drop', event => {
    event.preventDefault();
    depth = 0;
    show(false);
    const data = event.dataTransfer;
    if (!carriesFiles(data)) return;
    const files = Array.from(data?.files || []);
    if (files.length === 0) return;
    if (files.length > 1) {
      toast(t('Drop one file at a time.'), 'error');
      return;
    }
    void handleDroppedFile(files[0]);
  });
}
