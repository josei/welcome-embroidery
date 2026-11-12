// Local development convenience: run server.js and rebuild the editor whenever the
// checked-out commit changes, so a long-running local server never serves a stale build.
//
// Layout: each build is written to .serve-watch/build-<commit>-<id>/ and dist/ is a symlink
// to the current one. A new symlink is renamed over dist/ in one step, so requests never see
// a missing or half-written dist/.

import {execFile, spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildStatic} from './build-static.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_PREFIX = 'build-';
// rename() onto a plain folder (left by `npm run build`) fails with one of these.
const PLAIN_FOLDER_ERRORS = new Set(['EISDIR', 'ENOTDIR', 'ENOTEMPTY', 'EEXIST']);

const shortHead = head => String(head ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'unknown';
const seconds = ms => `${(ms / 1000).toFixed(1)}s`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function gitHead(cwd = repoRoot) {
  return new Promise((resolve, reject) => {
    execFile('git', ['rev-parse', 'HEAD'], {cwd}, (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
  });
}

export function createEditorWatcher({
  root = repoRoot,
  distDir = path.join(root, 'dist'),
  buildRoot = path.join(root, '.serve-watch'),
  build = outDir => buildStatic({root, outDir}),
  readHead = () => gitHead(root),
  pollMs = 2000,
  debounceMs = 1000,
  graceMs = 5000,
  log = line => console.log(line),
  error = line => console.error(line),
} = {}) {
  let current = null;          // absolute path of the build dist/ points to
  let lastHead = null;         // last commit seen by the poll
  let running = null;          // promise of the build loop, while a build runs
  let queued = false;          // a build was requested while one was running
  let debounce = null;         // {done, resolve, timer, reason} while a rebuild is waiting for quiet
  let interval = null;
  let polling = false;
  let headFailureLogged = false;
  let stopped = false;

  async function currentTarget() {
    try {
      const link = await fs.readlink(distDir);
      const target = path.resolve(path.dirname(distDir), link);
      return (await fs.stat(target)).isDirectory() ? target : null;
    } catch {
      return null; // missing, or a plain folder rather than a link
    }
  }

  async function swapTo(outDir) {
    const link = path.join(buildRoot, `link-${path.basename(outDir)}`);
    try {
      await fs.rm(link, {force: true});
      await fs.symlink(outDir, link);
      try {
        await fs.rename(link, distDir);
      } catch (err) {
        if (!PLAIN_FOLDER_ERRORS.has(err.code)) throw err;
        // A plain dist/ from `npm run build` cannot be replaced atomically. Clear it once here;
        // this is the only gap, and it happens on the first switch after a plain build.
        await fs.rm(distDir, {recursive: true, force: true});
        await fs.rename(link, distDir);
      }
    } catch (err) {
      await fs.rm(link, {force: true}).catch(() => {});
      throw err;
    }
  }

  async function buildOnce(reason, head) {
    await fs.mkdir(buildRoot, {recursive: true});
    const outDir = path.join(buildRoot, `${BUILD_PREFIX}${shortHead(head)}-${randomUUID().slice(0, 8)}`);
    const started = Date.now();
    log(`[serve:watch] Building ${shortHead(head)} (${reason})`);
    try {
      await build(outDir);
      await swapTo(outDir);
    } catch (err) {
      await fs.rm(outDir, {recursive: true, force: true}).catch(() => {});
      error(`[serve:watch] Build of ${shortHead(head)} failed after ${seconds(Date.now() - started)}; still serving the previous build.\n${err?.stack ?? err}`);
      return;
    }
    const previous = current;
    current = outDir;
    log(`[serve:watch] Built ${shortHead(head)} in ${seconds(Date.now() - started)}; serving it now.`);
    if (previous && previous !== outDir) {
      // Give requests that already resolved the old path a moment to finish before deleting it.
      await sleep(graceMs);
      await fs.rm(previous, {recursive: true, force: true});
    }
  }

  // Builds never overlap: a request during a build sets `queued`, and one more build runs after it.
  function requestBuild(reason) {
    if (running) {
      queued = true;
      return;
    }
    running = (async () => {
      try {
        do {
          queued = false;
          await buildOnce(reason, lastHead);
          reason = 'commit changed during the last build';
        } while (queued && !stopped);
      } finally {
        running = null;
      }
    })();
  }

  // Each commit change restarts the quiet period; the build runs once it has been quiet for debounceMs.
  function scheduleBuild(reason) {
    if (!debounce) {
      let resolve;
      const done = new Promise(r => { resolve = r; });
      debounce = {done, resolve, timer: null, reason};
    }
    clearTimeout(debounce.timer);
    const pending = debounce;
    pending.reason = reason;
    pending.timer = setTimeout(() => {
      debounce = null;
      pending.resolve();
      requestBuild(pending.reason);
    }, debounceMs);
  }

  async function poll() {
    if (polling || stopped) return;
    polling = true;
    try {
      const head = await readHead();
      headFailureLogged = false;
      if (head && head !== lastHead) {
        lastHead = head;
        scheduleBuild('new commit');
      }
    } catch (err) {
      if (!headFailureLogged) error(`[serve:watch] Could not read the checked-out commit: ${err.message}`);
      headFailureLogged = true;
    } finally {
      polling = false;
    }
  }

  async function idle() {
    while (debounce || running) {
      if (debounce) await debounce.done;
      if (running) await running;
    }
  }

  return {
    // Reads the current state and builds before serving if dist/ is missing, is a plain folder,
    // or was built from a different commit. Resolves once that build (if any) has finished.
    async prepare() {
      lastHead = await readHead().catch(() => null);
      current = await currentTarget();
      const builtFromHead = current && lastHead && path.basename(current).startsWith(`${BUILD_PREFIX}${shortHead(lastHead)}-`);
      if (builtFromHead) return;
      // Clear builds left behind by an earlier run; the one dist/ points to, if any, is kept.
      const leftovers = await fs.readdir(buildRoot).catch(() => []);
      await Promise.all(leftovers.map(name => path.join(buildRoot, name))
        .filter(p => p !== current)
        .map(p => fs.rm(p, {recursive: true, force: true})));
      requestBuild('startup');
      await running;
    },
    start() {
      interval = setInterval(() => { poll(); }, pollMs);
    },
    stop() {
      stopped = true;
      clearInterval(interval);
      if (debounce) {
        clearTimeout(debounce.timer);
        debounce.resolve();
        debounce = null;
      }
    },
    // One poll of the commit now (the interval calls this too).
    tick: poll,
    // Resolves when no rebuild is waiting for quiet and none is running.
    idle,
    currentBuild: () => current,
  };
}

// Starts server.js as a child process. The caller passes PORT and HOST in env.
export function startServer({env = process.env, serverFile = path.join(repoRoot, 'server.js'), stdio = 'inherit'} = {}) {
  return spawn(process.execPath, [serverFile], {env, stdio});
}

async function main() {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const watcher = createEditorWatcher();
  await watcher.prepare();
  const server = startServer({env: {...process.env, PORT: String(port), HOST: host}});
  watcher.start();
  const shutdown = () => {
    watcher.stop();
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  server.on('exit', code => {
    watcher.stop();
    process.exit(code ?? 0);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
