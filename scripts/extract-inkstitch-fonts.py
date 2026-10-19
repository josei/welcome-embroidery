#!/usr/bin/env python3
"""Convert Ink/Stitch embroidery fonts (inkstitch/embroidery-fonts) into compact Welcome glyph JSON.

usage: extract-inkstitch-fonts.py <embroidery-fonts>/src <repo>/fonts/inkstitch [commit]

Each glyph keeps three kinds of primitive in font units (y down, baseline at `baseline`):
  r  running-stitch polyline            ["r", [[x,y],...]]
  s  satin column, two rails            ["s", [[x,y],...], [[x,y],...]]
  f  fill, even-odd rings               ["f", [[[x,y],...], ...]]
Fonts licensed CC BY-NC(-SA) or CC BY-ND are skipped (non-commercial / no-derivatives terms do not fit an open editor
that transforms and re-exports the glyphs); right-to-left and vertical fonts are skipped as well.
"""
import json, math, re, sys, statistics
import xml.etree.ElementTree as ET
from pathlib import Path

SRC = Path(sys.argv[1]); OUT = Path(sys.argv[2]); COMMIT = sys.argv[3] if len(sys.argv) > 3 else "c7e3a05c3d6f5c77b881c50f257851af9a8e9cb8"
INK = "{http://www.inkscape.org/namespaces/inkscape}label"
IS = "{http://inkstitch.org/namespace}"
XL = "{http://www.w3.org/1999/xlink}href"
SKIP_LICENSE = re.compile(r"NC|ND", re.I)

def ident(m=None):
    return [1, 0, 0, 1, 0, 0]
def mul(a, b):
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]]
def parse_transform(s):
    m = ident()
    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", s or ""):
        v = [float(x) for x in re.split(r"[ ,]+", args.strip()) if x]
        if name == "matrix" and len(v) == 6: t = v
        elif name == "translate": t = [1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0]
        elif name == "scale": t = [v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0]
        elif name == "rotate":
            a = math.radians(v[0]); c, s_ = math.cos(a), math.sin(a); t = [c, s_, -s_, c, 0, 0]
            if len(v) == 3: t = mul(mul([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]])
        elif name == "skewX": t = [1, 0, math.tan(math.radians(v[0])), 1, 0, 0]
        elif name == "skewY": t = [1, math.tan(math.radians(v[0])), 0, 1, 0, 0]
        else: continue
        m = mul(m, t)
    return m
def apply(m, p):
    return [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]]

TOKEN = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)")
def arc_points(x1, y1, rx, ry, phi, fa, fs, x2, y2, step):
    if rx == 0 or ry == 0: return [[x2, y2]]
    rx, ry = abs(rx), abs(ry); ph = math.radians(phi); c, s = math.cos(ph), math.sin(ph)
    dx, dy = (x1-x2)/2, (y1-y2)/2; x1p, y1p = c*dx+s*dy, -s*dx+c*dy
    lam = x1p**2/rx**2 + y1p**2/ry**2
    if lam > 1: rx *= math.sqrt(lam); ry *= math.sqrt(lam)
    num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p; den = rx*rx*y1p*y1p + ry*ry*x1p*x1p
    co = (0 if den == 0 else math.sqrt(max(0, num/den))) * (-1 if fa == fs else 1)
    cxp, cyp = co*rx*y1p/ry, -co*ry*x1p/rx; cx, cy = c*cxp-s*cyp+(x1+x2)/2, s*cxp+c*cyp+(y1+y2)/2
    ang = lambda ux, uy, vx, vy: math.atan2(ux*vy-uy*vx, ux*vx+uy*vy)
    t1 = ang(1, 0, (x1p-cxp)/rx, (y1p-cyp)/ry); dt = ang((x1p-cxp)/rx, (y1p-cyp)/ry, (-x1p-cxp)/rx, (-y1p-cyp)/ry)
    if not fs and dt > 0: dt -= 2*math.pi
    if fs and dt < 0: dt += 2*math.pi
    n = max(2, int(abs(dt)*max(rx, ry)/step)+1)
    return [[c*rx*math.cos(t1+dt*k/n)-s*ry*math.sin(t1+dt*k/n)+cx, s*rx*math.cos(t1+dt*k/n)+c*ry*math.sin(t1+dt*k/n)+cy] for k in range(1, n+1)]
