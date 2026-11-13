import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Internal tracker numbers must not appear in the public repository: comments,
// test names, stylesheets, workflows and docs describe the code in its own terms.
const root = fileURLToPath(new URL('..', import.meta.url));

// A bare "#NNN" counts as a tracker number only when it stands alone: after a
// space, an opening bracket or the start of a line, and not inside a colour
// such as "#000" in an attribute or "#333" after a colon.
const patterns = [
  /\b[Ii]ssues? #\d+/,
  /\b[Ss]pecs? #\d+/,
  /\bpart of #\d+/,
  /(?<![^\s(])#\d{3}(?!\w)/,
];

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], {cwd: root, encoding: 'utf8'});
  return out
    .split('\0')
    .filter(Boolean)
    .filter((file) => !file.startsWith('dist/') && file !== 'package-lock.json');
}

function offendingLines() {
  const hits = [];
  for (const file of trackedFiles()) {
    let text;
    try {
      text = readFileSync(root + file, 'utf8');
    } catch {
      continue; // deleted in the working tree, or unreadable
    }
    if (text.includes('\0')) continue; // binary
    text.split('\n').forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 160)}`);
      }
    });
  }
  return hits;
}

test('no tracked file cites a tracker number, spec section or role', () => {
  const hits = offendingLines();
  assert.deepEqual(
    hits,
    [],
    `Remove tracker references (issue numbers, spec sections, reviews, roles) and describe the code instead:\n${hits.join('\n')}`,
  );
});
