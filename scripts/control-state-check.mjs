// Records the computed colours of the header Undo/Redo glyphs and the Export button in each control state:
// Undo disabled and enabled, and Export at rest, on hover and while pressed (mousedown).
// Contrast is measured the way WCAG does: the glyph colour is blended with its element opacity over the
// nearest opaque background behind it, then compared with the Export label (white) or the header background.
// Usage: node scripts/control-state-check.mjs [baseUrl]   (serve dist first, e.g. scripts/serve-dist.mjs)
import {chromium} from 'playwright';

const base = process.argv[2] || `http://127.0.0.1:${process.env.PORT || 18787}/`;
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
page.on('dialog', d => d.accept());
await page.goto(base, {waitUntil: 'networkidle', timeout: 60000});

// Read the computed style of a control, with its glyph colour blended over the background behind it.
const read = (sel) => page.evaluate((sel) => {
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1};
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  // Background behind the element: the first opaque background walking up the tree (white if none).
  let behind = {r: 255, g: 255, b: 255, a: 1};
  const chain = [];
  for (let n = el.parentElement; n; n = n.parentElement) chain.push(getComputedStyle(n).backgroundColor);
  for (const s of chain.reverse()) { const c = parse(s); if (c && c.a > 0) behind = over(c, behind); }
  const opacity = [];
  for (let n = el; n; n = n.parentElement) opacity.push(Number(getComputedStyle(n).opacity));
  const alpha = opacity.reduce((a, b) => a * b, 1);
  const ownBg = parse(cs.backgroundColor);
  const bg = ownBg && ownBg.a > 0 ? over(ownBg, behind) : behind;
  const fgRaw = parse(cs.color);
  const fg = over({...fgRaw, a: fgRaw.a * alpha}, bg);
  const hex = (c) => `#${[c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const L1 = lum(fg), L2 = lum(bg);
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  return {
    background: cs.backgroundColor,
    backgroundHex: hex(bg),
    color: cs.color,
    opacity: alpha,
    glyphHex: hex(fg),
    contrast: Number(ratio.toFixed(2)),
  };
}, sel);

const out = {};
// Undo disabled: no history yet.
out.undoDisabled = {rest: await read('#undo')};
out.undoDisabledHover = await (async () => { await page.hover('#undo'); const r = await read('#undo'); await page.mouse.move(0, 0); return r; })();

// Draw one triangle so Undo has a step and Export is enabled.
await page.locator('#path').click();
const m = await page.evaluate(() => { const c = document.querySelector('#art').getScreenCTM(); return {a: c.a, d: c.d, e: c.e, f: c.f}; });
for (const [x, y] of [[-20, -20], [20, -20], [0, 20]]) {
  await page.mouse.click(m.a * x + m.e, m.d * y + m.f);
}
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await page.mouse.move(0, 0);
out.undoEnabled = {rest: await read('#undo')};

// Export: rest, hover, mousedown. The mousedown is released without a click so no dialog opens.
out.exportRest = await read('#export');
await page.hover('#export');
out.exportHover = await read('#export');
const box = await page.locator('#export').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(150);
out.exportPressed = await read('#export');
await page.mouse.up();
await page.keyboard.press('Escape');
await page.mouse.move(0, 0);

// Export label is white, so the label contrast against each Export background is its own ratio.
for (const k of ['exportRest', 'exportHover', 'exportPressed']) {
  const bg = out[k].backgroundHex;
  out[k].labelContrastWhite = null;
  out[k].labelContrastWhite = await page.evaluate((bg) => {
    const p = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const L = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    return Number(((1.05) / (L + 0.05)).toFixed(2));
  }, bg);
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
