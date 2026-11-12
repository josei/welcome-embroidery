import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {createEditorWatcher, gitHead, startServer} from '../scripts/serve-watch.mjs';

// Every test runs in its own temp folder with a fake build step, so no Vite build runs and
// the repository's HEAD, dist/ and .serve-watch/ are never touched.

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'serve-watch-'));
  const state = {
    root,
    head: 'a1b2c3d4e5f6000',
    builds: 0,
    fail: false,
    gate: null,          // when set, a build waits on it after writing its output
    onBuildStart: null,  // called with the build number once its output is written
    lines: [],
    errors: [],
  };
  state.build = async outDir => {
    state.builds += 1;
    const n = state.builds;
    await fs.mkdir(outDir, {recursive: true});
    await fs.writeFile(path.join(outDir, 'index.html'), page(n));
    state.onBuildStart?.(n);
    if (state.gate) await state.gate;
    if (state.fail) throw new Error(`forced failure in build ${n}`);
    return outDir;
  };
  return state;
}

function page(n) {
  return `<!doctype html><html><head><title>Welcome</title></head><body><main data-build="${n}">build ${n}</main></body></html>`;
}

function watcherFor(f, options = {}) {
  return createEditorWatcher({
    root: f.root,
    distDir: path.join(f.root, 'dist'),
    buildRoot: path.join(f.root, '.serve-watch'),
    build: f.build,
    readHead: async () => f.head,
    pollMs: 10,
    debounceMs: 300,
    graceMs: 0,
    log: line => f.lines.push(line),
    error: line => f.errors.push(line),
    ...options,
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

// Starts the real server.js against the fixture's dist/ and data folders.
async function startTestServer(f) {
  const port = await freePort();
  const child = startServer({
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      WELCOME_DIST_DIR: path.join(f.root, 'dist'),
      WELCOME_DATA_DIR: path.join(f.root, 'var'),
      WELCOME_SESSION_FILE: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('Welcome listening')) resolve();
    });
    child.once('exit', code => reject(new Error(`server exited with ${code} before listening`)));
  });
  child.stderr.resume();
  return {
    port,
    close: () => new Promise(resolve => {
      child.once('exit', resolve);
      child.kill('SIGTERM');
    }),
  };
}

async function get(port, pathname = '/') {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  return {status: response.status, body: await response.text()};
}

async function waitUntil(predicate, what) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function buildDirs(f) {
  return (await fs.readdir(path.join(f.root, '.serve-watch'))).filter(name => name.startsWith('build-'));
}

test('serves a fresh build on startup and does not rebuild when it matches HEAD (A)', async () => {
  const f = await fixture();
  try {
    await watcherFor(f).prepare();
    assert.equal(f.builds, 1);
    const server = await startTestServer(f);
    try {
      const response = await get(server.port);
      assert.equal(response.status, 200);
      assert.match(response.body, /<main data-build="1">build 1<\/main>/);
    } finally {
      await server.close();
    }
    await watcherFor(f).prepare();
    assert.equal(f.builds, 1, 'a second start on the same commit reuses the build');
  } finally {
    await fs.rm(f.root, {recursive: true, force: true});
  }
});

test('rebuilds when dist was built from another commit', async () => {
  const f = await fixture();
  try {
    await watcherFor(f).prepare();
    f.head = 'ffff000011112222';
    await watcherFor(f).prepare();
    assert.equal(f.builds, 2);
    const dirs = await buildDirs(f);
    assert.equal(dirs.length, 1);
    assert.ok(dirs[0].startsWith('build-ffff00001111-'), `build named for the new commit: ${dirs[0]}`);
  } finally {
    await fs.rm(f.root, {recursive: true, force: true});
  }
});

test('a new commit rebuilds once, is served, and removes the old build (B)', async () => {
  const f = await fixture();
  try {
    const watcher = watcherFor(f);
    await watcher.prepare();
    const server = await startTestServer(f);
    try {
      f.head = 'b2b2b2b2b2b2';
      await watcher.tick();
      await watcher.idle();
      assert.equal(f.builds, 2);
      const response = await get(server.port);
      assert.equal(response.status, 200);
      assert.match(response.body, /build 2/);
      assert.equal((await buildDirs(f)).length, 1, 'only the served build is kept');
    } finally {
      await server.close();
    }
  } finally {
    await fs.rm(f.root, {recursive: true, force: true});
  }
});

