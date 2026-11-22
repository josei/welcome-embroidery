// Every glyph-only chrome control draws its glyph centred in its box. The controls are found from the DOM at each size and
// language, not from a list, so a new control is checked without being named here.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {
  CHROME_SIZES, LANGS, CENTRE_LIMIT,
  startDistServer, freePort, launchBrowser, openEditor, discoverChromeControls,
} from '../scripts/chrome-controls.mjs';

let server, browser;

before(async () => {
  server = await startDistServer(await freePort());
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  server?.stop();
});

for (const lang of LANGS) for (const [width, height] of CHROME_SIZES) {
  test(`chrome glyphs sit within ${CENTRE_LIMIT}px of their control centre at ${width}x${height} (${lang})`, async () => {
    const {context, page} = await openEditor(browser, server.base, {width, height, lang});
    try {
      const controls = await discoverChromeControls(page);
      assert.ok(controls.length > 0, 'the editor shows chrome controls to check');
      const off = controls
        .filter(c => Math.abs(c.offsetX) > CENTRE_LIMIT || Math.abs(c.offsetY) > CENTRE_LIMIT)
        .map(c => `${c.name}: dx ${c.offsetX.toFixed(2)}px, dy ${c.offsetY.toFixed(2)}px`);
      assert.deepEqual(off, [], `glyphs off centre at ${width}x${height} (${lang})`);
    } finally {
      await context.close();
    }
  });
}
