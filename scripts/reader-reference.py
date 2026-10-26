#!/usr/bin/env python3
"""Generate the checked-in JEF/VP3 parity digest using pinned pystitch.

Usage: PYTHONPATH=/path/to/pystitch/src python3 scripts/reader-reference.py
The default output is scripts/reader-parity.json; --output selects another path.
"""
import argparse
import hashlib
import io
import inspect
import json
import zipfile
from pathlib import Path

from pystitch import EmbPattern, JefReader, Vp3Reader
from pystitch.EmbConstant import STITCH, JUMP, TRIM, STOP, END, COLOR_CHANGE

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "fixtures/embroidepy/samples.zip"
PYSTITCH_PIN = "b72b557f2ebb1fdc51f30edc3c73ff6a851ea015"
COMMANDS = {STITCH: "stitch", JUMP: "jump", TRIM: "trim", STOP: "stop", END: "end", COLOR_CHANGE: "color"}
RAW_VP3_MOVE = Vp3Reader.vp3_read_colorblock
VP3_SOURCE = inspect.getsource(RAW_VP3_MOVE)
RAW_ORIGIN_GUARD = "    if abs_x != 0 and abs_y != 0:\n        out.move_abs(abs_x, abs_y)"
if RAW_ORIGIN_GUARD not in VP3_SOURCE:
    raise RuntimeError("pinned VP3 origin guard changed; review before updating oracle")
PATCHED_SCOPE = dict(Vp3Reader.__dict__)
exec(compile(VP3_SOURCE.replace(RAW_ORIGIN_GUARD, "    out.move_abs(abs_x, abs_y)"), "<pystitch-vp3-origin-correction>", "exec"), PATCHED_SCOPE)
PATCHED_VP3_MOVE = PATCHED_SCOPE[RAW_VP3_MOVE.__name__]

def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(ROOT / "scripts/reader-parity.json"))
    args = parser.parse_args()
    rows = []
    with zipfile.ZipFile(ARCHIVE) as archive:
        names = sorted(n for n in archive.namelist() if n.lower().endswith((".jef", ".vp3")))
        for name in names:
            data = archive.read(name)
            fmt = Path(name).suffix[1:].lower()
            reader = JefReader if fmt == "jef" else Vp3Reader
            raw_pattern = EmbPattern.read_embroidery(reader, io.BytesIO(data))
            if fmt == "vp3":
                Vp3Reader.vp3_read_colorblock = PATCHED_VP3_MOVE
                pattern = EmbPattern.read_embroidery(reader, io.BytesIO(data))
                Vp3Reader.vp3_read_colorblock = RAW_VP3_MOVE
            else:
                pattern = raw_pattern
            # Integer coordinates at 1/10000 mm avoid Python/JavaScript float spellings.
            sequence = [[round(x * 1000), round(y * 1000), COMMANDS.get(cmd & 0xff, f"cmd:{cmd & 0xff}")] for x, y, cmd in pattern.stitches]
            raw_sequence = [[round(x * 1000), round(y * 1000), COMMANDS.get(cmd & 0xff, f"cmd:{cmd & 0xff}")] for x, y, cmd in raw_pattern.stitches]
            threads = [t.hex_color() if t else None for t in pattern.threadlist]
            bounds = [round(x / 10, 4) for x in pattern.bounds()]
            rows.append({
                "path": name,
                "format": fmt,
                "sha256": hashlib.sha256(data).hexdigest(),
                "stitchCount": len(sequence),
                "commandsSha256": hashlib.sha256(canonical(sequence)).hexdigest(),
                "rawStitchCount": len(raw_sequence),
                "rawCommandsSha256": hashlib.sha256(canonical(raw_sequence)).hexdigest(),
                "originCorrectionDiffers": sequence != raw_sequence,
                "commandCounts": {cmd: sum(1 for s in sequence if s[2] == cmd) for cmd in sorted(set(s[2] for s in sequence))},
                "threads": threads,
                "bounds": bounds,
            })
    report = {
        "schema": "welcome/reader-parity/1",
        "oracle": "Ink/Stitch pystitch",
        "repository": "https://github.com/inkstitch/pystitch",
        "commit": PYSTITCH_PIN,
        "normalization": {"coordinateScale": "integer coordinates are 1/10000 mm", "jefTrimInference": "pystitch default interpolate_trims(trim_distance=3mm, clipping=true)", "vp3OriginCorrection": "unconditionally call move_abs for every color block, including zero and no-op origins; raw guard is retained per fixture"},
        "fixtures": rows,
    }
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
    print(f"wrote {len(rows)} fixture expectations to {args.output}")

if __name__ == "__main__":
    main()
