// Each chrome control's hover, selected, focus and pressed states change pixels only inside the control's box, and each state visibly differs from rest. Only a margin around the box is compared, and the states are
// forced through the DevTools protocol so the pointer and focus stay where they are. A command button has no selected
// state, and one that is already selected at rest has nothing to add, so neither is checked for selected.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {
  CHROME_SIZES, LANGS, STATES,
  startDistServer, freePort, launchBrowser, openEditor, discoverChromeControls,
  makeStateForcer, boxOf, captureAround, comparePixels,
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
  test(`chrome state changes stay inside each control's box at ${width}x${height} (${lang})`, async () => {
    const {context, page} = await openEditor(browser, server.base, {width, height, lang});
    const forcer = makeStateForcer(page);
    try {
      const controls = await discoverChromeControls(page);
      assert.ok(controls.length > 0, 'the editor shows chrome controls to check');
      const problems = [];
      for (const c of controls) {
        const name = `${c.name} (${c.index})`;
        // Nothing may draw past the box: focus rings are inset, so the allowance is zero.
        const allowance = 0;

        const box = await boxOf(page, c.index);
        const rest = await captureAround(page, box);
        for (const state of Object.keys(STATES)) {
          if (state === 'selected' && (!c.selectable || c.selectedAtRest)) continue;
          await forcer.clear();
          await forcer.set(c.index, state);
          const current = await boxOf(page, c.index);
          const shot = await captureAround(page, current);
          const {changed, outside} = await comparePixels(page, rest.png, shot.png, rest.clip, current, allowance);
          await forcer.clear();
          if (outside.length) problems.push(`${name} ${state}: pixels outside the box at ${JSON.stringify(outside)}`);
          // A disabled control shows no hover or pressed style by design, so only enabled controls must change visibly.
          if (!c.disabled && changed === 0) problems.push(`${name} ${state}: no visible change from rest`);
        }
      }
      assert.deepEqual(problems, [], `chrome states at ${width}x${height} (${lang})`);
    } finally {
      await forcer.clear();
      await context.close();
    }
  });
}
