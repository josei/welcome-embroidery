#!/usr/bin/env python3
"""Compare a Welcome export's needle coordinate sequence with a pinned pystitch plan.

Usage: PYTHONPATH=/path/to/pystitch/src python3 scripts/verify-import-reference.py OUTPUT.jef EXPECTED-NEEDLES.json
The expected JSON file is an array of [x_mm, y_mm] pairs generated from the
Welcome compile plan. Run with the repository's pinned pystitch checkout.
"""
import json
import pathlib
import sys

import pystitch


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    exported = pathlib.Path(sys.argv[1])
    expected_path = pathlib.Path(sys.argv[2])
    pattern = pystitch.read(str(exported))
    if pattern is None:
        raise SystemExit(f"pystitch could not decode {exported}")
    expected = json.loads(expected_path.read_text())
    actual = [[round(x / 10, 1), round(y / 10, 1)]
              for x, y, command in pattern.stitches
              if command & 0xff == pystitch.STITCH]
    if actual != expected:
        mismatch = next((i for i, pair in enumerate(zip(actual, expected)) if pair[0] != pair[1]),
                        min(len(actual), len(expected)))
        raise SystemExit(f"needle-coordinate mismatch at {mismatch}: decoded {len(actual)}, expected {len(expected)}")
    print(f"pinned pystitch matched all {len(actual)} needle coordinates in {exported.name}")


if __name__ == "__main__":
    main()
