#!/usr/bin/env python3
"""Generate the checked-in EXP reader digest using pinned pyembroidery.

Usage: python3 -I scripts/exp-reference.py  (run inside a venv with pyembroidery==1.5.1 installed)
Writes scripts/exp-parity.json: one entry per EXP sample in fixtures/embroidepy/samples.zip, with the
SHA-256 of the file, the command counts, the colour block count and a digest of every decoded (x, y, command) in 0.1 mm.
EXP has no palette, so pyembroidery's threadlist stays empty; "threads" records colour blocks (colour commands + 1) instead.
src/readers.js must decode each sample to the same digest (test/readers.test.js).
"""
import hashlib
import json
import os
import tempfile
import zipfile
from collections import Counter
from pathlib import Path

import pyembroidery as pe

PYEMBROIDERY_VERSION = "1.5.1"
ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "fixtures/embroidepy/samples.zip"
OUTPUT = ROOT / "scripts/exp-parity.json"
COMMANDS = {pe.STITCH: "stitch", pe.JUMP: "jump", pe.TRIM: "trim", pe.STOP: "stop", pe.END: "end", pe.COLOR_CHANGE: "color"}


def main():
    entries = []
    with zipfile.ZipFile(ARCHIVE) as archive, tempfile.TemporaryDirectory() as scratch:
        names = sorted(n for n in archive.namelist() if n.lower().endswith(".exp"))
        for name in names:
            data = archive.read(name)
            path = os.path.join(scratch, "sample.exp")
            with open(path, "wb") as f:
                f.write(data)
            pattern = pe.read(path)
            commands = [[round(x), round(y), COMMANDS[c & 0xFF]] for x, y, c in pattern.stitches]
            counts = Counter(cmd for _, _, cmd in commands)
            blob = json.dumps(commands, separators=(",", ":")).encode()
            entries.append({
                "path": name,
                "sha256": hashlib.sha256(data).hexdigest(),
                "threads": counts["color"] + 1,
                "commandCounts": dict(sorted(counts.items())),
                "commandsSha256": hashlib.sha256(blob).hexdigest(),
            })
    out = {
        "schema": "welcom/exp-parity/1",
        "oracle": f"pyembroidery {PYEMBROIDERY_VERSION} ExpReader",
        "coordinates": "integer 0.1 mm exactly as pyembroidery reports positions",
        "fixtures": entries,
    }
    OUTPUT.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(entries)} EXP entries to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
