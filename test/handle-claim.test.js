import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HANDLE_HIT_PX,handleClaimPx,pressClaimedByHandle} from '../src/handleClaim.js';

// Distances are measured from the handle's centre to the press, in world units; scale is screen px per world unit.
// A handle on the frame's corner sits at (W/2, H/2) from the object's centre, so a press at the centre is √2/2 × side
// away from the corner handle and half a side from each edge handle.

// Which area decides handle versus body: the 44 px square is the handle's drawn target, but on objects smaller
// than 73 px a press only resizes inside the claim disc around the handle's centre. These tests pin the disc sizes.
test('the handle square is 44 screen px, and the claim disc is 22 px on large objects', () => {
  assert.equal(HANDLE_HIT_PX, 44);
  assert.equal(handleClaimPx(200, 200, 1), 22);
});

test('the claim disc on 30, 45 and 60 px objects is 30 % of the shorter side, not the 44 px square', () => {
  assert.equal(handleClaimPx(30, 30, 1), 9);
  assert.equal(handleClaimPx(45, 45, 1), 13.5);
  assert.equal(handleClaimPx(60, 60, 1), 18);
  // A 60 px object's claim disc is 36 px across, less than the 44 px square, so the centre is never claimed.
  assert.ok(2 * handleClaimPx(60, 60, 1) < HANDLE_HIT_PX);
});

for (const size of [30, 45, 60]) {
  test(`a press on the handle centre resizes a ${size} px object`, () => {
    assert.equal(pressClaimedByHandle(0, size, size, 1), true);
  });

  test(`a press at the centre of a ${size} px object moves it`, () => {
    // Nearest handle to the centre is an edge handle, half a side away.
    assert.equal(pressClaimedByHandle(size / 2, size, size, 1), false);
    // Corner handle, √2/2 × side away.
    assert.equal(pressClaimedByHandle(Math.SQRT1_2 * size, size, size, 1), false);
  });
}

test('a corner press within the claim disc resizes; one just outside moves', () => {
  const size = 30, r = handleClaimPx(size, size, 1);
  assert.equal(pressClaimedByHandle(r - 0.1, size, size, 1), true);
  assert.equal(pressClaimedByHandle(r + 0.1, size, size, 1), false);
});

test('the claim scales with zoom, so a 45 px object at 2x claims the same screen radius', () => {
  assert.equal(handleClaimPx(45, 45, 2), handleClaimPx(90, 90, 1));
  assert.equal(pressClaimedByHandle(5, 45, 45, 2), pressClaimedByHandle(10, 90, 90, 1));
});
