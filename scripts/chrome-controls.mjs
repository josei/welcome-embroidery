// Shared by the chrome guard tests and the state harness. It finds the glyph-only chrome controls on the editor from the
// DOM (no fixed list), forces their interaction states through the DevTools protocol, and measures what the state
// changed on screen. Run against a built dist/: `npm run build` first.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {chromium} from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// The standard sizes chrome is judged at, and the languages the editor ships in.
export const CHROME_SIZES = [[360, 640], [390, 844], [844, 390], [768, 1024], [1600, 1000]];
export const STANDARD_SIZES = CHROME_SIZES.slice(0, 4);
export const LANGS = ['en', 'es'];

// Per-channel difference that counts as a change. Compositing repaints a neighbour's edge by one step, which is not a state.
export const PIXEL_TOLERANCE = 3;

// Largest distance, in CSS pixels, between a control's centre and the centre of its glyph (with any short label).
export const CENTRE_LIMIT = 0.5;
// Width of the band around each control that is captured and compared. It is wider than a focus outline and its offset,
// so the whole outline falls inside the band; pixels further out are never read.
export const STATE_MARGIN = 6;

// Chrome labels are at most two words; a control whose visible text is longer is a list row, not a chrome control.
const MAX_LABEL_WORDS = 2;

// Forced states: the DevTools pseudo-class to force, or a class that stands for the selected state.
export const STATES = {
  hover: {pseudo: ['hover']},
  selected: {className: 'active-tool'},
  'focus-visible': {pseudo: ['focus-visible']},
  pressed: {pseudo: ['active']},
};

// Hides what must not move the comparison: the tooltip bubble and the canvas, and every transition, so each capture is
// the settled state.
const QUIET_CSS = `
#tooltip{display:none!important}
#art{visibility:hidden!important}
*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}`;

// A port nobody is listening on, so test files that run in parallel each get their own dist server.
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const {port} = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

export function startDistServer(port) {
  const child = spawn(process.execPath, [join(root, 'scripts', 'serve-dist.mjs')], {
    env: {...process.env, HOST: '127.0.0.1', PORT: String(port)},
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  const stop = () => child.kill();
  return (async () => {
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`${base}/health`);
        if (r.ok) return {base, stop};
      } catch { /* not listening yet */ }
      await new Promise(r => setTimeout(r, 100));
    }
    stop();
    throw new Error(`dist server did not start on ${base}`);
  })();
}

export async function launchBrowser() {
  return chromium.launch();
}

// Opens the editor at one size and language, with the quiet styles applied.
export async function openEditor(browser, base, {width, height, lang, deviceScaleFactor = 1}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor});
  const page = await context.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(`${base}/?lang=${lang}`, {waitUntil: 'networkidle'});
  await page.addStyleTag({content: QUIET_CSS});
  await page.locator('header.top #name').waitFor({state: 'visible'});
  await page.mouse.move(-1, -1);
  return {context, page};
}

// Lists every visible glyph-only chrome control, tagging each with data-chrome-guard="<index>". Returns the centre
// offsets of the glyph (with any label) against the control's own box, and the state-relevant facts.
export function discoverChromeControls(page) {
  return page.evaluate((maxWords) => {
    // Layers rows are list content, not chrome: each row's own eye and lock belong to the row.
    const insideChrome = el => !el.closest('#art, dialog, [role=dialog], [role=menu], [role=listbox], [role=tooltip], .object-line');
    const union = rects => rects.length ? {
      left: Math.min(...rects.map(r => r.left)),
      top: Math.min(...rects.map(r => r.top)),
      right: Math.max(...rects.map(r => r.right)),
      bottom: Math.max(...rects.map(r => r.bottom)),
    } : null;
    const visibleRect = el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width <= 0 || r.height <= 0 || cs.visibility === 'hidden' || cs.display === 'none') return null;
      // A control faded out at rest (opacity 0) is not on screen, so it has no state to check.
      for (let n = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) === 0) return null;
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
      return r;
    };
    const labelRects = el => {
      const rects = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || n.parentElement.closest('svg')) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(r);
      }
      return rects;
    };
    const controls = [];
    let index = 0;
    for (const el of document.querySelectorAll('button, [role=button]')) {
      if (!insideChrome(el)) continue;
      const box = visibleRect(el);
      if (!box) continue;
      const glyph = union([...el.querySelectorAll('svg')].map(s => s.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0));
      if (!glyph) continue;
      const text = labelRects(el);
      const labelWords = (el.innerText || '').trim().split(/\s+/).filter(Boolean);
      if (labelWords.length > maxWords) continue;
      const group = union([glyph, ...text]);
      const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
      const gx = (group.left + group.right) / 2, gy = (group.top + group.bottom) / 2;
      el.setAttribute('data-chrome-guard', String(index));
      controls.push({
        index,
        id: el.id || null,
        name: el.getAttribute('aria-label') || el.getAttribute('title') || el.id || el.className,
        label: labelWords.join(' '),
        disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
        // A command button has no selected state; a tool or toggle on the shared chrome style does.
        selectable: el.classList.contains('chrome-state') || el.hasAttribute('aria-pressed'),
        selectedAtRest: el.classList.contains('active-tool') || el.getAttribute('aria-pressed') === 'true',
        box: {left: box.left, top: box.top, right: box.right, bottom: box.bottom},
        glyph: {left: glyph.left, top: glyph.top, right: glyph.right, bottom: glyph.bottom},
        offsetX: gx - cx,
        offsetY: gy - cy,
      });
      index++;
    }
    return controls;
  }, MAX_LABEL_WORDS);
}

