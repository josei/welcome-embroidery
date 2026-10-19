#!/usr/bin/env python3
"""Rebuild the bounded plain-running glyph subset from pinned Ink/Stitch SVG source."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

base = Path(__file__).resolve().parents[1] / "fonts" / "neon_blinking"
source = json.loads((base / "font.json").read_text())
root = ET.parse(base / "ltr.svg").getroot()
label = "{http://www.inkscape.org/namespaces/inkscape}label"
ink = "{http://inkstitch.org/namespace}"
chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?- "
glyphs = {}
for char in chars:
    group = next((el for el in root.iter() if el.tag.endswith("g") and el.attrib.get(label) == "GlyphLayer-" + char), None)
    paths = []
    if group is not None:
        for el in group.iter():
            d = el.attrib.get("d")
            if el.tag.endswith("path") and d and el.attrib.get(ink + "stroke_method") == "running_stitch":
                paths.append({
                    "d": d,
                    "stroke_method": el.attrib[ink + "stroke_method"],
                    "bean_stitch_repeats": el.attrib.get(ink + "bean_stitch_repeats"),
                    "running_stitch_length_mm": el.attrib.get(ink + "running_stitch_length_mm"),
                })
    glyphs[char] = {"advance": source["horiz_adv_x"].get(char, source["horiz_adv_x_default"]), "paths": paths}

result = {
    "name": source["name"], "sourceCommit": "c7e3a05c3d6f5c77b881c50f257851af9a8e9cb8",
    "unitsPerEm": source["units_per_em"], "nominalSizeMm": source["size"],
    "minScale": source["min_scale"], "maxScale": source["max_scale"],
    "variant": "plain-running-centerline", "glyphs": glyphs,
}
(base / "glyphs.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Wrote {len(glyphs)} glyph records and {sum(len(g['paths']) for g in glyphs.values())} source paths")
