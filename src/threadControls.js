// @ts-check
// The thread controls outside React: the swatch buttons over each colour select, the thread plan panel (one row per
// colour in sewing order) and the worksheet download and copy commands.
import {documentNow} from './documentState.js';
import {threadStock, STOCK_KEY} from './storedPrefs.js';
import {setThreadStock, threadStockActions} from './threadStockState.js';
import {THREAD_PALETTE, threadName} from './threadPalette.js';
import {openThreadPopover, closeThreadPopover, threadPopoverState} from './threadPopoverState.js';
import {setStitchRow} from './stitchRowsState.js';
import {nearestStockThread} from './threads.js';
import {threadPlan, blockSeconds, blockTimeLabel, sewingWorksheet} from './engine.js';
import {download, safeProjectFilename} from './appHelpers.js';
import {t} from './i18n.js';
import {getPlan, getCompileError, compileNow} from './compileService.js';
import {editor} from './editorContext.js';

const THREAD_SELECT_IDS = ['#thread', '#blendThread', '#blendPalette0', '#blendPalette1', '#blendPalette2', '#blendPalette3'];
/** @type {HTMLSelectElement[]} */
const threadSelects = /** @type {HTMLSelectElement[]} */ (THREAD_SELECT_IDS
  .map(id => document.querySelector(id))
  .filter((select) => Boolean(select)));

/**
 * Applies a colour picked in the thread popover to its select and notifies the listeners.
 * @param {HTMLSelectElement} select
 * @param {string} hex
 */
function applyThread(select, hex) {
  if (hex && ![...select.options].some(option => option.value.toLowerCase() === hex.toLowerCase())) {
    select.append(new Option(threadName(hex), hex));
  }
  select.value = hex;
  select.dispatchEvent(new Event('change', {bubbles: true}));
  syncThreads();
}

/** Keeps each swatch button in step with its colour select. */
export function syncThreads() {
  for (const select of threadSelects) {
    const button = /** @type {HTMLButtonElement | null} */ (select.nextElementSibling);
    if (!button?.classList.contains('thread-btn')) continue;
    const value = select.value, swatch = /** @type {HTMLElement} */ (button.querySelector('.sw'));
    swatch.className = value ? 'sw' : 'sw none';
    swatch.style.background = value || '';
    const name = /** @type {HTMLElement} */ (button.querySelector('.nm'));
    name.textContent = value ? threadName(value) : t('None');
    button.disabled = select.disabled;
    button.setAttribute('aria-label', (select.closest('label')?.firstChild?.textContent || '').trim() + ': ' + (value ? threadName(value) : t('None')));
  }
}

/** Draws the thread plan panel's rows. */
export function renderPlan() {
  const list = /** @type {HTMLElement | null} */ (document.getElementById('planList'));
  if (!list) return;
  list.replaceChildren();
  const plan = getPlan();
  setStitchRow('planEmpty', Boolean(plan));
  const stock = threadStock();
  setThreadStock({info: stock.invalid || stock.colours.length ? t('{n} threads, {m} lines ignored', {n: stock.colours.length, m: stock.invalid}) : ''});
  if (!plan) return;
  const blocks = threadPlan(plan);
  blocks.slice(0, 60).forEach((block, i) => {
    const row = document.createElement('div');
    row.className = 'plan-row';
    const pick = document.createElement('select');
    pick.className = 'plan-replace';
    pick.title = t('Replace this thread everywhere');
    pick.setAttribute('aria-label', t('Replace this thread everywhere'));
    pick.append(new Option(t('Replace with…'), ''));
    for (const [name, hex] of THREAD_PALETTE) pick.append(new Option(t(name), hex));
    pick.onchange = () => {
      const from = block.thread, to = pick.value;
      if (!to) return;
      const count = documentNow().doc.objects.filter((/** @type {any} */ object) => object.kind !== 'stitch_layer' && object.thread && object.thread.toLowerCase() === from.toLowerCase()).length;
      editor.edit([{op: 'replace_thread', from, to}]);
      editor.toast(t('Replaced {thread} in {n} objects.', {thread: from, n: count}));
    };
    const swatch = document.createElement('span');
    swatch.className = 'sw';
    swatch.style.background = block.thread;
    const name = document.createElement('span');
    name.textContent = `${i + 1}. ${threadName(block.thread)}`;
    const count = document.createElement('span');
    count.className = 'n';
    count.textContent = `${t('{n} stitches', {n: block.stitches.toLocaleString()})} · ${(block.mm / 1000).toFixed(2)} m · ${blockTimeLabel(blockSeconds(block))}`;
    row.append(swatch, name, count);
    row.append(pick);
    const near = nearestStockThread(block.thread, stock.colours);
    if (near) {
      const match = document.createElement('span');
      match.className = 'stock-match';
      const dot = document.createElement('span');
      dot.className = 'sw';
      dot.style.background = near.hex;
      match.append(dot, ` ${t('Closest of your threads')}: ${near.hex}`);
      row.append(match);
    }
    list.append(row);
  });
}

