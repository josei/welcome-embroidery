# Welcome Embroidery

*Formerly "Welcom". The project is now called **Welcome** and lives at welcome.design.*

An open-source, userless embroidery editor that runs as a static web app, a self-hosted server, or a desktop app, and that AI agents can drive through MCP. Draw and edit vector shapes and lettering, choose how each object is stitched, preview the result (including a 3D thread view), and export machine files for Janome/Elna (JEF), Pfaff (VP3) and Tajima-compatible machines (DST). Designs stay in your browser as local `.welcome` project files.

**Status:** a working editor with a deliberately limited stitch engine. It is not Ink/Stitch parity, not machine-certified (nothing here has been sewn on a real machine; output is validated by decoding it with the pinned pyembroidery reference), and has no EMB support. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for what is verified and what is not.

## What it does

- **Vector editing:** infinite pan/zoom canvas with rulers and guides, selection handles (resize, rotate, oriented frames), marquee select, groups, layers tree (visibility, lock, drag to reorder), node editing on any shape (Bézier handles, multi-node), pen/line/polygon/star tools, align/distribute, flip, boolean operations, offset and stroke-to-shape, arrays (linear, radial, along a path), text on a path, smart snapping, copy/paste, context menu.
- **Tracing:** turn a logo or drawing into filled shapes (one per colour region) or into satin/running lines, from the picture-trace button; photographs can be sewn as photo stitch.
- **Everyday comforts:** autosave with restore after a reload, a 48-colour thread palette with custom colours, a thread plan and sewing-time estimate, keyboard shortcuts (press ?).
- **Server optional:** the editor is a static site. Designing, compiling, exporting JEF/VP3/DST/SVG, saving and opening projects, tracing, photo stitch, reference pictures, import and autosave all run in the browser (a browser test blocks every API call to prove it). The Node server only adds what needs a network: the agent relay and MCP endpoint, headless documents for agents, and download links for files an agent exports.
- **Languages:** the editor follows the browser/system language (English or Spanish) and can be switched from the selector in the header, or with `?lang=es` / `?lang=en`. Translations live in `src/i18n.js`.
- **Stitching:** fill (tatami) with holes, running stitch, satin columns, per-object angle, spacing, stitch length and needle stagger, planned fills (single continuous run, no long cross-shape stitches) and fill patterns (rows or concentric contours), start/end points, underlay types (edge walk, tatami, zigzag, centre run; automatic by default), pull compensation, tie-in/tie-off, trims, sewing order and colour sorting, editable hoop of any size.
- **Lettering:** 195 bundled fonts (117 converted Ink/Stitch embroidery fonts, 78 open TrueType outline fonts) with a font picker that previews your text, letter/word spacing, line height, alignment, bold, italic, multi-line, and `.ttf` files from disk. Edited directly on the canvas.
- **Files:** import JEF/VP3 (source bytes kept so untouched files re-export exactly), SVG (safe subset); export JEF, VP3, DST and plain SVG.
- **Preview:** design view, stitch view with simulation, and a WebGL thread preview.
- **MCP:** a private, revocable link per browser tab lets an agent edit the open document live (`documentId: "live"`) or work on server-side documents; see [docs/MCP.md](docs/MCP.md).

## Run

```sh
npm ci
npm start            # http://127.0.0.1:8787/
```

The editor compiles stitches in a module worker; the Node server supplies the static assets, fonts, MCP and downloadable artifacts. The MCP endpoint needs a session link from the editor's Agent button (`/mcp/<token>`).

Self-host with Docker:

```sh
docker build -t welcome-embroidery .
docker run --rm -p 8787:8787 welcome-embroidery
```

Static build (no server features such as MCP): `npm run build` creates a self-contained `dist/`.

## Desktop app (macOS)

The desktop app is Electron (`desktop/electron/`): it bundles Node and runs the same server inside the app, so nothing else needs installing. `npm run desktop:mac` packages arm64 and x64 `Welcome.app` bundles (works from Linux too). Bundles are unsigned and have not been launched on a Mac; see [desktop/electron/README.md](desktop/electron/README.md).

## Tests

```sh
npm run test:engine   # engine, readers, fonts, relay (node:test)
CI=1 npm run test:e2e # Chromium scenarios
npm run test:mcp      # MCP smoke test against a local server
npm run test:dist     # static build served from dist/ only
```

## Project notes

[Plan](docs/PLAN.md) · [architecture](docs/ARCHITECTURE.md) · [interface design](docs/DESIGN.md) · [MCP and relay](docs/MCP.md) · [fixtures](docs/FIXTURES.md) · [reader status](docs/READER_STATUS.md) · [third-party notices](THIRD_PARTY_NOTICES.md)

Licence: GPL-3.0-or-later. Bundled fonts, the pyembroidery-derived readers and polygon-clipping keep their own licences (see the notices).