def flatten_path(d, step):
    """Return list of (points, closed) subpaths with curves sampled every ~`step` font units."""
    toks = [(m.group(1), m.group(2)) for m in TOKEN.finditer(d)]; i = 0; cmd = None; subs = []; cur = []; closed = False
    x = y = sx = sy = 0.0; lastc = None; lastq = None
    def num():
        nonlocal i
        v = float(toks[i][1]); i += 1; return v
    def bez(p0, p1, p2, p3):
        n = max(3, int((math.dist(p0, p1)+math.dist(p1, p2)+math.dist(p2, p3))/step)+1)
        return [[(1-t)**3*p0[0]+3*(1-t)**2*t*p1[0]+3*(1-t)*t*t*p2[0]+t**3*p3[0], (1-t)**3*p0[1]+3*(1-t)**2*t*p1[1]+3*(1-t)*t*t*p2[1]+t**3*p3[1]] for t in [k/n for k in range(1, n+1)]]
    while i < len(toks):
        if toks[i][0]: cmd = toks[i][0]; i += 1
        elif cmd is None: break
        rel = cmd.islower(); C = cmd.upper()
        if C == "Z":
            if cur: subs.append((cur, True))
            cur = []; x, y = sx, sy; lastc = lastq = None; continue
        if C == "M":
            nx, ny = num(), num()
            if rel: nx += x; ny += y
            if cur: subs.append((cur, False))
            x, y = sx, sy = nx, ny; cur = [[x, y]]; cmd = "l" if rel else "L"; lastc = lastq = None; continue
        if not cur: cur = [[x, y]]
        if C == "L": nx, ny = num(), num(); nx, ny = (nx+x, ny+y) if rel else (nx, ny); cur.append([nx, ny]); x, y = nx, ny; lastc = lastq = None
        elif C == "H": nx = num() + (x if rel else 0); cur.append([nx, y]); x = nx; lastc = lastq = None
        elif C == "V": ny = num() + (y if rel else 0); cur.append([x, ny]); y = ny; lastc = lastq = None
        elif C in "CS":
            if C == "C": x1, y1 = num(), num(); x1, y1 = (x1+x, y1+y) if rel else (x1, y1)
            else: x1, y1 = (2*x-lastc[0], 2*y-lastc[1]) if lastc else (x, y)
            x2, y2, nx, ny = num(), num(), num(), num()
            if rel: x2 += x; y2 += y; nx += x; ny += y
            cur += bez([x, y], [x1, y1], [x2, y2], [nx, ny]); lastc = [x2, y2]; lastq = None; x, y = nx, ny
        elif C in "QT":
            if C == "Q": qx, qy = num(), num(); qx, qy = (qx+x, qy+y) if rel else (qx, qy)
            else: qx, qy = (2*x-lastq[0], 2*y-lastq[1]) if lastq else (x, y)
            nx, ny = num(), num()
            if rel: nx += x; ny += y
            cur += bez([x, y], [x+2*(qx-x)/3, y+2*(qy-y)/3], [nx+2*(qx-nx)/3, ny+2*(qy-ny)/3], [nx, ny]); lastq = [qx, qy]; lastc = None; x, y = nx, ny
        elif C == "A":
            rx, ry, phi, fa, fs, nx, ny = num(), num(), num(), int(num()), int(num()), num(), num()
            if rel: nx += x; ny += y
            cur += arc_points(x, y, rx, ry, phi, fa, fs, nx, ny, step); x, y = nx, ny; lastc = lastq = None
        else: break
    if cur: subs.append((cur, False))
    return subs

def rdp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); idx, dm = -1, 0
    for i in range(1, len(pts)-1):
        p = pts[i]; d = abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/L if L else math.dist(p, a)
        if d > dm: dm, idx = d, i
    if dm <= tol: return [a, b]
    return rdp(pts[:idx+1], tol)[:-1] + rdp(pts[idx:], tol)
def clean(pts, tol, closed=False):
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6: out.append(p)
    if closed and len(out) > 1 and math.dist(out[0], out[-1]) < 1e-6: out.pop()
    if len(out) < 3: return out
    r = rdp(out + [out[0]], tol)[:-1] if closed else rdp(out, tol)
    return r
def rnd(pts): return [round(v, 1) for p in pts for v in p]   # flat x,y,x,y... with 0.1 font-unit precision

def style_of(el):
    st = {}
    for kv in (el.attrib.get("style") or "").split(";"):
        if ":" in kv: k, v = kv.split(":", 1); st[k.strip()] = v.strip()
    for k in ("fill", "stroke", "display", "fill-rule"):
        if k in el.attrib and k not in st: st[k] = el.attrib[k]
    return st


def plen(pts): return sum(math.dist(pts[i], pts[i-1]) for i in range(1, len(pts)))
def seg_dist(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; l2 = dx*dx+dy*dy
    u = 0 if not l2 else max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2))
    return math.hypot(p[0]-a[0]-dx*u, p[1]-a[1]-dy*u)