test('a burst of commit changes inside the quiet period makes exactly one build (C)', async () => {
  const f = await fixture();
  try {
    const watcher = watcherFor(f, {debounceMs: 300});
    await watcher.prepare();
    f.head = 'c1c1c1c1';
    await watcher.tick();
    f.head = 'c2c2c2c2';
    await watcher.tick();
    f.head = 'c3c3c3c3';
    await watcher.tick();
    assert.equal(f.builds, 1, 'no build starts during the quiet period');
    await watcher.idle();
    assert.equal(f.builds, 2);
    await watcher.tick();
    await watcher.idle();
    assert.equal(f.builds, 2, 'no further build without another commit change');
  } finally {
    await fs.rm(f.root, {recursive: true, force: true});
  }
});

test('requests during a build get complete HTML from the old build; a commit during it queues one more (D)', async () => {
  const f = await fixture();
  try {
    const watcher = watcherFor(f);
    await watcher.prepare();
    const server = await startTestServer(f);
    let release;
    f.gate = new Promise(resolve => { release = resolve; });
    const writing = new Promise(resolve => { f.onBuildStart = resolve; });
    try {
      f.head = 'd1d1d1d1';
      await watcher.tick();
      await writing; // build 2 has written its output but not yet switched dist/
      const responses = await Promise.all(Array.from({length: 10}, () => get(server.port)));
      for (const response of responses) {
        assert.equal(response.status, 200);
        assert.match(response.body, /<main data-build="1">build 1<\/main><\/body><\/html>/);
      }
      f.head = 'd2d2d2d2';
      await watcher.tick();
      release();
      await watcher.idle();
      assert.equal(f.builds, 3, 'the commit during the build causes one follow-up build');
      const response = await get(server.port);
      assert.equal(response.status, 200);
      assert.match(response.body, /build 3/);
    } finally {
      release?.();
      await server.close();
    }
  } finally {
    await fs.rm(f.root, {recursive: true, force: true});
  }
});

test('a failed build is logged, the previous build keeps serving, and a later build is served (E)', async () => {
  const f = await fixture();
  try {
    const watcher = watcherFor(f);
    await watcher.prepare();
    const server = await startTestServer(f);
    try {
      f.fail = true;
      f.head = 'e1e1e1e1';
      await watcher.tick();
      await watcher.idle();
      assert.equal(f.builds, 2);
      assert.ok(f.errors.some(line => /failed/.test(line) && /forced failure in build 2/.test(line)), 'error is logged');
      const kept = await get(server.port);
      assert.equal(kept.status, 200);
      assert.match(kept.body, /build 1/);
      assert.equal((await buildDirs(f)).length, 1, 'the failed output is removed');

      f.fail = false;
      f.head = 'e2e2e2e2';
      await watcher.tick();
      await watcher.idle();
      const later = await get(server.port);
      assert.equal(later.status, 200);
      assert.match(later.body, /build 3/);
    } finally {
      await server.close();
    }
  } finally {
    await fs.rm(f.root, {recursive: true, force: true});
  }
});

test('the interval poll picks up a new commit on its own', async () => {
  const f = await fixture();
  const watcher = watcherFor(f, {pollMs: 10, debounceMs: 20});
  try {
    await watcher.prepare();
    watcher.start();
    f.head = 'p1p1p1p1';
    await waitUntil(() => f.builds === 2, 'a rebuild from the poll');
    watcher.stop();
    await watcher.idle();
    assert.equal(f.builds, 2);
  } finally {
    watcher.stop();
    await fs.rm(f.root, {recursive: true, force: true});
  }
});

test('gitHead reads the checked-out commit of a repository', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'serve-watch-git-'));
  const git = args => new Promise((resolve, reject) => {
    execFile('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args],
      {cwd: dir}, (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
  });
  try {
    await git(['init', '-q']);
    await git(['commit', '-q', '--allow-empty', '-m', 'first']);
    const first = await gitHead(dir);
    assert.equal(first, await git(['rev-parse', 'HEAD']));
    await git(['commit', '-q', '--allow-empty', '-m', 'second']);
    assert.notEqual(await gitHead(dir), first);
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
});
