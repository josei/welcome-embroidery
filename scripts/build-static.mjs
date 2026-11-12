import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Builds the self-contained editor into outDir (default: dist/ in the repo root).
// scripts/serve-watch.mjs calls this with a fresh folder for each commit.
export async function buildStatic({root = repoRoot, outDir = path.join(root, 'dist')} = {}) {
  const out = path.resolve(outDir);
  await fs.rm(out, {recursive: true, force: true});
  await build({configFile: path.join(root, 'vite.config.js'), root, logLevel: 'warn', build: {outDir: out}});
  let html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  const link = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
  if (!link) throw Error('Expected bundled stylesheet link was not found.');
  const css = await fs.readFile(path.join(out, link[1]), 'utf8');
  // The stylesheet sat in dist/assets/, so its relative url(./…) (the bundled fonts) must point into assets/ once it is inlined here.
  const cssEmbedded = css.replace(/url\(\.\/(?!assets\/)/g, 'url(./assets/');
  html = html.replace(link[0], `<meta name="welcome-static" content="true"><style>\n${cssEmbedded}\n</style>`);
  await fs.writeFile(path.join(out, 'index.html'), html);
  await fs.rm(path.join(out, link[1]));
  await fs.cp(path.join(root, 'fonts'), path.join(out, 'fonts'), {recursive: true});
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'LICENSE-THIRD-PARTY-pystitch.txt', 'LICENSE-THIRD-PARTY-polygon-clipping.txt'])
    await fs.copyFile(path.join(root, file), path.join(out, file));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildStatic();
  console.log('Built self-contained static asset tree in dist/ with a bundled editor, embedded CSS, relative assets and fonts, and license notices.');
}
