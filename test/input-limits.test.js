import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {str, bounded} from '../input-limits.js';
import {z} from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('str() accepts exactly its limit and rejects one more', () => {
  const s = str(5);
  assert.equal(s.safeParse('abcde').success, true);
  assert.equal(s.safeParse('abcdef').success, false);
});

test('bounded() accepts exactly its limit and rejects one more, before parsing items', () => {
  let parsed = 0;
  const item = z.string().transform(v => { parsed++; return v; });
  const schema = bounded(z.array(item).min(1).max(3));
  assert.equal(schema.safeParse(['a', 'b', 'c']).success, true);
  parsed = 0;
  const over = schema.safeParse(Array.from({length: 10000}, () => 'a'));
  assert.equal(over.success, false);
  assert.match(over.error.issues[0].message, /at most 3/);
  assert.ok(parsed <= 4, `an oversized array parses at most max + 1 items, parsed ${parsed}`);
  assert.equal(schema.safeParse(undefined).success, false);
  assert.equal(bounded(z.array(z.string()).max(2)).optional().safeParse(undefined).success, true);
});

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const {port} = srv.address(); srv.close(() => resolve(port)); });
  });
}

// --- Schema walking for the live boundary test -------------------------------------------
// The tool schemas are read from tools/list, so every capped node is driven without a
// hand-written list. A path is an array of segments such as
// ['properties', 'operations', 'items', 'anyOf', '19', 'properties', 'ids', 'items'].

const isPrefix = (a, b) => a.length <= b.length && a.every((s, i) => s === b[i]);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Zod's path for a schema node: properties.K -> K, items -> [0], anyOf.N -> nothing.
function zodPath(segs) {
  let p = '';
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s === 'properties') { const k = segs[++i]; p = p ? `${p}.${k}` : k; }
    else if (s === 'items') p += '[0]';
    else if (s === 'anyOf') i++;
  }
  return p;
}

// Smallest value that satisfies a node, ignoring its caps.
function minimal(node) {
  if (node.enum) return node.enum[0];
  if (node.const !== undefined) return node.const;
  if (node.type === 'string') return 'a';
  if (node.type === 'number' || node.type === 'integer') return node.minimum ?? 0;
  if (node.type === 'boolean') return false;
  if (node.type === 'array') return Array.from({length: node.minItems ?? 0}, () => minimal(node.items));
  if (node.type === 'object') {
    return Object.fromEntries(Object.entries(node.properties ?? {})
      .filter(([k]) => (node.required ?? []).includes(k))
      .map(([k, v]) => [k, minimal(v)]));
  }
  return undefined;
}

// The capped node itself, filled to `size` (its cap, or cap + 1).
function atSize(node, size) {
  if (node.type === 'string' && node.maxLength !== undefined) return 'a'.repeat(size);
  if (node.type === 'array' && node.maxItems !== undefined) return Array.from({length: size}, () => minimal(node.items));
  return minimal(node);
}

// A request body that is valid everywhere except the target node, which holds `size`.
function sample(node, at, target, size) {
  if (at.length === target.length) return atSize(node, size);
  const onPath = isPrefix(at, target);
  if (node.anyOf) {
    const idx = onPath ? Number(target[at.length + 1]) : 0;
    return sample(node.anyOf[idx], [...at, 'anyOf', String(idx)], target, size);
  }
  if (node.type === 'object' && node.properties) {
    const out = {};
    for (const [k, v] of Object.entries(node.properties)) {
      const next = [...at, 'properties', k];
      if ((node.required ?? []).includes(k) || isPrefix(next, target)) out[k] = sample(v, next, target, size);
    }
    return out;
  }
  if (node.type === 'array') {
    const n = Math.max(node.minItems ?? 0, onPath ? 1 : 0);
    return Array.from({length: n}, () => sample(node.items, [...at, 'items'], target, size));
  }
  return minimal(node);
}

