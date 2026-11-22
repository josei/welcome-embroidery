// Renders the rest, hover, selected, focus and pressed states of every glyph-only chrome control, cropped to the control
// with its margin, at 3x resolution. Covers the four standard sizes in English and Spanish, and writes an index.md with a
// caption per image.
// Usage: node scripts/chrome-state-harness.mjs <outDir>   (builds dist/ first: npm run build)
import {mkdir, writeFile} from 'node:fs/promises';
import {join, relative, resolve} from 'node:path';
import {
  STANDARD_SIZES, LANGS, STATES,
  startDistServer, freePort, launchBrowser, openEditor, discoverChromeControls,
  makeStateForcer, boxOf, captureAround,
} from './chrome-controls.mjs';

const outDir = resolve(process.argv[2] || 'chrome-states');
const STATE_LABELS = {rest: 'rest', hover: 'hover', selected: 'selected', 'focus-visible': 'focus', pressed: 'pressed'};
const DEVICE_SCALE = 3;

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'control';

const server = await startDistServer(await freePort());
const browser = await launchBrowser();
const index = [];
try {
  for (const lang of LANGS) for (const [width, height] of STANDARD_SIZES) {
    const {context, page} = await openEditor(browser, server.base, {width, height, lang, deviceScaleFactor: DEVICE_SCALE});
    const forcer = makeStateForcer(page);
    const dir = join(outDir, `${width}x${height}-${lang}`);
    await mkdir(dir, {recursive: true});
    const controls = await discoverChromeControls(page);
    for (const c of controls) {
      const selectable = c.selectable && !c.selectedAtRest;
      for (const state of ['rest', ...Object.keys(STATES)]) {
        if (state === 'selected' && !selectable) continue;
        await forcer.clear();
        if (state !== 'rest') await forcer.set(c.index, state);
        const shot = await captureAround(page, await boxOf(page, c.index));
        const file = `${String(c.index).padStart(2, '0')}-${slug(c.name)}-${STATE_LABELS[state]}.png`;
        await writeFile(join(dir, file), shot.png);
        const caption = `${c.name} — ${STATE_LABELS[state]} — ${width}×${height} ${lang}`;
        index.push({dir, file, caption});
      }
    }
    await forcer.clear();
    await context.close();
    console.log(`${width}x${height} ${lang}: ${controls.length} controls`);
  }
} finally {
  await browser.close();
  server.stop();
}

const lines = ['# Chrome control states', '', 'Each image is one control in one state, cropped with a margin, at 3x.', ''];
for (const {dir, file, caption} of index) {
  lines.push(`![${caption}](${relative(outDir, join(dir, file))})`, '', `${caption}`, '');
}
await writeFile(join(outDir, 'index.md'), lines.join('\n'));
console.log(`${index.length} images in ${outDir}`);
