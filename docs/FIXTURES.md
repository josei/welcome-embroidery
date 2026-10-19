# Embroidery fixture sources

Verified 2026-10-05. The validation workflow requires zero humans: no manual Wilcom sessions, sewing-machine access or user-supplied sample files.

## Recommended primary corpus: EmbroidePy/samples

[Repository](https://github.com/EmbroidePy/samples) · [pinned revision](https://github.com/EmbroidePy/samples/tree/6e65f1ae8599b1e04d3e082aae1b86abed52ec9e) · [MIT license](https://github.com/EmbroidePy/samples/blob/6e65f1ae8599b1e04d3e082aae1b86abed52ec9e/LICENSE).

Downloaded and inspected the complete pinned archive: **627 files, 2,627,853 uncompressed bytes**, including license/readme, previews and sidecars. This is a count of files, not distinct designs or 627 machine files. The archive is 983,049 bytes.

The corpus is saved locally as [samples.zip](../fixtures/embroidepy/samples.zip), with a [manifest](../fixtures/embroidepy/manifest.json) containing every path, byte size, raw download URL and SHA-256, and the original [license](../fixtures/embroidepy/LICENSE). The ZIP contains a single `samples-6e65f1ae8599b1e04d3e082aae1b86abed52ec9e/` root directory.

| Format | Files |
| --- | ---: |
| JEF | 24 |
| VP3 | 19 |
| PES | 73 |
| PEC | 25 |
| DST | 25 |
| EXP | 35 |
| EMB | 15 |
| HUS | 15 |
| SEW | 15 |
| VIP | 15 |
| XXX | 29 |
| U01 | 15 |
| TBF | 10 |
| JEF+ | 5 |
| VP4 | 5 |
| CSV / SVG / PNG | 5 each |

There are additional formats and thread/preview sidecars; the manifest contains the complete extension inventory. Presence in this corpus does not imply Welcome or Ink/Stitch supports that format.

Most files belong to five design families (`random1`, `random2`, `random3`, `scene`, `spiralbox`), with producer/version labels in their filenames, including Wilcom, Premier and Brother. This makes the collection useful for comparing the same source across programs/formats. Preserve sibling sidecars. Shared family names are candidate correspondences, not proof that every exported command or color must be identical.

### EMB starting point

The archive contains 15 `.EMB` files. `random1` and `random3` have filenames labeled `e1`, `e15`, `e18`, `e2`, `e2006` and an unqualified Wilcom export; `random2`, `scene` and `spiralbox` have one unqualified export each. All 15 downloaded files start with `d0 cf 11 e0 a1 b1 1a e1` (the compound-document signature). File names provide version hints; internal version fields and editable-object coverage have not yet been decoded or verified.

These paired EMB/machine outputs enable automated format investigation without a human running Wilcom. They are not yet expected-object fixtures for lettering, underlay and all other Wilcom semantics. Expand those expectations as the format is decoded; do not infer complete editable-object support merely from recovering stitches.

### What is verified

- Pinned GitHub revision and non-truncated repository inventory.
- Successful archive download and extraction to a temporary inspection directory.
- Counts, byte sizes and SHA-256 hashes for all 627 files.
- Original MIT license included; EMB initial signatures inspected.

No embroidery parser, renderer or round-trip suite has been run against these files in Welcome yet. This is a verified fixture acquisition, not a compatibility test result.

## Complement: Ink/Stitch pystitch tests

[Test directory](https://github.com/inkstitch/pystitch/tree/b72b557f2ebb1fdc51f30edc3c73ff6a851ea015/test) · commit `b72b557f2ebb1fdc51f30edc3c73ff6a851ea015` · MIT.

The inspected directory has 29 Python files, including helpers and initialization. It supplies generated patterns and assertions rather than a large committed binary design collection. Especially useful:

- `pattern_for_tests.py`: synthetic patterns, color blocks, transforms and complex paths.
- `test_convert_jef.py`, `test_convert_vp3.py`, other conversion suites.
- `test_trims_dst_jef.py`: trim encodings and reader/writer options.
- `test_datapreservation.py`, `test_encoder.py`, `test_json.py`.

Use these to generate deterministic boundary cases and expected results for Welcome's port. Pin the exact Ink/Stitch and pystitch revisions together when creating the reference runner; the independently inspected HEAD revisions here are discovery pins, not a tested dependency lock.

## Complement: Ink/Stitch source fixtures

[Tests](https://github.com/inkstitch/inkstitch/tree/d59c9ab1e390285a6c67822436ffd9ba9843d8b4/tests) · commit `d59c9ab1e390285a6c67822436ffd9ba9843d8b4` · project GPL-3.0-or-later.

Small SVG/font fixtures cover lettering, split glyph files, compressed font assets, style inheritance, clones and SVG handling. Useful for editable-source and font processing tests; this is not a large machine-file library. Also use the [stitch library documentation](https://inkstitch.org/docs/stitch-library/) to enumerate stitch behaviors for our own minimal SVG reference cases.

## Secondary corpus: Embroidermodder

[Test files](https://github.com/Embroidermodder/Embroidermodder/tree/537c9ddd710b8aaab02be634951f3d8e700d5155/test) and [samples](https://github.com/Embroidermodder/Embroidermodder/tree/537c9ddd710b8aaab02be634951f3d8e700d5155/data/samples) · project zlib/libpng license.

The inspected tree includes `Star` and `Embroidermodder` exports in multiple formats, one `Star.EMB`, one JEF, DST/HUS/PES/etc., plus spiral CSVs. Its [test README](https://github.com/Embroidermodder/Embroidermodder/blob/537c9ddd710b8aaab02be634951f3d8e700d5155/test/README.md) explicitly says test designs may be invalid and limits their intended use to developers testing libembroidery. Keep these out of the known-good baseline; consider them robustness candidates after examining per-file provenance and expected failure behavior. They have not been bundled here.

The separate `Embroidermodder/libembroidery` repository at `1138e043b811f891d2bf88fce5b2e414dac92391` did not expose a comparable binary test corpus in the inspected tree. Do not confuse the library's format claims with an available fixture set.

## Automated validation plan

1. Verify pinned archive/file hashes before ingestion. Keep original bytes unchanged and record producer/version/family labels separately from decoded facts.
2. Start with the **43 JEF/VP3 files**. Decode with pinned pystitch and store commands, coordinates, thread sequence/metadata, extents and relevant header values as reference results. Apply timeouts and bounds to all parsers.
3. Compare Welcome reads to the reference. For writes, feed the same canonical pattern and settings into the pinned writer and Welcome writer. Compare exact bytes when deterministic; otherwise exclude only documented volatile fields and compare parsed semantics. Fix settings/seeds rather than hiding differences with broad tolerances.
4. Generate boundary cases from upstream tests: coordinate limits, negative offsets, color blocks, trims/jumps/stops, empty designs, long stitches and damaged input. Add source SVG cases for running/satin/fill/holes/lettering and compare against native Ink/Stitch generation.
5. Keep same-file, cross-format and editable-source fidelity as separate assertions. Different formats intentionally encode different metadata and commands; compare against reference conversion behavior rather than assuming lossless conversion.
6. Use the 15 EMB files and their sibling exports for a separate automated parser/serializer investigation. Record tested versions/features and unsupported objects. No human verification gate.

The practical recommendation is **EmbroidePy's corpus + upstream synthetic tests + small Ink/Stitch source fixtures**. This establishes software parity without requiring physical sewing or manual review.
