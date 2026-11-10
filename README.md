# Welcome Embroidery

**[Open the editor →](https://josei.github.io/welcome-embroidery/)** — runs in your
browser, nothing to install, no account.

An open-source, userless embroidery editor that runs as a static web app, a self-hosted server, or a desktop app, and that AI agents can drive through MCP. Draw and edit vector shapes and lettering, choose how each object is stitched, preview the result (including a 3D thread view), and export machine files for Janome/Elna (JEF, SEW), Pfaff (VP3), Tajima (DST, TBF), Brother/Babylock (PEC, PES), Melco (EXP), Barudan (U01) and Singer (XXX) machines, thread colour lists (COL, EDR), SVG, DXF, and print and appliqué templates. Designs stay in your browser as local `.welcome` project files.

**Status:** a working editor with a deliberately limited stitch engine. It is not Ink/Stitch parity, not machine-certified (nothing here has been sewn on a real machine; output is validated by decoding it with the pinned pyembroidery reference), and has no EMB support.

## What it does

- **Vector editing:** infinite pan/zoom canvas with rulers and guides, selection handles (resize, rotate, oriented frames), marquee select, groups, layers tree (visibility, lock, drag to reorder), node editing on any shape (Bézier handles, multi-node), pen/line/polygon/star tools, align/distribute, flip, boolean operations, offset and stroke-to-shape, arrays (linear, radial, along a path), text on a path, smart snapping, copy/paste, context menu.
- **Tracing:** turn a logo or drawing into filled shapes (one per colour region) or into satin/running lines, from the picture-trace button; photographs can be sewn as photo stitch.
- **Everyday comforts:** autosave with restore after a reload, a 48-colour thread palette with custom colours, a thread plan and sewing-time estimate, keyboard shortcuts (press ?).
- **Server optional:** the editor is a static site. Designing, compiling, exporting JEF/VP3/DST/SVG, saving and opening projects, tracing, photo stitch, reference pictures, import and autosave all run in the browser (a browser test blocks every API call to prove it). The Node server only adds what needs a network: the agent relay and MCP endpoint, headless documents for agents, and download links for files an agent exports.
- **Languages:** the editor follows the browser/system language (English or Spanish) and can be switched from the selector in the header, or with `?lang=es` / `?lang=en`. Translations live in `src/i18n.js`.
- **Stitching:** fill (tatami) with holes, running stitch, satin columns, per-object angle, spacing, stitch length and needle stagger, planned fills (single continuous run, no long cross-shape stitches) and fill patterns (rows or concentric contours), start/end points, underlay types (edge walk, tatami, zigzag, centre run; automatic by default), pull compensation, tie-in/tie-off, trims, sewing order and colour sorting, editable hoop of any size.
- **Lettering:** 195 bundled fonts (117 converted Ink/Stitch embroidery fonts, 78 open TrueType outline fonts) with a font picker that previews your text, letter/word spacing, line height, alignment, bold, italic, multi-line, and `.ttf` files from disk. Edited directly on the canvas.
- **Files:** import machine embroidery files (JEF, VP3, DST, SEW, PEC, PES, EXP, HUS, XXX, DSB, DSZ, TAP, TBF, PCS, SHV, STX, BRO, EMD, KSM, 10O; source bytes of JEF and VP3 are kept so untouched files re-export exactly), Welcome projects, SVG (safe subset) and DXF; export JEF, VP3, DST, EXP, PEC, PES (v1 and v6), SEW, U01, XXX, TBF, COL and EDR thread lists, plain SVG, DXF, and print and appliqué templates (the export dialog's "Show every format" list).
- **Preview:** design view, stitch view with simulation, and a WebGL thread preview.
- **MCP:** a private, revocable link per browser tab lets an agent edit the open document live (`documentId: "live"`) or work on server-side documents.

## First design

1. **Draw or open a design.** Start from scratch, open a `.welcome` project, or import a machine file or SVG.
2. **Save your project.** Exporting does not save your project. Use **File → Save** (or Save As) to keep it as a `.welcome` file, and open that file later to keep editing. Autosave keeps a copy in this browser only, so save the file if you want to keep the design.
3. **Export for your machine.** Open **Export embroidery** and pick your machine brand in **Your machine**: Janome and Elna use JEF, Pfaff uses VP3, Brother and Babylock use PES (v6), Tajima uses DST, and Melco, Barudan and Singer use EXP, U01 and XXX. The picker sets the file format for you. If your machine is not listed, choose **Other / not sure**, which uses DST, the most widely supported format. To choose a format yourself, use **Show every format**.
4. **Check the sewing tips.** The editor lists sewing tips about your design. To hide a category of tips, open **Settings** and untick it under **Sewing tips to show**.

## Node version

The project is built and run with Node 22, as set in the `Dockerfile` (`node:22-alpine`). `package.json` does not declare an `engines` range. Use Node 22 with `npm ci` and `npm start`.

The project was tested on Node 22: CI runs `npm ci` and the Pages tests on Node 22 (`.github/workflows/pages.yml`).

## Run

```sh
npm ci
npm start            # builds the editor with Vite, then serves http://127.0.0.1:8787/
```

The editor is bundled by Vite into `dist/`; the stitch worker compiles in a module worker. The Node server serves `dist/`, the fonts, MCP and downloadable artifacts. The MCP endpoint needs a session link from the editor's Agent button (`/mcp/<token>`).

Self-host with Docker:

```sh
docker build -t welcome-embroidery .
docker run --rm -p 8787:8787 welcome-embroidery
```

Static build (no server features such as MCP): `npm run build` creates a self-contained `dist/`.

## Desktop app

The desktop app is a Tauri shell in `src-tauri/`. `npm run desktop:build` builds it.

## Tests

```sh
npm run test:engine   # engine, readers, fonts, relay (node:test)
CI=1 npm run test:e2e # Chromium scenarios
npm run test:mcp      # MCP smoke test against a local server
npm run test:dist     # static build served from dist/ only
```

## Licence

MIT. Bundled fonts and the vendored polygon-clipping library keep their own licences; see the [third-party notices](THIRD_PARTY_NOTICES.md).