// Forces one state on one tagged control, through the DevTools protocol so the mouse and focus do not move.
export function makeStateForcer(page) {
  let cdp = null;
  let docRoot = null;
  let applied = null;
  const session = async () => {
    if (!cdp) {
      cdp = await page.context().newCDPSession(page);
      await cdp.send('DOM.enable');
      await cdp.send('CSS.enable');
      docRoot = (await cdp.send('DOM.getDocument', {depth: -1})).root.nodeId;
    }
    return cdp;
  };
  const nodeFor = async (index) => {
    const s = await session();
    const {nodeId} = await s.send('DOM.querySelector', {nodeId: docRoot, selector: `[data-chrome-guard="${index}"]`});
    return nodeId;
  };
  return {
    async set(index, state) {
      await this.clear();
      const spec = STATES[state];
      if (spec.className) {
        await page.locator(`[data-chrome-guard="${index}"]`).evaluate((el, cls) => el.classList.add(cls), spec.className);
        applied = {index, className: spec.className};
        return;
      }
      const s = await session();
      const nodeId = await nodeFor(index);
      await s.send('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: spec.pseudo});
      applied = {index, pseudo: true, nodeId};
    },
    async clear() {
      if (!applied) return;
      if (applied.className) {
        await page.locator(`[data-chrome-guard="${applied.index}"]`)
          .evaluate((el, cls) => el.classList.remove(cls), applied.className);
      } else {
        const s = await session();
        await s.send('CSS.forcePseudoState', {nodeId: applied.nodeId, forcedPseudoClasses: []});
      }
      applied = null;
    },
    async outlineOf(index) {
      return page.locator(`[data-chrome-guard="${index}"]`).evaluate((el) => {
        const cs = getComputedStyle(el);
        const width = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) || 0;
        const offset = parseFloat(cs.outlineOffset) || 0;
        return {width, offset};
      });
    },
  };
}

// The control's current box in page pixels, read after any state change.
export async function boxOf(page, index) {
  const b = await page.locator(`[data-chrome-guard="${index}"]`).boundingBox();
  return {left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height};
}

// The screenshot of a control's box and its margin, at the page's device scale.
export async function captureAround(page, box, margin = STATE_MARGIN) {
  const [vw, vh] = await page.evaluate(() => [innerWidth, innerHeight]);
  const x = Math.max(0, Math.floor(box.left - margin));
  const y = Math.max(0, Math.floor(box.top - margin));
  const right = Math.min(vw, Math.ceil(box.right + margin));
  const bottom = Math.min(vh, Math.ceil(box.bottom + margin));
  const clip = {x, y, width: right - x, height: bottom - y};
  const png = await page.screenshot({clip, animations: 'disabled', caret: 'hide'});
  return {clip, png};
}

// Compares two captures of the same clip (device scale 1). Returns how many pixels changed and which changed pixels lie
// outside the control's box grown by `allowance` (the outline width plus its positive offset). Coordinates are page pixels.
export function comparePixels(page, rest, state, clip, box, allowance) {
  return page.evaluate(async ({a, b, clip, box, allowance, tol}) => {
    const load = async (b64) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    };
    const pa = await load(a), pb = await load(b);
    const w = clip.width, h = clip.height;
    const L = Math.floor(box.left - allowance), R = Math.ceil(box.right + allowance);
    const T = Math.floor(box.top - allowance), B = Math.ceil(box.bottom + allowance);
    let changed = 0;
    const outside = [];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      if (Math.abs(pa[i] - pb[i]) <= tol && Math.abs(pa[i + 1] - pb[i + 1]) <= tol && Math.abs(pa[i + 2] - pb[i + 2]) <= tol) continue;
      changed++;
      const x = clip.x + px, y = clip.y + py;
      if ((x < L || x >= R || y < T || y >= B) && outside.length < 10) outside.push([x, y]);
    }
    return {changed, outside};
  }, {a: rest.toString('base64'), b: state.toString('base64'), clip, box, allowance, tol: PIXEL_TOLERANCE});
}
