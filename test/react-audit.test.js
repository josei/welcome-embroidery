import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('the React audit runs and reports no regression from its baseline', () => {
 const result = spawnSync(process.execPath, ['scripts/react-audit.mjs'], {encoding: 'utf8'});
 assert.equal(result.status, 0, result.stdout + result.stderr);
 assert.match(result.stdout, /placeholders \(data-react-panel markers\)/);
 assert.match(result.stdout, /checks still above target/);
});