function mountThreadSwatches() {
  for (const select of threadSelects) {
    select.classList.add('sr-only');
    select.tabIndex = -1;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thread-btn';
    button.setAttribute('aria-haspopup', 'dialog');
    button.innerHTML = '<span class="sw"></span><span class="nm"></span>';
    button.onclick = event => {
      event.preventDefault();
      if (threadPopoverState.get().owner?.id === select.id) closeThreadPopover();
      else openThreadPopover({id: select.id, value: select.value, onPick: hex => applyThread(select, hex)}, button.getBoundingClientRect());
    };
    select.after(button);
  }
}

function mountThreadStock() {
  setThreadStock({text: (() => { try { return localStorage.getItem(STOCK_KEY) || ''; } catch { return ''; } })()});
  threadStockActions.commit = text => {
    setThreadStock({text});
    try { localStorage.setItem(STOCK_KEY, text); } catch {}
    renderPlan();
  };
}

function mountWorksheet() {
  const downloadButton = /** @type {HTMLElement | null} */ (document.getElementById('worksheetDownload'));
  if (downloadButton) {
    downloadButton.onclick = async event => {
      event.preventDefault();
      const plan = getPlan();
      if (!plan || plan.revision !== documentNow().doc.revision) await compileNow(true);
      const current = getPlan();
      if (!current || current.revision !== documentNow().doc.revision) {
        editor.toast(getCompileError() || t('Compile the design first.'));
        return;
      }
      const format = /** @type {'text'|'svg'} */ (/** @type {HTMLSelectElement} */ (document.getElementById('worksheetFormat')).value);
      const base = safeProjectFilename(documentNow().doc.name).replace(/\.welcome$/i, '');
      download(sewingWorksheet(/** @type {any} */ (documentNow().doc), current, format), `${base}-worksheet.${format === 'svg' ? 'svg' : 'txt'}`, format === 'svg' ? 'image/svg+xml' : 'text/plain');
      editor.toast(t('Sewing worksheet downloaded.'));
    };
  }
  const copyButton = /** @type {HTMLElement | null} */ (document.getElementById('worksheetCopy'));
  if (copyButton) {
    copyButton.onclick = async event => {
      event.preventDefault();
      const plan = getPlan();
      if (!plan || plan.revision !== documentNow().doc.revision) await compileNow(true);
      const current = getPlan();
      if (!current || current.revision !== documentNow().doc.revision) {
        editor.toast(getCompileError() || t('Compile the design first.'));
        return;
      }
      try {
        await navigator.clipboard.writeText(sewingWorksheet(/** @type {any} */ (documentNow().doc), current, 'text'));
        editor.toast(t('Worksheet copied to the clipboard.'));
      } catch {
        editor.toast(t('The browser did not allow copying. Use Download instead.'));
      }
    };
  }
}

/** Mounts the thread swatch buttons, the thread stock and the worksheet commands. */
export function mountThreadControls() {
  mountThreadSwatches();
  mountThreadStock();
  mountWorksheet();
  syncThreads();
  editor.syncThreads = syncThreads;
  editor.renderPlan = renderPlan;
}