// Every capped node (string maxLength or array maxItems) under a schema.
function cappedPaths(schema, segs = [], out = []) {
  if (!schema || typeof schema !== 'object') return out;
  if (schema.maxLength !== undefined || schema.maxItems !== undefined) out.push(segs);
  for (const [k, v] of Object.entries(schema)) if (v && typeof v === 'object') cappedPaths(v, [...segs, k], out);
  return out;
}

// Every string or array node that lacks a cap (enum and const strings are fixed).
function uncappedPaths(schema, segs = [], out = []) {
  if (!schema || typeof schema !== 'object') return out;
  if (schema.type === 'string' && schema.maxLength === undefined && !schema.enum && schema.const === undefined) out.push(segs.join('/'));
  if (schema.type === 'array' && schema.maxItems === undefined) out.push(segs.join('/'));
  for (const [k, v] of Object.entries(schema)) if (v && typeof v === 'object') uncappedPaths(v, [...segs, k], out);
  return out;
}

test('live MCP tools: every capped input rejects one past its cap and accepts the cap', async t => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const dataDir = await mkdtemp(path.join(tmpdir(), 'welcome-limits-'));
  const service = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {...process.env, HOST: '127.0.0.1', PORT: String(port), WELCOME_ANONYMOUS_MCP: '1', WELCOME_SESSION_FILE: '', WELCOME_DATA_DIR: dataDir},
    stdio: 'ignore',
  });
  t.after(() => service.kill('SIGTERM'));
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try { ready = (await fetch(`${base}/health`)).ok; } catch {}
    if (!ready) await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, 'test MCP service did not start');

  const client = new Client({name: 'input-limits-test', version: '1.0.0'});
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  t.after(() => client.close());

  // Returns the error text when the call was refused, '' when it went through.
  async function callText(name, args) {
    try {
      const res = await client.callTool({name, arguments: args});
      return res.isError ? String(res.content?.[0]?.text ?? '') : '';
    } catch (err) {
      return String(err.message);
    }
  }

  const {tools} = await client.listTools();

  // Criterion 1: every string and array input in the advertised schema has a cap.
  const uncapped = tools.flatMap(tool => uncappedPaths(tool.inputSchema).map(p => `${tool.name} ${p}`));
  assert.deepEqual(uncapped, [], 'every string and array input must have an explicit cap');

  // Criterion 3: for each capped node, the cap is accepted, and cap + 1 is refused with
  // zod's "at most N" message on that exact path. Each run is one call with only the
  // target node at the boundary; the rest of the request is valid.
  let driven = 0;
  for (const tool of tools) {
    for (const segs of cappedPaths(tool.inputSchema)) {
      const node = segs.reduce((n, s) => n[s], tool.inputSchema);
      const max = node.maxLength ?? node.maxItems;
      const at = zodPath(segs);
      // Fixed-length arrays (.length(n)) say "exactly n"; the rest say "at most n".
      const atMost = new RegExp(`(?:at most|exactly) ${max} [a-z()]+ at ${esc(at)}(?![\\w\\[.])`);
      await t.test(`${tool.name} ${at} (cap ${max})`, async () => {
        const build = size => sample(tool.inputSchema, [], segs, size);
        const atCap = await callText(tool.name, build(max));
        assert.equal(atMost.test(atCap), false, `${max} must be accepted at ${at}: ${atCap.slice(0, 300)}`);
        const over = await callText(tool.name, build(max + 1));
        assert.equal(atMost.test(over), true, `${max + 1} must be refused at ${at}: ${over.slice(0, 300)}`);
      });
      driven++;
    }
  }
  assert.ok(driven >= 100, `expected every capped node to be driven, got ${driven}`);

  // The advertised schema keeps the array shape, so clients still see type and maxItems.
  const opsSchema = tools.find(x => x.name === 'document_apply').inputSchema.properties.operations;
  assert.equal(opsSchema.type, 'array');
  assert.equal(opsSchema.maxItems, 40);
});
