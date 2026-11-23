// Walks the editor's use cases in both languages at four phone and tablet sizes, and saves a screenshot after every step.
// Each walk is a file in scripts/walks/ that exports {name, steps}. A step is {name, run(page)}; the runner screenshots the page
// after it. Run `npm run walk`, or `npm run walk -- edit-object-details` to run one walk. Output goes to walk-screenshots/.
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'walk-screenshots');
const port = Number(process.env.PORT || 18795);
const base = `http://127.0.0.1:${port}`;
const SIZES = [[360, 640], [390, 844], [844, 390], [768, 1024]];
const LANGS = [['es', '/?lang=es'], ['en', '/']];

const only = process.argv[2];
const walkFiles = (await fs.readdir(path.join(root, 'scripts', 'walks'))).filter(f => f.endsWith('.mjs')).sort();
const walks = [];
for (const f of walkFiles) {
  const walk = (await import(pathToFileURL(path.join(root, 'scripts', 'walks', f)).href)).default;
  if (!only || walk.name === only) walks.push(walk);
}
if (!walks.length) { console.error(`No walk named ${only}`); process.exit(1); }

const sanitise = s => s.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();

// The server serves the built editor from dist/, so the walk always runs the code as it is now.
console.log('Building the editor');
execFileSync('npm', ['run', 'build'], {cwd: root, stdio: 'inherit'});
const server = spawn(process.execPath, [path.join(root, 'scripts', 'serve-dist.mjs')], {cwd: root, env: {...process.env, HOST: '127.0.0.1', PORT: String(port)}, stdio: 'ignore'});
try {
  for (let tries = 0; ; tries++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    if (tries > 100) throw new Error('the editor server did not start');
    await new Promise(r => setTimeout(r, 100));
  }
  const browser = await chromium.launch({headless: true});
  const failures = [];
  try {
    for (const walk of walks) for (const [w, h] of SIZES) for (const [lang, query] of LANGS) {
      const dir = path.join(outRoot, sanitise(walk.name), `${lang}-${w}x${h}`);
      await fs.rm(dir, {recursive: true, force: true});
      await fs.mkdir(dir, {recursive: true});
      const context = await browser.newContext({viewport: {width: w, height: h}});
      const page = await context.newPage();
      page.setDefaultTimeout(10000); // a step that cannot find its control fails, rather than waiting for ever
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', d => d.dismiss());
      await page.addInitScript(() => { delete window.showSaveFilePicker; });
      await page.goto(base + query);
      await page.waitForLoadState('load');
      let index = 0;
      for (const step of walk.steps) {
        index++;
        const file = path.join(dir, `${String(index).padStart(2, '0')}-${sanitise(step.name)}.png`);
        try {
          await step.run(page);
        } catch (err) {
          failures.push(`${walk.name} ${lang} ${w}x${h} step "${step.name}": ${err.message.split('\n')[0]}`);
        }
        await page.waitForTimeout(250);
        await page.screenshot({path: file});
      }
      if (errors.length) failures.push(`${walk.name} ${lang} ${w}x${h}: page errors: ${errors.join('; ')}`);
      await context.close();
      console.log(`${walk.name} ${lang} ${w}x${h}: ${walk.steps.length} steps -> ${path.relative(root, dir)}`);
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error('\nWalk failures:\n' + failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  server.kill();
}
