// The view switch and the desktop menu headers show hover and pressed as a visible change inside their own boxes. Each is
// forced through the DevTools protocol and compared with its rest state in pixels, so a control that loses its shared
// style fails here rather than only in the wider chrome sweep. Checked at a desktop and a tablet size, in both languages.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {
  startDistServer, freePort, launchBrowser, openEditor, discoverChromeControls,
  makeStateForcer, boxOf, captureAround, comparePixels,
} from '../scripts/chrome-controls.mjs';

const SIZES = [[1440, 900], [768, 1024]];
const TARGETS = '.segmented button[data-view], .top .file-menu > button[aria-haspopup]';

let server, browser;

before(async () => {
  server = await startDistServer(await freePort());
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  server?.stop();
});

for (const lang of ['en', 'es']) for (const [width, height] of SIZES) {
  test(`view switch and desktop menu headers show hover and pressed at ${width}x${height} (${lang})`, async () => {
    const {context, page} = await openEditor(browser, server.base, {width, height, lang});
    const forcer = makeStateForcer(page);
    try {
      const controls = await discoverChromeControls(page);
      const targetIndexes = await page.evaluate(sel => [...document.querySelectorAll(sel)]
        .map(el => el.getAttribute('data-chrome-guard')).filter(Boolean), TARGETS);
      const targets = controls.filter(c => targetIndexes.includes(String(c.index)));
      // The view switch is on every size, so at least its three buttons must be checked.
      assert.ok(targets.length >= 3, 'the view switch buttons are checked');
      const problems = [];
      for (const c of targets) {
        const name = `${c.name} (${c.index})`;
        const box = await boxOf(page, c.index);
        const rest = await captureAround(page, box);
        for (const state of ['hover', 'pressed']) {
          await forcer.clear();
          await forcer.set(c.index, state);
          const current = await boxOf(page, c.index);
          const shot = await captureAround(page, current);
          const {changed, outside} = await comparePixels(page, rest.png, shot.png, rest.clip, current, 0);
          await forcer.clear();
          if (outside.length) problems.push(`${name} ${state}: pixels outside the box at ${JSON.stringify(outside)}`);
          if (changed === 0) problems.push(`${name} ${state}: no visible change from rest`);
        }
      }
      assert.deepEqual(problems, [], `view switch and menu headers at ${width}x${height} (${lang})`);
    } finally {
      await forcer.clear();
      await context.close();
    }
  });
}