def touches(rung, rail, tol=.6):
    # a rung touches a rail when it crosses it or an end comes within tol of it
    for e in (rung[0], rung[-1]):
        if min(seg_dist(e, rail[i-1], rail[i]) for i in range(1, len(rail))) <= tol: return True
    def ccw(a, b, c): return (c[1]-a[1])*(b[0]-a[0]) - (b[1]-a[1])*(c[0]-a[0])
    for i in range(1, len(rung)):
        for j in range(1, len(rail)):
            a, b, c, d = rung[i-1], rung[i], rail[j-1], rail[j]
            if ccw(a, c, d)*ccw(b, c, d) < 0 and ccw(a, b, c)*ccw(a, b, d) < 0: return True
    return False
def pick_rails(paths):
    n = len(paths)
    if n == 2: return [0, 1]
    lens = [plen(p) for p in paths]
    longest = sorted(range(n), key=lambda i: -lens[i])[:2]
    if n > 14: return longest
    best, key = longest, None
    for i in range(n):
        for j in range(i+1, n):
            hits = sum(1 for k in range(n) if k not in (i, j) and touches(paths[k], paths[i]) and touches(paths[k], paths[j]))
            cand = (hits, lens[i]+lens[j])
            if key is None or cand > key: best, key = [i, j], cand
    return best

def collect(group, ids, step, tol):
    prims = []
    def walk(el, m, sym=False, root=False):
        tag = el.tag.split("}")[1]
        mm = mul(m, parse_transform(el.attrib.get("transform")))
        st = style_of(el)
        if st.get("display") == "none" and not root: return   # glyph layers themselves are usually hidden Inkscape layers
        if tag == "path" and el.attrib.get("d"):
            subs = flatten_path(el.attrib["d"], step)
            subs = [(clean([apply(mm, p) for p in s], tol, c), c) for s, c in subs]; subs = [(s, c) for s, c in subs if len(s) >= 2]
            if not subs: return
            satin = el.attrib.get(IS + "satin_column") == "True"
            fill = st.get("fill", "#000000" if "stroke" not in st else "none"); stroke = st.get("stroke", "none")
            if satin and len(subs) >= 2:
                # Rails are the pair of subpaths that the most other subpaths (rungs) cross; ties go to the longest pair. Combined Inkscape paths list rails and rungs in arbitrary order, and rungs may be longer than the rails they join.
                order = pick_rails([sub for sub, c in subs]); order.sort()
                r1, r2 = subs[order[0]][0], subs[order[1]][0]; subs = [subs[order[0]], subs[order[1]]] + [x for i, x in enumerate(subs) if i not in order]
                if math.dist(r1[0], r2[0]) + math.dist(r1[-1], r2[-1]) > math.dist(r1[0], r2[-1]) + math.dist(r1[-1], r2[0]): r2 = r2[::-1]
                rungs = [[round(v, 1) for v in (sub[0][0], sub[0][1], sub[-1][0], sub[-1][1])] for sub, c in subs[2:] if len(sub) >= 2]   # extra subpaths are rungs: they pair rail positions
                prims.append(["s", rnd(r1), rnd(r2)] + ([rungs] if rungs else []))
            elif fill not in ("none", "") and not el.attrib.get(IS + "stroke_method"):
                rings = [s if len(s) >= 3 else None for s, c in subs]; rings = [rnd(r) for r in rings if r]
                if rings: prims.append(["f", rings])
            else:
                for s, c in subs: prims.append(["r", rnd(s + ([s[0]] if c else []))])
        elif tag == "use":
            href = el.attrib.get(XL) or el.attrib.get("href") or ""; target = ids.get(href.lstrip("#"))
            if target is not None:
                t = mul(mm, [1, 0, 0, 1, float(el.attrib.get("x", 0)), float(el.attrib.get("y", 0))]); walk(target, t, True)
        elif tag in ("g", "symbol", "svg"):
            for ch in el: walk(ch, mm, sym)
    walk(group, ident(), False, True)
    return prims

