#!/usr/bin/env python3
"""Generate a checked-in machine-format reader digest using pinned pyembroidery.

Usage: python3 -I scripts/machine-reference.py FORMAT  (FORMAT is an extension such as hus or xxx; run inside a venv with pyembroidery==1.5.1)
Writes scripts/FORMAT-parity.json: one entry per FORMAT sample in fixtures/embroidepy/samples.zip, with the SHA-256
of the file, the command counts, the thread count and a digest of every decoded (x, y, command) in 0.1 mm.
src/readers.js must decode each sample to the same digest (test/readers.test.js).
"""
import hashlib
import json
import os
import sys
import tempfile
import zipfile
from collections import Counter
from pathlib import Path

import pyembroidery as pe

PYEMBROIDERY_VERSION = "1.5.1"
ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "fixtures/embroidepy/samples.zip"
COMMANDS = {pe.STITCH: "stitch", pe.JUMP: "jump", pe.TRIM: "trim", pe.STOP: "stop", pe.END: "end", pe.COLOR_CHANGE: "color"}


def main():
    if len(sys.argv) != 2 or not sys.argv[1].isalnum():
        sys.exit("usage: machine-reference.py FORMAT")
    fmt = sys.argv[1].lower()
    output = ROOT / f"scripts/{fmt}-parity.json"
    entries = []
    with zipfile.ZipFile(ARCHIVE) as archive, tempfile.TemporaryDirectory() as scratch:
        names = sorted(n for n in archive.namelist() if n.lower().endswith("." + fmt))
        for name in names:
            data = archive.read(name)
            path = os.path.join(scratch, "sample." + fmt)
            with open(path, "wb") as f:
                f.write(data)
            pattern = pe.read(path)
            commands = [[round(x), round(y), COMMANDS[c & 0xFF]] for x, y, c in pattern.stitches]
            counts = Counter(cmd for _, _, cmd in commands)
            blob = json.dumps(commands, separators=(",", ":")).encode()
            entries.append({
                "path": name,
                "sha256": hashlib.sha256(data).hexdigest(),
                "threads": len(pattern.threadlist),
                "commandCounts": dict(sorted(counts.items())),
                "commandsSha256": hashlib.sha256(blob).hexdigest(),
            })
    out = {
        "schema": f"welcom/{fmt}-parity/1",
        "oracle": f"pyembroidery {PYEMBROIDERY_VERSION} reader for .{fmt} (positions as pyembroidery reports them)",
        "coordinates": "integer 0.1 mm exactly as pyembroidery reports positions",
        "fixtures": entries,
    }
    output.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(entries)} {fmt.upper()} entries to {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
