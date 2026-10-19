# Reader codec status

## API

`src/readers.js` exports `decodeEmbroidery(bytes, format)`, where `bytes` is a
`Uint8Array` or `ArrayBuffer` and `format` is `jef` or `vp3`. It returns:

- `stitches`: ordered `{x, y, cmd, thread}` events with coordinates in mm;
- `threads`: ordered thread records with color and available format metadata;
- `bounds`: `[minX, minY, maxX, maxY]` over all decoded events, in mm;
- `warnings`: an array reserved for nonfatal normalization notes.

Commands are `stitch`, `jump`, `trim`, `color`, `stop`, and `end` as represented
by the input. JEF zero displacement jump records are interpreted as trims,
matching pystitch. JEF's default 3 mm trim inference and clipping are applied.
The decoder retains machine stitch coordinates and command structure; it does
not recover original digitizing vectors.

The decoder rejects unsupported formats, malformed/truncated control data,
invalid offsets and block lengths, missing end markers, and designs with no
sewable stitches. Limits are 64 MiB per file, 2,000,000 decoded events, 256
threads, and absolute coordinates of 10,000 mm (100,000 native units at
0.1 mm per unit). Parsing loops are bounded by
input length and the event cap; bounds calculation uses a linear scan.

## Parity evidence

`node test/readers.test.js` compares all 24 JEF and 19 VP3 files in
`fixtures/embroidepy/samples.zip` against the checked-in machine-readable
`scripts/reader-parity.json`. Input SHA-256 hashes pin the corpus files.
Command/coordinate digests use integer coordinates in 1/10000 mm, avoiding
Python/JavaScript float JSON spelling differences. Tests also compare command
counts, thread colors/order, and bounds. Ordinary tests need Node only and do
not read `/tmp` or import pystitch.

The reference generator is `scripts/reader-reference.py`. Reproduce the report
with Python and the MIT pystitch source at commit
`b72b557f2ebb1fdc51f30edc3c73ff6a851ea015` on `PYTHONPATH`, then run:

```sh
PYTHONPATH=/path/to/pystitch/src python3 scripts/reader-reference.py
```

The report stores both raw pinned VP3 digests and corrected-oracle digests.
For the corrected oracle, the reference `vp3_read_colorblock` is changed only
at its block-origin guard: it calls `move_abs` for every color block. This
preserves no-op jump commands and correctly resets both coordinates when a
block origin is `(0, 0)`. The raw-versus-corrected difference is recorded on
each VP3 fixture as `rawCommandsSha256`, `commandsSha256`, and
`originCorrectionDiffers`; it is not hidden by excluding those fixtures.
`test/readers.test.js` includes a constructed multi-block case whose second
block returns from a nonzero position to `(0, 0)`, plus a no-op-origin check.

JEF palette colors and modulo indexing match all 79 entries of pinned
`EmbThreadJef.get_thread_set()` (including the `0` placeholder and palette
index 70 Old Gold `#cba21c`). No fixture in the 24-file JEF corpus contains a
zero palette ID, so none exercises a true STOP. A synthetic regression sets a
null palette entry and checks that the reader emits `stop`, removes that null
entry from the ordered thread list, and does not advance the palette cursor.

## Integration notice

The reader is an independently written JavaScript port of behavior from the
MIT-licensed Ink/Stitch pystitch JEF/VP3 readers and their stitch normalization,
pinned at the commit above. Relevant upstream sources include `JefReader.py`,
`Vp3Reader.py`, `EmbThreadJef.py`, and `EmbPattern.py`. Preserve
`LICENSE-THIRD-PARTY-pystitch.txt` and add a reader derivation entry to
`THIRD_PARTY_NOTICES.md` when integrating; do not remove or relicense the
upstream MIT notice. The VP3 origin correction is Welcome's intentional fix for
the pinned reader's `abs_x != 0 and abs_y != 0` condition.

## Current limits

Only JEF and VP3 machine stitch decoding is supported by this reader. Editor
document validation currently accepts `stitch`, `jump`, `trim`, `color`, and
`end`, but not `stop`; a decoded file containing a true JEF STOP can still be
rejected by the editor import commit path. Reader command support is distinct
from editor import support. This is not source-design recovery and does not
promise richer thread-brand metadata than each format stores. Compatibility
evidence covers the pinned 43-file corpus and malformed input guards listed in
`test/readers.test.js`; it does not imply all vendor extensions or every
malformed-file variant is accepted or repaired.