def convert(fontdir, coarse=1.0):
    meta = json.loads((fontdir / "font.json").read_text(encoding="utf-8"))
    lic = meta.get("font_license", "") or ""
    if SKIP_LICENSE.search(lic) or "Mublic" in lic and False: return None, "license " + lic
    if meta.get("text_direction", "ltr") != "ltr" or meta.get("default_variant", "ltr") != "ltr": return None, "not ltr"
    kws = meta.get("keywords", [])
    if any(k in kws for k in ("arabic", "hebrew")): return None, "rtl script"
    svg = fontdir / "ltr.svg"
    if not svg.exists(): return None, "no ltr.svg"
    root = ET.parse(svg).getroot(); vb = [float(v) for v in root.attrib.get("viewBox", "0 0 100 100").split()]
    fl = lambda v, d: float(v) if isinstance(v, (int, float)) else d
    upe = fl(meta.get("units_per_em"), vb[3]); step = upe/90*coarse; tol = upe/900*coarse
    ids = {el.attrib["id"]: el for el in root.iter() if "id" in el.attrib}
    adv = meta.get("horiz_adv_x", {}); dflt = fl(meta.get("horiz_adv_x_default"), upe*.6); space = fl(meta.get("horiz_adv_x_space"), upe*.3)
    glyphs = {}; bottoms = []
    for g in root.iter():
        if g.tag.split("}")[1] != "g": continue
        lab = g.attrib.get(INK) or ""
        if not lab.startswith("GlyphLayer-"): continue
        ch = lab[len("GlyphLayer-"):]
        if len(ch) != 1: continue
        cp = ord(ch)
        scripts = {"greek": range(0x370, 0x400), "cyrillic": range(0x400, 0x500)}
        if not (0x20 <= cp <= 0xFF or cp in (0x2018, 0x2019, 0x201C, 0x201D, 0x20AC) or any(k in kws and cp in r for k, r in scripts.items())): continue
        prims = collect(g, ids, step, tol)
        if not prims and ch != " ": continue
        glyphs[ch] = {"a": round(fl(adv.get(ch), space if ch == " " else dflt), 2), "p": prims}
        if ch in "EHILTZ1" and prims:
            ys = [v for pr in prims for ring in ([pr[1]] if pr[0] == "r" else [pr[1], pr[2]] if pr[0] == "s" else pr[1]) for v in ring[1::2]]
            if ys: bottoms.append(max(ys))
    if len(glyphs) < 10: return None, f"only {len(glyphs)} glyphs"
    if " " not in glyphs: glyphs[" "] = {"a": round(space, 2), "p": []}
    baseline = round(statistics.median(bottoms), 2) if bottoms else round(vb[3], 2)
    kern = {k.replace(" ", ""): v for k, v in (meta.get("kerning_pairs") or {}).items() if isinstance(v, (int, float))}
    licfile = fontdir / "LICENSE"; text = licfile.read_text(encoding="utf-8", errors="replace").strip().replace("\r", "") if licfile.exists() else ""
    return {"id": re.sub(r"[^A-Za-z0-9_.-]", "_", fontdir.name), "name": meta.get("name", fontdir.name), "description": meta.get("description", ""), "keywords": kws, "license": lic.strip(), "licenseText": text[:600],
            "original": meta.get("original_font", ""), "originalUrl": meta.get("original_font_url", ""), "source": f"inkstitch/embroidery-fonts@{COMMIT[:7]}", "kind": "stitch",
            "unitsPerEm": upe, "baseline": baseline, "leading": fl(meta.get("leading"), upe*1.2), "size": fl(meta.get("size"), 40), "minScale": fl(meta.get("min_scale"), .5), "maxScale": fl(meta.get("max_scale"), 2),
            "letterCase": meta.get("letter_case", "") or "", "defaultAdvance": dflt, "spaceAdvance": space, "kern": kern, "glyphs": glyphs}, None

OUT.mkdir(parents=True, exist_ok=True); index = []; skipped = []
for d in sorted(p for p in SRC.iterdir() if p.is_dir()):
    font = why = None
    for coarse in (1.0, 2.5, 5.0):
        try: font, why = convert(d, coarse)
        except Exception as e: font, why = None, f"error {type(e).__name__}: {e}"
        if not font: break
        blob = json.dumps(font, ensure_ascii=False, separators=(",", ":"))
        if len(blob) <= 700_000: font["coarse"] = coarse; break
        why = f"too large ({len(blob)//1000} kB at coarse {coarse})"; font = None if coarse == 5.0 else font
        if coarse == 5.0 and len(blob) <= 1_400_000: font = convert(d, coarse)[0]; font["coarse"] = coarse; break
    if not font: skipped.append((d.name, why)); continue
    (OUT / f"{font['id']}.json").write_text(json.dumps(font, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    index.append({k: font[k] for k in ("id", "name", "description", "keywords", "license", "original", "originalUrl", "source", "kind", "size", "minScale", "maxScale", "letterCase")} | {"glyphCount": len(font["glyphs"]), "bytes": (OUT / f"{font['id']}.json").stat().st_size, "prims": sorted({pr[0] for g in font["glyphs"].values() for pr in g["p"]})})
(OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"converted {len(index)} fonts, skipped {len(skipped)}"); [print("  skip", n, w) for n, w in skipped]
print("total MB", round(sum(f["bytes"] for f in index)/1e6, 2), "largest", max(f["bytes"] for f in index))
