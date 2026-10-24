# Welcome Embroidery implementation status

> **Current summary (2026-10-08).** This file began as an early-implementation log and later sections record what changed over time; where an earlier section says something is "not done" (boolean operations, text-on-path, 3D preview, satin, holes, DST, JEF STOP, desktop app, relay, fonts, a full vector-editing canvas) a later section describes it as built. Still **not** done: EMB, signed or notarized macOS builds (bundles are unsigned and untested on a Mac), any real-machine sew-out (nothing here can be verified on a physical machine), and a native app store release. Underpath travel, stitch-length variation, ripple, photo stitch (up to four threads) and two-colour blends and blend palettes (2–5 threads in order) are built. Still open: thread brand libraries, several live document slots per agent link, and a Safari device check of the worker fix. All export validation is by decoding with pinned pyembroidery.


Updated 2026-10-06. This source provides a working static editor, local MCP service, basic JEF/VP3 writers, and a narrow embroidery font/vector workflow. It is an early implementation, not a complete digitizing product, machine certification, or full Ink/Stitch parity.

## Publication checkpoint

- The supervisor verified the public refresh at the existing URL: Chromium/dist passed 9/9, all eight MCP tools passed, JEF/VP3 downloads worked offline, and there were no browser errors. Public imports retained original bytes exactly; edited exports matched pinned needle coordinates.- The reader's signed-zero and all 43 corpus parity checks now pass; reproducible results are documented in `docs/READER_STATUS.md`.
- The post-publication source fixes add geometry-based auto-fit and fail-fast worker-failure regressions. The focused Chromium cases passed 2/2. This work did not change the public snapshot or tunnel. Public screenshot: `design/progress/public-preview.png`; source playback screenshot: `design/progress/simulation-review.png`.

## Working source features

- Same-origin browser editor and module worker. Static JS, CSS, worker, font data and the audited upstream font source are served from a fixed allowlist. `npm run build` creates a complete `dist/` tree: embedded-CSS `index.html`, all `src/` modules and worker, font geometry/source/license assets, and notices. It requires no workspace-root fallback.
- Refined linen hoop/canvas inspired by `design/index2.html`; compact same-origin inline SVG icon buttons for file/edit/shape actions have accessible names, hover/focus tooltips, keyboard focus and selected states. Text remains on export, views and properties. The stitch simulator switches to the visible Stitches view when played or scrubbed, shows a grouped-thread path, current-needle marker and progress, supports pause/restart/replay, and cancels when the document changes. Canvas auto-fit uses rendered geometry, text outlines, imported source bounds, and rotation, while keeping oversized imports in view.
- MCP source links use `/?open=<uuid>` and load same-origin project artifacts after full schema validation. New makes an empty document. Machine-file export leaves the project dirty. Global shortcuts are ignored in form controls. Document mutations and history apply atomically; stale worker/playback data is cleared after edits. Worker failure is sticky: in-flight work is rejected, and later compile/import/export requests fail immediately with the reload instruction.
- Shared semantic operations for browser and MCP include path point edits. Bounded local SVG import supports `rect`, `ellipse`, `line`, `polyline` and a restricted `path` command subset (`M/L/H/V/C/Z`, relative and absolute). It rejects scripts, unsupported elements/attributes, transforms, styles and inherited group semantics. It maps the SVG `viewBox` into a centered 110 mm workspace; unsupported features fail without replacing the current project.
- Browser import accepts local JEF/VP3 files through a dedicated worker and stores the original command sequence, ordered thread table, decoded millimeter coordinates, reader warnings, source filename/size/hash, and original bytes as a `stitch_layer` in `.welcome`. The source coordinates and bounds remain unchanged in the saved layer; the default display transform centers those bounds at the editor origin. Untouched export in the source format returns the exact retained bytes, including their original machine-file offset. Edited exports use the centered editor coordinates. Stitch layers preview as colored stitches plus dashed travel moves; the inspector reports source bounds, thread count, commands, and warnings. Translate, rotate, scale through width/height, and replace all layer threads are undoable and serialized. Failed reads leave the project untouched.
- Imports are limited to 1 MiB per source, 250,000 combined machine commands, and 2 MiB combined retained source bytes. These bounds keep generated `.welcome` projects below the browser's 32 MiB open limit; an actual 250,000-command project was serialized and reopened in Chromium. MCP `document_import_embroidery` accepts only canonical inline base64 within the same per-source limit and has no path-based file access. MCP inspect/apply/import replies summarize stitch-layer counts and metadata instead of returning large embedded byte/command arrays; `document_save` retains the complete project for its same-origin browser open link.
- An unchanged sole imported layer exports its original bytes only after checking source format, default placement, thread table, decoded bounds, command stream, coordinates, and byte length against the stored source. Edited JEF is regenerated from retained stitch/jump/trim/color commands; one terminal `end` is emitted after a mixed/multi-layer design. Needle deltas over JEF's 12.7 mm command limit fail with a clear error. The VP3 writer preserves leading color-block origin moves and no-op moves, including `(0,0)` origins, and rejects intra-block travel/trim it cannot faithfully encode. Untouched sole VP3 files can pass through unchanged. Designs outside the selected hoop remain visible in preview and report bounds/hoop diagnostics; exports are rejected.
- Node self-host service defaults to loopback and serves anonymous Streamable HTTP MCP with JSON responses. Eight tools create, inspect, import, edit, compile, preview, export and save editable source. Artifacts use UUID names. `Dockerfile` builds a Node 22 self-host image. `desktop/macos/build-app.sh` produces a local `.app` wrapper on macOS; `desktop/macos/` contains its SwiftUI/WebKit source that reuses a local service or launches `node server.js` from a configured project checkout, and stops its own child process with the window. It is not a bundled Node runtime, installer, or signed macOS release; Node, npm dependencies, and a local project checkout are prerequisites.

## Stitching and file output

- Compiler supports basic scanline fills for rectangles/ellipses and running paths/text, deterministic segmentation, basic underlay and pull compensation, color blocks and hoop diagnostics. Input checks cap objects, path points, dimensions/coordinates, fill-work estimates and generated commands before expensive work.
- JEF and VP3 writers include an initial travel to the first design coordinate, bound move deltas and reject unsupported formats/hoops. A deliberate first penetration at the first target remains after the travel; repeated zero-distance needle commands elsewhere are suppressed. The starter's 212 accidental zero-distance needle steps were removed.
- Four original synthetic writer cases (separated shapes, off-center short path, starter badge and multicolor) matched pinned pystitch needle sequences and counts. A fifth regression targets a VP3 second color block whose origin and first stitch are `(0,0)`: the writer nudges each zero axis by 0.1 mm and offsets the first needle delta; pinned pystitch decodes all four expected needles. The worker's reader normalization emits each VP3 block origin as a jump, including no-op origins.
- Supervisor validation on 2026-10-06 reports all 43 JEF/VP3 corpus command arrays, coordinates, ordered thread colors and bounds matching the corrected pinned reader oracle. The VP3 oracle applies only the documented block-origin `move_abs` correction; the original raw oracle remains separate. Reader signed-zero and corpus assertions pass; see `docs/READER_STATUS.md` for the reproducible test/report.

## Font source and supported variant

- Bundled upstream Ink/Stitch `Néon blinking` source is pinned at `inkstitch/embroidery-fonts` commit `c7e3a05c3d6f5c77b881c50f257851af9a8e9cb8`, with its OFL 1.1 license and raw SVG/JSON source in `fonts/neon_blinking/`.
- `python3 scripts/extract-neon-font.py` reproducibly builds the supported uppercase A–Z, digits and limited punctuation subset. The extracted data retains authored paths, advances, scale limits, and source stitch method/bean-repeat/running-length attributes. The editor exposes an explicitly reduced **plain-running-centerline** variant: it uses source centerline geometry and advances, samples at Welcome's 2.5 mm maximum, and does not apply bean-stitch repeats or variable per-font stitch lengths. It does not claim full font or Ink/Stitch reproduction. Font size is limited to 20–60 mm (upstream 0.5–1.5 scale). Original Welcome Mono remains the default and supports 4–16 mm.

## Validation performed

- `node --test test/engine.test.js test/import-integration.test.js` — last local run passed; the supervisor's latest independent count is 7 engine and 9 import tests. Coverage includes source equality after a same-count coordinate edit, project save/reopen, hoop diagnostics for every object kind, mixed-layer continuity, VP3 block-origin-zero encoding, and maximum command bounds.
- Chromium acceptance covers icon accessibility, rotated imported-layer preview against compiled needle coordinates and saved rotation metadata, visible simulation/progress/needle marker, pause/scrub/restart/replay/edit cancellation, worker-load failure, text-baseline auto-fit, rotated imported-bounds auto-fit, and file-import/export flows. The post-publication focused cases passed 2/2.
- The supervisor reports final browser/dist acceptance 9/9 and all eight MCP tools passing. All eight synthetic JEF/VP3 writer coordinate outputs match the compiler plan; the synthetic both-axis-zero VP3 output matches all four pinned needle coordinates.
- Reader corpus evidence is documented in `docs/READER_STATUS.md`: all 43 JEF/VP3 records match the corrected oracle, including signed-zero checks.
- `npm run build` — passes and creates the complete `dist/` static asset tree.
- `npm run test:dist` — passes through an isolated server whose document root is only `dist/`: editor, worker, engine, font geometry and licenses return HTTP 200; `/server.js`, `/package.json`, `/scripts/serve-dist.mjs`, and `/mcp` return HTTP 404. Chromium acceptance tests also run against this dist-only server, and the worker compiles offline.
- `docker build -t welcome-embroidery:review .` — passed. A disposable container on port 18789 returned HTTP 200 for `/health`, `/`, and `/fonts/neon_blinking/glyphs.json`, then was stopped. The public tunnel and port 8787 were not touched.
- `node /tmp/welcom-review/writers.mjs && python3 /tmp/welcom-review/compare.py` — all eight synthetic JEF/VP3 needle-coordinate comparisons match the compiler plan.
- The supervisor's public MCP example exports decode to 3,162 identical needle stitches and bounds in MCP and offline browser output. Public UI screenshot: `design/progress/public-preview.png`; source playback screenshot: `design/progress/simulation-review.png`. Public snapshot and tunnel are supervisor-owned.

## 2026-10-20 continue digitizing

- Select a path and press "Continue digitizing" in the path panel: new clicks extend the same object instead of creating one. Clicking the first point closes it again (keeping its fill), Enter leaves it open as a run. Engine op `continue_path`; it is not in the MCP operation schema, so agents don't gain it.
- Covered by an engine test and an e2e test.

## 2026-10-20 raised satin

- Satin columns have a Raised option ("Raised satin (thick underlay)" in the satin row). It adds a centre run and a zigzag underlay under the column, even when underlay is off. Stored as `raised` on the object; not in the MCP schema.
- Covered by an engine test and an e2e test.

## 2026-10-20 redwork

- Run objects have a Redwork (out and back) style: the run goes along the path and returns over it, as in classic redwork. Stored as `runStyle: "redwork"`. Validator accepts it; not in the MCP schema.
- Covered by an engine test and an e2e test.

## 2026-10-20 buttonholes

- An open satin path can be a buttonhole: a bar tack (short zigzag across the column) is sewn at each end. Stored as `buttonhole: true`; the satin row shows the option only for open satin paths. Not in the MCP schema.
- Covered by an engine test and an e2e test. Bar tacks are a simple zigzag, not Wilcom's tuned shapes.

## 2026-10-20 motif loops

- Open or closed paths can use the Motif loops stitch type: a 0.8 mm radius loop every 4 mm along the path, sewn as one run. Spacing and size are fixed for now; there are no sidebar controls yet. Stored as `stitch: "motif"`; not in the MCP schema.
- Covered by an engine test and an e2e test.

## 2026-10-20 program split

- Program split tiling is the existing Needle stagger (2 or 4 phases) on fills. Lettering fills use the same planner, so they tile the same way. There is no separate program-split mode; an engine test checks that stagger changes the fill tiling.

## 2026-10-21 paired motif loops

- Motif loops can be paired: one loop on each side of the centre line, half the satin width away, every 4 mm. The option is "Paired loops across the width" and uses the object's Satin width (4 mm if none is set). Stored as `motifPair`; not in the MCP schema. Fills of motifs (a shape filled with loops) are still not started.
- Covered by an engine test and an e2e test.

## 2026-10-21 motif fill

- Fill pattern "Motif loops": a closed shape is covered by 0.6 mm loops on a grid, every row offset by half a spacing (4 mm by default), kept inside the shape. Stored as `fillMethod: "motif"`; not in the MCP schema. Loops on the outline can poke slightly past it, and the spacing is fixed.
- Covered by an engine test and an e2e test.

## 2026-10-21 fill pattern buttons

- The Fill pattern buttons now include Motif loops: the button group wraps instead of clipping the last button in the inspector, and the selection follows the motif fill.
- Covered by an e2e test.

## 2026-10-21 motif spacing and size

- Motif loops, paired loops and motif fills take Motif spacing (1–20 mm, default 4) and Motif size (0.4–6 mm, default 1.6) from the object, set in the panel. Stored as `motifSpacing` and `motifSize`; not in the MCP schema. Out-of-range values fail validation.
- Covered by an engine test and an e2e test.

## 2026-10-21 sequins

- Sequins is a stitch type on paths: each sequin is a centre stitch with a fixing loop, every 8 mm by default with a 3 mm loop. The spacing and loop size controls apply (labels now read Spacing and Loop size). Stored as `stitch: "sequin"`; not in the MCP schema. No twin-sequin or dispensing control yet.
- Covered by an engine test and an e2e test.

## 2026-10-21 beads

- Beads is a stitch type on paths: one short pass across the path at each point (it was three identical passes until 2026-10-24, see the beads entry at the end), every 6 mm by default with a 2 mm length. The spacing and size controls apply (the size control now reads Size). Stored as `stitch: "bead"`; not in the MCP schema. Bling stays not started.
- Covered by an engine test and an e2e test.

## 2026-10-21 bling

- Bling is a stitch type on paths: each stone is a centre stitch with two concentric fixing rings, every 8 mm by default with a 4 mm size. The spacing and size controls apply. Stored as `stitch: "bling"`; not in the MCP schema. There are no stone shapes, bling settings or stone library.
- Covered by an engine test and an e2e test.

## 2026-10-21 batch plan

- The Array section shows a batch plan for the current design: its size, how many copies fit one hoop with a 3 mm gap, and how many hoops the Copies count needs. It is a summary only; copies are not split into one file per hoop yet.
- Covered by an engine test and an e2e test.

## 2026-10-21 batch export

- Export batch (JEF) in the Array section writes one JEF file per hoop: copies are laid out on the batch grid (3 mm gap) and split across hoops, and each hoop is compiled and downloaded as `<name>-hoopN.jef`. Only JEF for now, and imported machine files are not supported in a batch. Not in the MCP schema.
- Covered by an engine test and an e2e test. The planner summary now also reports the grid origin.

## 2026-10-21 EXP export

- EXP (Melco) export: signed byte pairs in 0.1 mm, jumps as 80 04, colour changes as 80 01, trims as 80 80 07 00, no header. Long moves are split into 12.7 mm chunks. Exports are checked by decoding them with pyembroidery (installed locally in a venv): every planned needle and jump position appears in order in the decoded path. Import is not supported. EXP is not in the MCP schema.
- Covered by an engine round-trip test and an e2e test. The pyembroidery check is a manual step, not part of the test suite.

## 2026-10-21 PEC export

- PEC (Brother) export: `#PEC0001`, a 512-byte header with the colour blocks as Brother chart indices (the chart is the 64-colour PEC thread chart, matched to the nearest colour), a stitch block in 0.1 mm with short and long values and jump and trim flags, and blank 48 x 38 icons. Long moves are split to 2047 units. Exports are checked by decoding with pyembroidery: every planned position appears in order in the decoded path and the thread count matches. Import and PES are not supported. PEC is not in the MCP schema.
- Covered by an engine structure test and an e2e test. The pyembroidery check is a manual step.

## 2026-10-21 PES export

- PES version 1 export: `#PES0001`, the PEC block offset, the version 1 header, the CEmbOne and CSewSeg blocks (one section per jump or stitch run, with colour log), then the PEC block used by PEC export. Exports are checked by decoding with pyembroidery: every planned position appears in order in the decoded path and the thread count matches. Version 6, import and the thread-name metadata are not supported. PES is not in the MCP schema.
- Covered by an engine structure test and an e2e test. The pyembroidery check is a manual step.

## 2026-10-21 motif warp along a taper

- Paired motif loops follow the satin width at each point, so a column that tapers (End width, or width stops from the editor) spreads its loops to match. The End width field now shows for paired motif paths. This is a width warp, not a surface warp. Not in the MCP schema.
- Covered by an engine test and an e2e test.

## 2026-10-21 PES version 6 export

- PES version 6 export (`#PES0060`): the v6 header with the design colours as the thread table (no catalog names, descriptions or brands), the same sew segments and colour log plus the v6 node records, the PEC block, and the colour addendum. Exports are checked by decoding with pyembroidery: every planned position appears in order in the decoded path and the thread count matches. Machine acceptance is not verified; the thread table is minimal. Not in the MCP schema. The download uses the .pes extension.
- Covered by an engine structure test and an e2e test. The pyembroidery check is a manual step.

## 2026-10-21 leaf motif loops

- Motif loops and paired loops have a Loop shape: Circle (default) or Leaf. A leaf loop is an ellipse about 1.6 times longer along the path than across it, so it turns with the curve. Stored as `motifShape`; not in the MCP schema. This is a decision: the surface-style warp is realised as oriented loops, not a 3D surface.
- Covered by an engine test and an e2e test.

## 2026-10-23 bling stone shapes

- Bling stones have a Stone shape: Round (default, the existing two circular fixing rings) or Square (the same centre stitch and a square outer ring of the stone width, with an inner square at two thirds of that width). Stored as `blingShape`; the sidebar shows the select only for bling objects, and MCP `set_object` accepts `blingShape`. Unknown shapes are rejected by the engine. Size and spacing still come from the bling settings.
- This is a basic pair of shapes, not a stone library: no baguette, teardrop or faceted settings, and no per-stone rotation along the path.
- Covered by an engine test (round default, square geometry differs, unknown shape rejected) and an e2e test (sidebar row, switching the shape changes the stitch count).

## 2026-10-23 SEW export (Janome native)

- SEW export: a 2-byte colour count and 2-byte indices into pyembroidery's 79-entry Janome thread set (each colour block matched to the nearest entry), zeros up to offset 0x1D78, then the EXP-style stitch stream in 0.1 mm: signed byte pairs with y negated, jumps as 80 04, colour changes as 80 01, end as 80 00. Long moves are split into 12.7 mm records. Trims are not written, because the SEW reader has no trim record; the next jump is the only sign of a cut. Export only. SEW is in the export dialog and MCP `embroidery_export`.
- No pyembroidery SEW writer exists to port: the layout is taken from its `SewReader.py`, and the export is checked by decoding it with pyembroidery (`PYEMBROIDERY_PYTHON=… node scripts/verify-sew.mjs`): every planned point appears in order, and the colour blocks and thread count agree. Not verified: that a Janome machine accepts these files. The header carries only the colour table (no design name, size or hoop data), and the thread indices are list positions in the reader's table, not checked against a machine.
- Covered by an engine test (colour header, zero padding to 0x1D78, stream decodes back to the planned points), an e2e test (downloads as `.sew`) and the MCP smoke test. `ONLY=name,…` in `scripts/feature-shots.mjs` re-shoots just the named features; `export-sew` is the new one.

## 2026-10-21 desktop local server

- The Tauri app starts `node server.js` from its bundled `welcome/` folder on a free 127.0.0.1 port, sets DATA_DIR to the app data folder, and opens the window at that address, so the local MCP and agent links work in the desktop app. If Node is missing or the server does not start within 15 s, it opens the bundled static editor instead. The server exits when the app's stdin pipe closes, so killing the app does not leave it running (checked on Linux). `npm run desktop:prepare` stages the server with production dependencies only; the Node runtime is still the system one (decision for now; bundling Node per platform is the next step). CI builds for macOS and Windows have not run yet.
- Covered by a manual Linux launch test (window and local server), not by the automated suites.

## 2026-10-21 bundled Node runtime

- The desktop bundle includes the Node runtime that ran the build (`npm run desktop:prepare` copies it to `runtime/`, with a NODE-NOTICE.txt). The app prefers that runtime and falls back to a system `node`. Decision: the runtime comes from the build machine, so each CI platform bundles its own Node (about 125 MB; the bundle is large). Verified on Linux with no Node on the PATH: the server started and the window opened.
- Not automated; the desktop bundles are built by CI (`desktop.yml`) on a tag or a manual run. The manual run on `036109f` passed on Linux, macOS and Windows (run 40035382088); the first manual run had failed on Windows (`spawnSync npm ENOENT`), fixed in `036109f`.

## 2026-10-21 edge closing for clipped runs

- A clipped run can close its cut ends: with Close edges at the mask on, each place a mask cuts the run gets a short back-stitch over its last segment. This is opt-in (`edgeClose`, off by default), so existing output does not change. Decision: closing is a back-stitch, not a border of extra stitches; it covers clipped satin as well as runs. Needs a sew-out check before it is turned on by default.
- Covered by an engine test and an e2e test.

## 2026-10-21 editor palette tokens

- styles.css has a `:root` token block (teal, teal-deep, teal-soft, coral, coral-soft, gold, gold-soft, gold-deep, warn, warn-soft, warn-line) and the repeated hex values now use it. Teal is the action colour; #1c725d (the export button) is merged into --teal, the one visible change (a barely different green). Warning text and the issues button use the separate warn tokens; their values are unchanged.
- Coral and gold are defined but not applied to the editor chrome: the editor is a tool, so the landing page carries the brand accents. Gold is decorative only and must use --gold-deep for text or thin strokes.
- Screenshot check: the editor and 3D preview differ from before by 296 pixels (status text and the language button outline). The landing images site/assets/hero-editor.png and view-3d.png were retaken from the default design after the change.

## 2026-10-22 compile and encode baseline

- `npm run bench:compile` times compile and JEF encode for 100 filled squares. Measured: 26k stitches compiles in 126 ms and encodes in 10 ms; 146k stitches compiles in 206 ms and encodes in 33 ms (heap 45 MiB). These are Node numbers; browser timings are still to measure.

## 2026-10-22 compile and encode baseline

- `npm run bench:compile` times compile and JEF encode for 100 filled squares. Measured: 26k stitches compile in 126 ms and encode in 10 ms; 146k stitches compile in 206 ms and encode in 33 ms (heap 45 MiB). These are Node numbers; browser timings are still to measure.

## 2026-10-22 feature screenshots

- `node scripts/feature-shots.mjs [url]` writes one screenshot per feature to design/progress/features/ (sequins, beads, bling, motif loops as leaves, paired motif taper, motif fill, redwork, buttonhole, raised satin, batch plan, PES v6 export). The heartbeat adds a case for every new feature and commits its PNG.
- Decision: screenshots show the editor state after the feature is set, not a stitch preview; loops and stitches are visible in the Stitches view.

## Known limits

- The compiler is original JavaScript, not extracted/pinned Ink/Stitch digitizing code. Tie-in/tie-off and trim are simple defaults with no machine-specific trim rules, and pull compensation is a single widening rather than a per-machine model.
- SVG support is intentionally restricted as above; it is not full SVG. JEF/VP3 imports are bounded, combined retained source files are limited to 2 MiB, JEF regenerated stitch deltas are limited to 12.7 mm, and edited VP3 export is limited where its commands cannot be preserved.
- `.welcome` is JSON, not a ZIP project package. There is no cloud database, user auth, or job queue. The MCP `live` document reaches the open browser tab through the per-tab relay, and it is only available while that tab is open.
- Docker image was built and smoke-checked locally but has no published registry image. The macOS app is the Electron build in `desktop/electron/`; its bundles are unsigned and not notarized, and were not run on a Mac. `design/index2.html` is a visual direction, not a pixel-match claim.
- EMB remains unsupported. Release completeness and public deployment remain supervisor-owned.
- Still open: closing edge stitches on clipped satin and run objects, thread brand libraries (the palette is generic), several live document slots per agent link (one browser tab per link), and a Safari device check of the worker fix (the WebKit engine suite passes, see the WebKit engine pass section). Touch pan and pinch are verified only in Chromium device emulation.

## 2026-10-06 vector-editing baseline (Claude takeover)

The original supervisor and both Luna workers hit their account usage limit (resets Oct 10); a Claude session took over the work directly.

- One top bar: Design/Stitches/Preview, undo/redo, duplicate and delete live in the header; the second bar is gone.
- Paths: point-to-point polygons (click the first point to close, Enter finishes, Esc cancels, Backspace removes the last point), closed/open and smooth (Catmull-Rom spline through nodes) flags, fill for closed paths, optional border with its own thread, node insert (double-click a segment or the add-node button) and delete (Delete key / button), node drag.
- Snap to a 0.5/1/2/5 mm grid for drawing, node drag and object drag.
- Multi-select (Shift-click on canvas or object list), group drag, align (left/center/right/top/middle/bottom, to selection or to the hoop when one object is selected) and distribute (3+ objects).
- Preview view renders stitches as thread with shadow, body and sheen layers (SVG, not WebGL). A true 3D/WebGL thread renderer is not built.
- Shared engine ops (also exposed over MCP `document_apply`): `set_path`, `insert_path_point`, `delete_path_point`, `align`, `distribute`; `add_path` accepts `closed/smooth/border`; `set_object` accepts `border/borderThread`.
- Follow-up in the same session: Bézier nodes (`set_path_node_type`, `set_path_handle`; smooth/corner buttons, draggable handles, Alt-drag breaks symmetry) and groups (`group`/`ungroup`, Ctrl+G / Ctrl+Shift+G, group-aware selection and drag).
- Sidebar tools: Select (V), Line (L), Polygon (G) and Star (S) draw by dragging from the center/start with a sides/points count, Pen (P) places corner nodes and drags out Bézier handles, Path (N) is point-to-point, Rectangle (R), Ellipse (O) and Text (T) add defaults. Esc returns to Select. `add_path` accepts `handles`.
- Editable hoop: any width × height from 10 to 400 mm (sidebar fields, no presets at first (presets were added on 2026-10-24, see the hoop size presets entry), last size remembered in browser storage for new documents, undoable; MCP `document_create` `hoop`/`hoopHeight` and `set_hoop`). The canvas, overflow diagnostics, align-to-hoop and viewBox follow it. Neither format limits the hoop: the JEF header is written like pinned pystitch/pyembroidery (the Ink/Stitch reference), where the hoop code comes from the design's size (<50×50 mm → 1, <126×110 → 3, <140×200 → 2, <200×200 → 4, else 0; codes 0=110×110, 1=50×50, 2=140×200, 3=126×110, 4=200×200) and the four hoop-edge distance sets are copied from it. `scripts/verify-jef-header.mjs` checks header bytes 24–115 against pystitch's `write_jef` for six design sizes. The selected hoop is only used for Welcome's own overflow check. `hoopH` is optional in `.welcome`; omitted means square.
- JEF export of a design ≥ 200 mm in either direction succeeds but returns a warning (browser toast, MCP `warnings`); hoop code 0 and −1 edge distances are what the reference writes there.
- JEF has no official public spec; pyembroidery's `JefWriter.py`/`JefReader.py` (MIT, pinned in `LICENSE-THIRD-PARTY-pystitch.txt`) is the working reference. Sample files with suffixes -ew/-me/-janome/-premier were written by other software and carry other hoop codes (0, 3, 6, 14, 37); the reader ignores the field.
- Not done: boolean path ops, text-on-path, true 3D/WebGL preview, EMB, packaged macOS app.
- Checks: 25 node tests, 16 Chromium scenarios, `npm run test:mcp`; public MCP run `scripts/create-vector-example.mjs` exported JEF/VP3 that pinned pystitch decodes.

## 2026-10-06 session-token MCP relay

- Anonymous `/mcp` is disabled by default (`WELCOME_ANONYMOUS_MCP=1` re-enables it for tests). Each browser tab can mint a private, revocable MCP link (`/mcp/<token>`) from the Agent dialog; agents edit the open document with `documentId: "live"` through a long-poll relay. Design and rationale in [MCP.md](MCP.md). `server-relay.js`, `src/agent.js`, `test/relay.test.js` and an Agent-relay Chromium scenario cover it (27 node tests, 17 Chromium scenarios).
- Limits: sessions are in memory (restart ends them), `document_import_embroidery` is not supported on live documents, tabs must stay open, no TLS built in.

## 2026-10-06 digitizing and relay follow-ups

- Satin columns: `stitch: "satin"` on a path (open or closed, straight or smooth) with `satinWidth` 0.5–12 mm. Needles alternate between the rails every `spacing` mm, pull compensation widens the column, underlay is a center run, and the top runs from the end back so the underlay finishes next to the first crossing. Needle spans are not split at the usual 2.5 mm. Decoded by pinned pystitch (210 needles for a 60 mm curve). Not done: separate rails/rungs, corner handling for very sharp turns, satin on text.
- Holes: closed paths carry `holes`; the even-odd fill skips them. `subtract` cuts the top shape out of the one below (the toolbar button needs exactly two selected). Cutters should lie inside the target. Not done: union/intersect, holes for lettering.
- Ties: `settings.ties` adds four 0.4 mm lock stitches at the start and end of every stitched block. Off by default; no machine-specific trim policy.
- Live relay: `document_import_embroidery` now works on `documentId: "live"` (the browser adds the layer; undo works).
- Verified: Docker image rebuilt and its `/health` and `/api/session` answered; 28 node tests and 19 Chromium scenarios pass.
- Still not done: true 3D/WebGL preview, text-on-path, union/intersect, EMB, notarized macOS app (Swift is not installed here), JEF STOP in the editor, persistent relay sessions.

## 2026-10-07 heartbeat: WebGL preview and persistent links

- Preview view now renders with WebGL2 (`src/preview3d.js`): every needle-to-needle segment is an instanced ribbon lit as a twisted cylinder with Kajiya-Kay sheen, stacked by sewing order, with soft thread shadows on a procedural woven fabric. Drag orbits, wheel zooms, double-click resets; Design and Stitches views are unchanged. Without WebGL2 the earlier shaded-SVG preview is used. Rendering is a visual approximation of thread, not a physical simulation, and stitches are not height-mapped by density.
- Relay links and revocations survive a server restart (hashes only, `var/sessions.json`); see MCP.md.
- 30 node tests and 20 Chromium scenarios pass.
- Still not done: text-on-path, union/intersect, EMB, signed macOS app, JEF STOP in the editor, jump-free travel across holes.

## 2026-10-07 heartbeat: fill routing

- Fill rows now alternate direction per row with a row's pieces visited in matching order, so the needle leaves each piece at the edge nearest the next one. Travel between pieces that lie on the same outline (typically across a hole, or along the outer edge) is stitched along that outline when the detour is ≤ 10 mm, with no jump; longer detours (large holes) remain jumps because edge stitching would clutter the fill. No automatic trimming is emitted for those jumps.

## 2026-10-07 everything-pending pass

- **Trims:** `settings.trims` cuts the thread (JEF/DST trim, VP3 trim on jump) before any jump of ≥ 5 mm after sewing. Off by default; the editor has a "Trim long jumps" checkbox. pystitch decodes the trims in JEF, VP3 and DST.
- **JEF STOP:** editor validation accepts `stop`; the JEF writer emits it like pyembroidery (80 01 with its own thread slot whose palette entry is 0, toggled back on the next STOP); the reader keeps thread indexes contiguous after dropping the STOP slot. Round trip tested with a synthetic STOP. VP3 still refuses edited STOP/trim inside imported blocks.
- **Booleans:** union, intersect, subtract and xor of two or more closed shapes (rectangle, ellipse, closed path with holes), via vendored polygon-clipping 0.15.7 (MIT, `src/vendor/`, license and notice added). Results replace the operands; the first piece keeps the first operand's id; disjoint pieces become extra paths. Rotation and smoothing are baked into the result. Limits: result outer ring ≤ 1,000 points, ≤ 20 holes of ≤ 200 points each. Toolbar: union, intersect, subtract (lowest shape minus the rest). MCP `boolean`; the earlier `subtract` op is now a wrapper.
- **Text on path:** `text_on_path` snapshots an open or closed path and maps the glyphs onto it (arc length along the text, height along the path's upward normal), with `set_along_offset` and `text_off_path`. Works with both bundled fonts. The path is copied, so editing it later does not move the text until it is attached again; moving or duplicating the text carries the snapshot.
- **DST export:** Tajima DST writer ported from pyembroidery's record encoding (512-byte header, ternary records, split jumps, trims as small jumps, colour change 0xC3, end 0xF3). `scripts/verify-dst.mjs` confirms pinned pystitch decodes the same needle positions, colour changes and trims as the matching JEF. Available in the export dialog and MCP `embroidery_export`. DST carries no hoop or thread colours; whether a given Elna or Pfaff accepts it is a question for the machine's manual.
- **EMB:** still unsupported. pystitch has no EMB reader or writer and no open specification was found, so there is nothing to validate an implementation against; DST/JEF/VP3 are the supported exports. Also still missing: a signed macOS build (Swift is not installed here).
- 36 node tests, 22 Chromium scenarios, MCP smoke (including the new ops and all three formats) and dist checks pass.

## 2026-10-07 desktop app: Electron

- The macOS app is now Electron (`desktop/electron/`, see its README): the bundled Node runs `server.js` in-process on a free loopback port and the window loads it, so no Node install or native compilation is needed. `npm run desktop:mac` packages arm64 and x64 `Welcome.app` bundles (works from Linux). The Swift shell in `desktop/macos` is superseded.
- Server gained `WELCOME_DATA_DIR` (artifacts and relay sessions) so the app writes to the user's profile instead of the bundle. A first version of that change introduced a use-before-define bug that only showed when the packaged app failed to start; fixed and covered by `test/relay.test.js`.
- Verified: Linux build under Xvfb starts, serves the editor and mints an agent link; macOS bundles are real Mach-O arm64/x86_64. Not verified on macOS; unsigned and not notarized (needs macOS and an Apple Developer ID).

## 2026-10-07 Inkscape-style editing for embroidery

What Inkscape does well that is worth having when the output is a stitch plan, added to the shared engine (UI and MCP):

- **Offset / inset** of closed shapes (holes included) and **stroke to shape** (a path becomes a filled band of a given width): buffers built from per-segment quads plus vertex circles, unioned with polygon-clipping. Straight edges are exact; corners are rounded. Limit 500 segments per outline.
- **Arrays**: linear, radial (around a point, full circle or an arc) and along a path with the copies turned to follow it. Radial copies rotate rigidly about the pivot. Copies include the original; 2–60 per array.
- **Node tools**: reverse, simplify (Douglas–Peucker), split at a node (a closed path opens there) and join open paths end to end, plus the earlier smooth/corner nodes and Bézier handles.
- **Sewing order**: reorder (back, earlier, later, front) and sort by colour, which groups objects by thread to minimise colour changes. Object order is stitch order.
- **Per-object fill angle and row spacing**, overriding the document defaults; clearing returns to defaults.
- **Interchange**: SVG export of the design in millimetres (fills keep holes, satin is a thick stroke), in the export dialog and as MCP `document_export_svg`. This is a design file, not a stitch plan; the editor's own SVG import stays the strict subset.
- **Selection and snapping**: Ctrl+A, select same thread, and snapping to other objects' nodes (within 1.5 mm) in addition to the grid.
- Inkscape features that did not seem worth it for embroidery or are not built: bitmap tracing, gradients and filters, live linked clones and general path effects, guides and rulers, skew and a transform matrix dialog, layers beyond groups.
- 42 node tests, 23 Chromium scenarios and the MCP smoke test cover these.

## 2026-10-08 fonts

- **195 bundled fonts**: 117 converted Ink/Stitch fonts (satin columns from rails, fills with holes, running stitch, cross stitch; `scripts/extract-inkstitch-fonts.py`, licences kept per font, NC/ND and right-to-left fonts excluded) and 78 open TrueType outline fonts (`scripts/extract-ttf-fonts.mjs`, filled with tatami or sewn as an outline). Fonts load on demand (`/fonts/<group>/<id>.json`, gzip when the client accepts it); the engine, worker and server share one registry (`src/fonts.js`).
- **Fonts from your own files**: any TrueType `.ttf` (glyf outlines; CFF `.otf`, WOFF and collections are rejected with a message) can be loaded in the picker; its Basic Latin/Latin-1 glyphs are stored in the project (`customFonts`, ≤ 16 fonts of ≤ 400 glyphs; raised from 8 on 2026-10-24, see that entry), so the file is not needed again. Check the font's licence before sharing designs.
- **Font picker**: searchable list, category chips, every row previews the text being edited in that font, keyboard navigation, licence per font. Text options for registry fonts: letter spacing, word spacing, line height, left/centre/right alignment, multiple lines (6), bold (fills grow, satin columns widen), italic (shear), outline-or-fill for TrueType, kerning from font data when present. Also in MCP (`font_list`, `add_text`, `set_object`).
- Limits: the two older fonts (Welcome Mono, Néon centerline) keep their single-line behaviour and do not take the new options; Ink/Stitch auto-satin outlines are sewn as fills; multicolour fonts are sewn in the object's single thread; no underlay settings from the sources (Welcome's own centre-run underlay is used); GPOS kerning and ligatures are not read from TrueType files; no bold or italic cuts beyond the synthetic ones (some families ship separate Bold/Italic files as their own entries).

- 2026-10-08 (heartbeat): satin glyphs now use the Ink/Stitch rungs. The two longest subpaths of a satin path are the rails (Inkscape orders combined subpaths arbitrarily) and the rest are rungs; between rungs the rails advance in proportion, which removed the twisting in letters like "W". 36.7 MB of font data after the re-conversion.

## 2026-10-08 editing canvas rework (vector-editor behaviour)

Based on direct feedback that editing felt far from a vector program:

- **Infinite pan/zoom canvas** (`src/canvas.js`): wheel or pinch zooms at the cursor, trackpad scroll pans, space-drag or middle-drag pans, a hand tool in the zoom bar for one-finger or mouse drag pans, two-finger touch pinch-zooms and pans, zoom bar with percentage, Hoop/All fit buttons, Shift+1 fit all, Shift+2 zoom to selection, Shift+0 100%, +/- keys. The view never changes on its own: moving an object outside the hoop no longer zooms the view out. Opening a project fits its real geometry once.
- **Selection handles**: eight resize handles and a rotation handle with live preview and a size read-out. Shift keeps proportions (Shift on corner handles, edge handles scale one axis), Alt scales from the centre, Shift while rotating snaps to 15°. Multi-selection and groups scale and rotate as one. Engine ops `scale`, `rotate` (about any pivot), `flip`, `translate`; a rotated rectangle or ellipse is converted to a path when scaled non-uniformly so the result is exact.
- **Marquee selection**, Shift-click to add or remove, click empty canvas to deselect, Ctrl+A, arrow-key nudging (1 mm, Shift 5 mm, Alt 0.1 mm, grid size with snapping), copy, cut, paste, duplicate.
- **Vertex editing on any shape**: Enter or double-click (or the Edit nodes button) enters node editing; rectangles and ellipses are converted to paths (ellipses as four Bézier nodes), lettering is converted to outlines (`to_path`, Ctrl+Shift+C). Nodes and handles keep a constant screen size at any zoom; arrow keys nudge the selected node.
- **Geometric hit testing** (strokes, fills, lettering boxes) instead of relying on thin SVG strokes; locked and hidden objects are not pickable.
- **Element tree**: groups are collapsible parents, per-row visibility and lock toggles, double-click to rename, drag to reorder in sewing order, group-level toggles.
- **Context menu** (right-click): edit nodes, convert to path, cut/copy/paste/duplicate/delete, group/ungroup, sewing order, lock/hide, zoom to selection.
- **Context-sensitive sidebar**: lettering controls only for lettering, path tools only for shapes and paths, stitch controls adapt to the selection, document settings are in a collapsible section, multi-selection shows "N objects selected".
- **Compiling**: runs automatically (debounced) after every change, keeps the previous result faded until the new one arrives, shows the error persistently in the status bar, and lists problems such as objects outside the hoop as a clickable issue count. A 2,200-sequence random-edit fuzz run against the engine found no internal crashes.
- Keyboard-accessible selection handles: Tab reaches each resize and rotate handle; arrow keys resize by 1 mm (Shift for 10 mm) and rotate by 1° (Shift for 15°), using the same commit path as dragging.

- Follow-up (same day): **rulers and guides** (mm rulers that adapt to the zoom; drag from a ruler to create a guide, drag a guide to move it, drag it back onto the ruler to delete it; guides are saved in the project and undoable; `add_guide`/`move_guide`/`remove_guide` over MCP), **smart snapping** to guides, the hoop centre and edges and other objects' edges and centres with pink guide lines while dragging or resizing (hold Ctrl to bypass), **oriented selection frames** for a single rotated rectangle, ellipse or imported stitch layer (handles follow the object's own axes), **box-select, shift-click, drag, nudge and delete several nodes at once** (`move_path_points`, `delete_path_points`), and **editing lettering on the canvas** (double-click or Enter opens a text box over the object, outlines update while typing, Enter commits as one undo step, Esc cancels). Smart snapping needs no setting; the Snap button still controls grid and node snapping.

## 2026-10-08 rename: Welcom → Welcome (welcome.design)

- All user-visible names, docs, the MCP server name (`welcome-embroidery`), Docker/npm package names, the desktop app (`Welcome.app`, bundle id `design.welcome.app`) and the saved-project extension (`.welcome`) are renamed. Environment variables are now `WELCOME_*` (`WELCOME_PORT`, `WELCOME_DATA_DIR`, `WELCOME_SESSION_FILE`, `WELCOME_ANONYMOUS_MCP`); the old `WELCOM_*` names are still read. The agent API header is `x-welcome-client`; browser storage keys are `welcome.*` (the remembered hoop size migrates from the old key).
- Kept for compatibility and not renamed: the project format id `welcom/1` inside saved files and fixtures, the font id `welcom-mono/1`, and the `/tmp/welcom-*` scratch paths used by verification scripts. Files saved as `.welcom` still open (the editor and the artifact route accept both extensions); new saves use `.welcome`. The repository directory is still `~/Code/welcom`.
- The superseded Swift shell in `desktop/macos` was left untouched.
- Note: the desktop app's data folder changes with its name, so settings stored by an earlier Welcom build are not carried over.

## Stitch quality and languages (2026-10-09)
- Auto-fill is planned by `src/stitchplan.js`: rows are chained into one run per region, long gaps are split to the stitch length, row ends are staggered (`stagger` 1/2/4/8 phases) and links stay inside the shape. Per-object keys: `stitchLength`, `stagger`, `underlayType` (fills: auto, none, contour, fill, contour+fill; satin: auto, none, center, contour, zigzag and combinations), `underlayInset`, `underlaySpacing`; the same keys exist as document defaults via `set_settings`. Covered by engine tests, the Chromium suite and `test:mcp`.
- Known limits: small fans in some Ink/Stitch satin glyphs, extra jumps in underlay of shapes with holes, no start/end point options (added later, see Start / end points), still no real-machine sew-out.
- Interface languages: English and Spanish (`src/i18n.js`). The language is auto-detected from the browser (`navigator.languages`), overridable from the header selector (stored in `localStorage`) or `?lang=`. Other locales fall back to English. Strings are translated by exact match (placeholders for numbers); engine error messages and the MCP tool descriptions stay in English. Sewing tips are translated through their message templates.

## Known-limits pass (2026-10-09)
- **Fresh page never compiled:** automatic compile only started after the first edit, so a newly opened editor (including the public snapshot) stayed on "Compiling…" and the stitch/3D views had nothing to show. The editor now schedules the first compile at start-up; an e2e test loads a fresh page, waits for "stitches · compiled" and checks the 3D canvas is drawn.
- **Satin glyph fans:** the Ink/Stitch font extractor picked rails as the two longest subpaths, which swapped rails and rungs in glyphs whose rungs are longer than the rails (R's foot, G, A crossbars). It now picks the pair of subpaths the most rungs cross (`scripts/extract-inkstitch-fonts.py`, all 118 font files regenerated). The satin pairing in `satinFromRails` places a rung where it crosses each rail (not the nearest rail point to its end) and chooses positions with a small dynamic programme that must advance along the rail, so rungs no longer collapse many needles onto one point. Satin columns with a collapsed run of 8+ needle pairs dropped from thousands to 198 of 56,908 (genuine teardrop tapers); stitches over 7 mm across all bundled fonts dropped from 473 to 193.
- **Donut underlay:** closed contour underlay rings now start at the point nearest the needle; a ring with a hole sews with one jump and nothing inside the hole (regression test).
- **Start / end points:** per-object `startAt` / `endAt` (fractions of the object's bounding box, so they follow the object) for fills and satin columns; set from the sidebar (click the canvas) or `set_object` over MCP. Fills plan from the start point and, with an end point, from the end point reversed, keeping the better plan; satin columns choose their sewing direction and run open underlay there and back so the top starts at the start end.
- **Fill pattern:** `fillMethod: "contour"` sews concentric rings (Ink/Stitch contour fill) instead of tatami rows.
- The sides / star points field only appears with the polygon and star tools.
- Not done: guided/meander/spiral fills, real-machine sew-outs (not possible from this environment), EMB, signed macOS builds.

## Fill patterns and perspective preview (2026-10-09, later)
- `fillMethod` now also offers `spiral` (nested rings blended into one continuous spiral per family of rings), `meander` (a random spanning tree over a cell grid walked all the way round, one winding line; deterministic) and `guided` (rows follow a guide polyline: the shape is straightened along the guide, planned as ordinary rows and bent back; the guide is stored as fractions of the bounding box and drawn on the canvas with Draw guide / Clear guide). Sharp bends in a guide fold the rows; stitches stretched by the fold are split back to stitch size.
- The Preview tab is a perspective camera (34° field of view) that orbits the hoop; it starts tilted about 54°, and the editor rulers and toolbars are hidden while it is shown.

## Vector-editing additions (2026-10-09, later)
- Border width: a border used to be a plain running outline with no width. `borderWidth` > 0 now sews it as a satin column centred on the outline.
- Tapered satin: `satinWidthEnd` narrows or widens a satin path along its length (rails built by `railsFromLine` with a width profile). Per-node width profiles are not implemented.
- Rounded corners: rectangles have a `radius`; `round_corners` replaces straight corner nodes of a path by arcs (cubic approximation), optionally only the selected nodes.
- Lettering follows its path live: `text_on_path` records the path, and the lettering is re-laid whenever the path changes.
- Sidebar: Corner radius, End width, Border width, Follow path and Round corners controls, each shown only where it applies.
- Still missing compared with a regular vector editor: per-node stroke widths, stroke caps and joins as options, clipping masks and snapping to other objects' nodes while drawing. These are on the roadmap in `docs/PLAN.md` ("Vector-editing roadmap"). Gradients do not apply to thread; the only realistic version is a dithered two-colour blend fill, listed there as not planned for now.

## Roadmap tools built (2026-10-09, evening)
- Satin geometry was rewritten (`railsFromLine`): explicit corner joins and end caps replace the old smoothed offsets; width profiles via `widthStops`. Needles fan around inner corners (rungs at every join and cap).
- Clipping masks (`clip` / `release_clip`), object snapping with a visible marker, and a dithered two-thread colour blend fill were added; all have engine, browser and MCP tests.
- Known limits: the colour blend follows the rows or a set angle (band blend), but not contour or spiral fills; clipped fills use exact geometry but clipped satin/run stitches are cut at the mask edge without extra edge stitches; there is no in-place mask editing.

## Embroidery options built (2026-10-09, night)
- Cross stitch fill (`fillMethod: "cross"`), appliqué (placement line, stop, tack-down, stop, satin cover; exported as stops in JEF and colour changes in DST/VP3, verified by decoding with pystitch), bean run and run stitch length, random stitch-length variation for rows fills (against moiré) and per-object pull compensation. All have engine, browser and MCP tests.
- Built after that: underpath travel, ripple fill, photo stitch, blends in any direction and with every pattern (below).

## Underpath, ripple, photo stitch, general blends (2026-10-10)
- Underpath: the fill planner may travel through the shape in a straight line (up to 60 mm) when it only crosses rows that are not sewn yet; default on, `underpath: false` turns it off.
- Ripple fill: scaled copies of the outline shrinking to a centre (`rippleCenter`), clipped to the shape.
- Photo stitch: a rectangle with a small grey picture (`photo`) is sewn as one continuous line of horizontal zigzag rows; zigzag width follows the darkness. Created from the picture button next to the tools; single thread.
- Blend: `blendAngle` and band-based dithering make blends work in any direction and with contour, spiral, meander, cross, ripple and guided fills.
- Dragging whole objects now also snaps path nodes to other objects' nodes; "Select mask" jumps to the shape that clips the selected object.
- Still open: multi-colour palettes for blends, mask editing with live preview inside the clipped object.
- Two-tone photo stitch (`photo.thread2`) added; still open: multi-colour blend palettes, live mask preview while editing a mask.

## Image tracing (2026-10-10)
- `src/trace.js`, button next to the tools: **Colour regions** (palette by farthest-first plus k-means in Lab, 3×3 median clean-up, crack-following contours, smoothing and Ramer–Douglas–Peucker simplification, holes grouped under their outlines, stacked largest-first, background colour skipped) and **Line art** (Otsu threshold, Zhang–Suen thinning, skeleton split at junctions, stroke width measured with a distance transform; thin strokes become running stitch, wider ones satin columns of that width). Both create ordinary grouped paths, limited to 60 regions or strokes and the 100-object document limit. A 640×480 picture traces in about 350 ms in the browser.
- Outlines are now fitted with cubic Béziers (Schneider's algorithm, tolerance about 1–2 px, corners kept where the outline turns by more than about 55°), so a circle becomes about five smooth nodes instead of two dozen polygon points; the sewn outline stays within about 2 px of the picture. Holes are sampled from fitted curves. Corners lose about 0.7 px to the smoothing.
- Limits: anti-aliased in-between colours are folded into neighbours, so photographs trace poorly (use photo stitch); line art does not follow strokes through crossings as single smooth lines.

## Reference image (2026-10-10)
- A background picture for hand-tracing: "Reference image" section in the sidebar (load, opacity, show/hide, lock, position and size, fit to hoop, move on the canvas, remove). Stored in the project as a downscaled JPEG data URL (at most 1,400 px, about 1.2 MB), drawn under the shapes in the Design and Stitches views, hidden in the 3D preview, never sewn and never sent to the stitch worker. Agents see its placement in `document_inspect` and can look at the picture with the `reference_image` tool (annotated with a millimetre grid, hoop outline, origin and the current shapes, or raw).
- Limits: one picture per project; no rotation or crop; no on-canvas resize handles (use W/H or fit).
- `reference_image` MCP tool (11th tool); fixed headless `set_reference` being dropped by `document_apply` on server-held documents.

## DST import (2026-10-10)
- DST files import as stitch layers like JEF and VP3 (`readDst`: 512-byte header, 3-byte records, jump / colour-change / end flags, runs of three small jumps read as trims). DST carries no thread colours, so each colour block gets a placeholder colour and the layer says so. A DST exported by Welcome re-imports with the same needle positions (within 0.05 mm), colour changes and trims.
- Fixed: DST export artifacts over MCP were not downloadable (the artifact route only allowed jef, vp3, welcome and svg).

## Agent feedback pass (2026-10-10)
- From an agent's report of using the MCP: documentId now returned in text, `document_list`, `document_render` (PNG), inline preview and SVG, short `document_apply` description with the coordinate conventions plus `embroidery_help`, per-object results and sewing warnings, `clear`, snapshots and restore, `document_push_live`. Tests: MCP smoke, engine, and a live browser scenario.
- Still not possible: several live slots (one browser tab per link), and rendering needs no browser (the PNG is drawn by a small server-side rasteriser, so it is a diagram of the stitches, not the 3D preview).

## Blend palettes (2026-10-17)
- `blendPalette` on a fill: 2–5 thread colours sewn in order across the fill, each taking an equal band (dithered at the band edges, like the two-thread blend). It works with the same band direction as `blendAngle`. Setting `blendThread` clears the palette and the reverse; the engine rejects a fill that sets both.
- Contour and spiral blends were losing most of the fill: the strips of the blend were passed to the inset as one polygon with holes, so 290 of 1,601 stitches were sewn. Disjoint outlines are now separate polygons (`nestPolygons` in `src/stitchplan.js`), which fixes the spiral planner too. Engine test covers both.
- Mask editing in place: double-click a mask to edit its nodes and Bézier handles, and the cut in its clipped objects follows each drag (moves, resizes and rotations too). Releasing commits as before, and the cut after release matches the preview. Browser tests cover each case.
- Hover snap hints: hovering a selected object shows the guides it already lines up with (the same guides a drag would snap to); they clear when the pointer leaves the canvas. Engine and browser tests cover it.
- Decisions on the remaining open items: several live document slots per agent link stay out (one tab per revocable token link is the access model); thread brand libraries stay out (licensed data); clipped satin and run edges keep the current sewn output (no closing stitches until a sew-out can check them); a real Safari check waits for a device.
- Sidebar: Colour 1–4 selects under the blend row (a lone colour is refused with a message). MCP `set_object` accepts `blendPalette` as a hex list or null. Engine and browser tests cover it.

## WebKit engine pass (2026-10-18)
- `npm run test:e2e:webkit` runs the browser suite in Playwright's WebKit engine (the Safari engine, on Linux). It passes 70 tests; the two-finger pinch test is skipped there because it dispatches touch points through a Chromium CDP session. This is not a Safari device check.
- Fixed: double-clicking an object could add a new rectangle in WebKit. A double-click that enters node editing could release over the new node circle, so the native `dblclick` landed on the canvas and added a rectangle. That native listener now ignores double-clicks handled as object double-clicks within 500 ms.
- The single WebKit failure seen in one full run (stitch simulation accessible names) did not recur on rerun or in isolation; it is treated as a timing flake and not fixed.

## Everyday gaps closed (2026-10-10)
- **Thread colours:** the thread, border thread, blend and photo second-thread selects were limited to four colours. Each now has a swatch button opening a palette of 48 named colours, recent colours and a custom colour (colour picker plus hex). The selects remain the value holders, so MCP and tests are unchanged.
- **Autosave:** the design is stored in the browser after every edit and offered back after a reload or crash ("Restore your last design?"); saving a project file marks it clean. The autosave stays on this device and is limited to 4.5 MB.
- **Thread plan** (colours in sewing order with stitch counts), **sewing time estimate** in the stats line (600 stitches a minute, 20 s per colour change, 8 s per trim), **keyboard shortcut list** (? or the keyboard button), tool keys now also switch while a path tool has no points yet, and the project-name box follows remote changes.
- Copy and paste of styles between objects (context menu or Ctrl+Alt+C / Ctrl+Alt+V; fill-only options are cleared on targets that are not fills). Ctrl+Alt+C/V no longer also copies and pastes the object itself.
- Still missing: thread brand libraries (the palette is generic), EMB export, signed macOS builds.
- Three-tone photo stitch (`photo.thread3` with `thread2`): light, mid and dark threads on interleaved rows. Four-tone photo stitch (`photo.thread4` with `thread3`): light, light-mid, mid-dark and the main thread for the darkest detail, each on its own offset rows.
- Sewing tips in the editor: the same checks agents get over MCP (fills too small or narrow, satin under 1 mm or over 7 mm, tiny lettering, duplicates, objects outside the hoop) now show as a count next to the issues in the status bar (click to jump from object to object) and as a yellow "Sewing tips" box in the sidebar for the selected object. The messages are translated in the Spanish interface.

## 2026-10-23 motif size warp across a fill

- Motif fill can shrink its loops across the shape: Loop size warp is None (default), Left to right or Top to bottom. Loops keep their grid positions and count; the size falls linearly from the full Size at the low edge to 40% of it at the far edge, so the far side reads as further away. Stored as `motifWarp`; the sidebar shows the select only for a single motif-filled object. Unknown values are rejected by the engine. Not in the MCP schema.
- This is a pseudo-depth cue along one axis, not a true 3D surface: there is no curvature, no falloff curve and no per-loop height. The 40% floor and the axis choice are fixed.
- Covered by an engine test (loop count unchanged, far-edge loops smaller on the chosen axis, unknown warp rejected) and an e2e test (the row shows for motif fill and the warp can be set and cleared). Screenshot: `design/progress/features/motif-fill-warp.png`.

## 2026-10-23 browser compile benchmark

- `npm run bench:browser` (`scripts/bench-browser.mjs`) runs the same 100-square fixtures as `npm run bench:compile` through the app's real stitch worker (`src/worker.js`) in headless Chromium, on a static build served locally. It reports the median of 5 runs after a warm-up: compile round trip, compile plus JEF encode, the longest main-thread gap (a 5 ms timer while the worker is busy), and JS heap where the browser reports it (Chromium only).
- Measured on the build machine (darwin arm64, headless Chromium, 2026-10-23): 12 mm squares, 26,463 stitches, compile 51 ms, compile + JEF 55 ms, longest main-thread gap 6 ms, heap 11 MiB; 34 mm squares, 145,700 stitches, compile 119 ms, compile + JEF 143 ms, longest main-thread gap 6 ms, heap 11 MiB. Stitch counts match the Node baseline exactly.
- Limits: this is headless Chromium on one Mac, not Safari or a device. WebKit (`PW_BROWSER=webkit`) would not launch on the build machine after installing its Playwright build, so no WebKit numbers exist yet. Cancellation and outdated-result rejection are not timed. Ordinary badges and the 100k-stitch stress target are not measured here.
- Covered by an engine test (the squares fixture compiles to the pinned 26,463 and 145,700 stitch counts) and an e2e test (the stitch worker returns 26,463 stitches for the 12 mm fixture).

## Desktop CI matrix (2026-10-23)

- `.github/workflows/desktop.yml` already builds Linux (ubuntu-22.04), macOS (macos-14) and Windows (windows-latest) in one matrix, on a `v*` tag or manual dispatch, and uploads each `src-tauri/target/release/bundle/` as an artifact. No workflow change was needed.
- Not verified: no CI run of the macOS or Windows jobs has been observed yet. Signing and notarization are still not configured, so the macOS bundles are unsigned.

## 2026-10-23 sewing worksheet

- The Thread plan section has a format select (Text `.txt` or SVG) and a Download sewing worksheet button. The worksheet lists each thread block in sewing order with its stitch count, the total, the hoop and revision, and the sewing-time estimate (the same formula as the stats line: 600 stitches a minute, 20 s per colour change or stop, 8 s per trim). Over MCP the same worksheet is `embroidery_worksheet` (text or SVG artifact).
- The shared engine functions `threadPlan`, `sewingSeconds` and `sewingWorksheet` in `src/engine.js` now drive both the editor's plan list and the file, so the two cannot disagree. The button compiles first when the plan is missing or older than the document.
- Limits: threads are written as hex values, because the engine has no colour names (the editor's names come from its UI palette only). No thread brand or product numbers, no thread length, and no per-object breakdown. The SVG is a plain sheet with no paper-size styling. The time figure is the editor's rough rule, not a machine measurement. The file text is English; only the button labels are translated.
- Covered by an engine test (block order matches the sewing order, block totals equal the plan count, the time formula, escaping of the document name, unknown format rejected), an MCP smoke check (text and SVG artifacts, stale revision rejected) and an e2e test (both downloads from the browser). Screenshot: `design/progress/features/thread-worksheet.png`.

## 2026-10-23 motif size warp along a path

- Motif loops and paired loops on an open or closed motif path can shrink along the path: Loop size warp now offers Along the path, which runs from the full Size at the start to 40% of it at the end. Loop count and spacing are unchanged. Stored as `motifWarp: 'along'`; the sidebar shows the select for a single motif path as well as a motif fill, and disables the option that does not apply to the selected object (Left to right and Top to bottom on paths, Along the path on fills, which ignore it).
- This is the same pseudo-depth cue as the fill warp, along the path's length rather than across a fill. It is not a 3D surface: the 40% floor and the linear falloff are fixed, and the warp is computed per loop from its index, so a path that is resampled differently shifts the sizes slightly.
- Limits: the engine accepts `along` on any object but only motif paths use it, so setting it on a fill is harmless and ignored. Not in the MCP schema.
- Covered by an engine test (loop count unchanged, start loop full size, end loop smaller, paired loops also shrink) and an e2e test (the row shows for a motif path, the fill-only options are disabled, and the warp can be set and cleared). Screenshot: `design/progress/features/motif-path-warp.png`.

## 2026-10-23 batch export as VP3 and DST

- Export batch has a Batch format select (JEF, VP3 or DST). The same copies-per-hoop grid is written as one file per hoop, named `<name>-hoopN.<format>`, through the same worker export path as a single file. The button is now labelled Export batch, and the toast names the format.
- Covered by an engine test (every batch hoop encodes to JEF, VP3 and DST) and an e2e test (the picker switches the download to `-hoop1.vp3` and `-hoop1.dst`). Screenshot: `design/progress/features/batch-formats.png`.
- Limits: the batch still has no per-hoop colour choice (each file takes the selected object's thread colour, as JEF did) and imported machine files cannot be batched. DST carries no colours, as in single-file export.

## 2026-10-23 SEW import

- `.sew` files import through the same paths as JEF, VP3 and DST: the Import machine file picker, the stitch-layer validation and the MCP `document_import_embroidery` tool (format `sew`). An imported SEW keeps its source bytes, so an untouched file re-exports byte for byte, and an edited one re-encodes through the SEW writer.
- The reader follows pyembroidery 1.5.1's `SewReader`: the colour count and thread-chart indices at the start, the stitch stream from byte 0x1D78, plain pairs as stitches, `80 02`/`80 04` as jumps, `80 10` as a stitch, `80 01` as a colour change, and any other control as the end. Colours come from the Janome thread chart, which moved from the encoder into `src/readers.js` so both sides share it, so SEW files do not need placeholder colours.
- Covered by `scripts/sew-parity.json`, generated by `scripts/sew-reference.py` from pinned pyembroidery: all 15 pinned SEW samples must match the reference's sha256, command counts, thread counts and a digest of every decoded command and coordinate. Also an engine test (colour count and truncated headers rejected; an imported sample passes through unchanged and re-encodes with every planned needle written in order), an MCP smoke import, and an e2e test (the machine picker imports a sample as a SEW stitch layer). Screenshot: `design/progress/features/import-sew.png`.
- Limits: the SEW format has no trim record, so imported files have no trims; a colour change beyond the header's colour count is rejected. Zero-length stitches are not written (as on export). The parity digest is pyembroidery's reading, not a sew-out check.

## 2026-10-23 oval bling stones

- Bling has a third stone shape: Oval, next to Round and Square. Each oval is a 13-point ring with its long axis along the path (it turns with the curve, like the leaf loop), half as long again as it is across, and its fixing ring is two-thirds the size. Stored as `blingShape: 'oval'`; the engine rejects unknown shapes. Settable over MCP since the MCP embellishment entry below.
- Limits: the shape is a plain ellipse with no stone facets, and the stone sizes are the same as for round and square (Size is the stone's length along the path). There is still no stone library with brand sizes.
- Covered by an engine test (the same stitch count as round stones, four-millimetre width across the path for the oval against six for round, on both a horizontal and a vertical path) and an e2e test (the Stone shape select accepts Oval). Screenshot: `design/progress/features/bling-oval.png`.

## 2026-10-23 WebKit browser benchmark

- WebKit now runs the browser benchmark on the build machine (macOS 14, arm64). The cause was the driver, not the browser: the repo's Playwright 1.63 cannot open a page in the WebKit build this machine has cached (revision 2251, which Playwright reports as frozen on mac14). `newPage`, and also a page from an explicit browser context, fails with `Unknown setting: PushAPIEnabled`. Playwright-core 1.58.2 launched on the same cached build opens a page and renders text.
- `scripts/bench-browser.mjs` takes two optional environment variables. `PW_DRIVER` loads another Playwright client (a path to its `index.mjs`), and `WEBKIT_EXECUTABLE` names the WebKit launcher to use. Without them the script behaves as before, so the repo's dependencies are unchanged. Reproduce with: `npm install playwright-core@1.58.2` in a scratch directory, then `PW_BROWSER=webkit PW_DRIVER=<scratch>/node_modules/playwright-core/index.mjs WEBKIT_EXECUTABLE=~/Library/Caches/ms-playwright/webkit_mac14_arm64_special-2251/pw_run.sh npm run bench:browser`.
- Measured (idle, median of 5, same fixtures as the Chromium baseline): WebKit 12 mm squares, 26,463 stitches, compile 52 ms, compile + JEF 54 ms, longest main-thread gap 9 ms; 34 mm squares, 145,700 stitches, compile 128 ms, compile + JEF 140 ms, longest main-thread gap 10 ms. Chromium on the same run: 49/54 ms and 112/135 ms, gap 6 ms. WebKit does not expose `performance.memory`, so its heap is not reported.
- Limits: this is one frozen macOS 14 WebKit build on one Mac, and a client that is older than the repo's. It is not Safari on a device, and it does not make `npm run test:e2e:webkit` run: that suite still uses the repo's Playwright 1.63, which cannot open pages in this build. On this macOS 14 machine, `npx playwright install webkit` with 1.63 installs the frozen 2251 build rather than the revision 2359 it pins, so the mismatch is not fixed by reinstalling.

## 2026-10-23 PEC and EXP import

- `.pec` and `.exp` files import through the same paths as the other machine formats: the Import machine file picker, the stitch-layer validation and the MCP `document_import_embroidery` tool (formats `pec` and `exp`). An untouched import re-exports its source bytes, and an edited one re-encodes through the PEC or EXP writer.
- The PEC reader follows pyembroidery 1.5.1's `PecReader`: `#PEC0001` and `LA:`, the colour count at 0x38 with one palette byte per colour, the stitch stream from 0x218, 7-bit and 12-bit relative steps with trim (0x20) and jump (0x10) flags, `FE B0` as a colour change and `FF 00` as the end. Colours come from the Brother thread chart, which moved from the PEC writer into `src/readers.js` with the same values (checked against pyembroidery's chart). A colour change back to the thread already sewing becomes a STOP and drops its thread entry, as pyembroidery's `interpolate_duplicate_color_as_stop` does.
- The EXP reader follows `ExpReader`: byte pairs of 0.1 mm steps with y negated, and `80 80` trim, `80 04` jump, `80 02` stitch and `80 01` colour change (followed by a jump when its step is not zero). EXP has no palette, so each colour block gets a placeholder colour, as DST does, and the warnings say so.
- Covered by `scripts/pec-parity.json` and `scripts/exp-parity.json`, generated by `scripts/pec-reference.py` and `scripts/exp-reference.py` from pinned pyembroidery: all 25 PEC and all 35 EXP pinned samples must match the reference's sha256, command counts, colour or thread counts and a digest of every decoded command and coordinate. Also engine tests (rejected headers; an imported sample passes through unchanged and re-encodes with every planned needle written in order, one needle per repeated point for EXP), and e2e tests (the machine picker imports a sample as a PEC or EXP stitch layer). Screenshots: `design/progress/features/import-pec.png` and `design/progress/features/import-exp.png`.
- Limits: the PEC graphic icons after the stitch stream and the design label are not kept; a PEC block embedded in a PES file is not read. The PEC header check is stricter than pyembroidery's, which does not check the signature. A palette byte of 0 means no thread and gets no colour (the layer falls back to its default thread colour). EXP has no signature, so the picker relies on the `.exp` extension. The parity digests cover the stitch stream and the thread or colour-block count, not the colours.

## 2026-10-23 batch export as SEW

- The Export batch format select offers SEW as well as JEF, VP3 and DST. Each hoop downloads as `<name>-hoopN.sew`, encoded by the same SEW writer as a single-file export, so the batch grid, copies and hoop count are unchanged.
- Covered by an engine test (every hoop of a 40-copy batch encodes to SEW, stays inside the 110 mm hoop, and decodes back with every planned needle point in order; a stitch that starts where a jump ends is that jump's record, so it counts as written), and an e2e test (the batch format select picks SEW and the download is `-hoop1.sew`). Screenshot: `design/progress/features/batch-sew.png`.
- Limits: as for single SEW exports, no trim records and no design header.

## 2026-10-23 batch export of imported machine files

- Export batch now takes imported machine files (JEF, VP3, DST, SEW, PEC and EXP stitch layers) as well as shapes. Each copy of a layer is moved to its grid cell like a vector object, and its stitches are kept in source coordinates. The copy drops the source bytes, so every hoop is encoded from the layer's stitches by the writer for the chosen batch format, never passed through.
- Covered by an engine test (`test/import-integration.test.js`: three imported JEF copies, one per hoop, each compile without errors, carry no source bytes, are not byte-identical to the source and decode with the source's stitch count), and an e2e test (the picker imports a JEF, the batch exports `-hoop1.jef`, `-hoop2.jef`, `-hoop3.jef`).
- Limits: a batch copy keeps the layer's own thread colours rather than a per-hoop colour choice. Each copy is a clone, so its rotation, thread and thread overrides are the layer's own, and only its position changes.

## 2026-10-23 hexagon bling stones

- Bling has a fourth stone shape: Hexagon, next to Round, Square and Oval. Each hexagon is a six-point outline with a corner on the path's direction and a flat side across it, and its fixing ring is two-thirds the size. Stored as `blingShape: 'hexagon'`; the engine rejects unknown shapes. Spanish label: Hexágono. Settable over MCP (see the MCP embellishment entry below).
- Covered by an engine test (hexagon stones sew fewer stitches than round ones, the stone is six millimetres corner to corner across the path against 5.2 millimetres flat to flat) and the existing e2e bling shape test, which now also selects Hexagon. Screenshot: `design/progress/features/bling-hexagon.png`.
- Limits: a plain hexagon with no facets or stone library; the stones do not turn with an oval-style direction, so on a curved path they keep their orientation.

## 2026-10-23 embellishment and motif keys over MCP

- `add_path` and `set_object` accept `stitch: "motif"`, `"sequin"`, `"bead"` or `"bling"` as well as fill, run and satin. `set_object` accepts `blingShape` `oval` and `hexagon`, `motifShape`, `motifWarp` (none, x, y, along), `motifSize` (0.4–6), `motifSpacing` (1–20) and `motifPair`. The embellishment help text in `embroidery_help` and the new "Embellishment and motif keys" section of `docs/MCP.md` describe them.
- Bug fixed on the way: `add_path` turned every open path into a running stitch unless it was satin, so `stitch: "bling"` (or motif, sequin, bead) on an open path was silently sewn as running stitches. Open paths now keep those four types; other open paths still become running stitches.
- Covered by an engine test (the four types are kept on open paths, fill still becomes run) and by `npm run test:mcp`, which sews bling, motif, sequin and bead paths over MCP, and rejects an unknown bling shape and a motif size of 9 mm. Screenshot: `design/progress/features/mcp-embellishments.png`, rendered by `scripts/mcp-embellishment-shot.mjs` through an anonymous MCP session, not from the browser UI.
- Limits: the schema mirrors the engine's own ranges; sequins and beads have no MCP-only defaults beyond the engine's. `motifPair` still needs a satin width, as in the editor. No MCP tool for a stone library.

## 2026-10-23 star bling stones

- Bling has a fifth stone shape: Star, next to Round, Square, Oval and Hexagon. Each star is a five-pointed outline with outer points three millimetres from the centre at the default size and inner points halfway in; its fixing ring is two-thirds the size. The stars keep a fixed orientation, one point along the path, as hexagons do. Stored as `blingShape: 'star'`; the engine rejects unknown shapes. Spanish label: Estrella (already used by the star tool). Settable over MCP.
- Covered by an engine test (a star sews a different stitch count from a round stone, and stands 5.8 mm across a horizontal path) and the e2e bling shape test, which now also selects Star. Screenshot: `design/progress/features/bling-star.png`.
- Limits: a plain outline with no facets or stone library; its outer points reach the same radius as a round stone of the same size.

## 2026-10-23 motif fill over MCP

- `fillMethod: "motif"` (the Motif loops fill pattern, already in the editor and the engine) is accepted by `set_object` over MCP, with `motifSpacing` and `motifSize`. The MCP enum had left it out.
- Covered by `npm run test:mcp`, which applies a motif fill and compiles it with no errors. The embellishment screenshot `design/progress/features/mcp-embellishments.png` now includes a motif-filled rectangle.
- Limits: the same as the editor's motif fill; no MCP-only settings.

## 2026-10-24 twin sequins

- Sequins have a Twin sequins option (`sequinTwin: true`, a checkbox shown for sequins only, also settable over MCP). Each point gets two sequins side by side across the path, one either side of the centre line, with centres a sequin's width apart so they touch. The spacing, size and fixing loop are the same as for a single sequin.
- Covered by an engine test (a single row is 3 mm across, the twins 6 mm across a horizontal path, and twins sew about twice the stitches; a non-boolean `sequinTwin` is rejected) and by the e2e sequin test, which ticks the box and checks that the stitch count roughly doubles. Screenshot: `design/progress/features/sequin-twin.png`.
- Limits: the pair is across the path, not along it; there is no per-sequin offset or twin spacing control; sequins are still placed one per point along the path.

## 2026-10-24 beads sewn once

- Each bead is one short pass across the path at its point. `beadRuns` used to push the same back-and-forth segment three times, so every bead was sewn three times over one line. A 40 mm bead path now compiles to 16 stitches; it was 64. Bead positions, length and spacing are unchanged.
- Documents that already contain beads will compile to fewer stitches and a different machine file after this change. Nothing else in the stitch model moves.
- Covered by the engine test (a 40 mm bead path sews 10 to 30 stitches, one pass per bead) and the existing e2e bead test. Screenshot: `design/progress/features/beads.png`.
- Limits: a bead is still one pass with no bead shape or multi-pass option. The fix only removes repeated stitches; it does not add a dispensing or bead-shape control.

## 2026-10-24 stones turn with the path

- Square, hexagon and star stones are drawn in a frame that follows the path direction at each point, the way the oval always has. The new `stoneTurn` option (checkbox "Turn stones with the path", shown for square, hexagon and star) defaults to on; `stoneTurn: false` keeps a stone in one orientation on every path, which was the old behaviour. Settable over MCP. A non-boolean value is rejected.
- On a horizontal path the output is unchanged, because the path direction is already the fixed frame there. On other paths, existing square, hexagon and star stones compile in their turned orientation; the stitch count does not change.
- Covered by an engine test (a hexagon is 5.2 mm across a vertical path turned, 6 mm fixed, with the same stitch count either way; `stoneTurn` must be true or false) and an e2e test (the checkbox shows for square, hexagon and star only, is on by default, and can be unchecked). Screenshot: `design/progress/features/stone-turn.png`.
- Limits: a square looks the same turned, so on axis-aligned paths the option makes no visible difference; it shows on diagonal and curved paths. Round stones have no orientation and are unaffected. The oval always turns and has no switch.

## 2026-10-24 heart bling stones

- Bling has a sixth stone shape: Heart (Spanish label Corazón), next to Round, Square, Oval, Hexagon and Star. The outline is the standard parametric heart, 21 points, scaled so the stone is its size across the path (point along the path, lobes to the back) with its fixing ring at two-thirds size. Stored as `blingShape: 'heart'`; the engine rejects unknown shapes. Settable over MCP.
- Like the oval, a heart always turns to follow the path, so it has no Turn stones with the path checkbox.
- Covered by an engine test (a heart stone is 6 mm across a horizontal path, sews its own stitch count, and is 6 mm across a vertical path, which proves it turns; a fixed heart would be about 5.4 mm) and by the e2e bling shape test, which now also selects Heart and checks the turn checkbox is hidden. Screenshot: `design/progress/features/bling-heart.png`.
- Limits: 21 points per outline, so curves are smooth at stone sizes of a few millimetres but would show facets at much larger sizes; no facets or stone library.

## 2026-10-24 bling fixing rings

- Bling stones have a Fixing rings select (Two rings or One ring, shown for bling). Two is the default and sews exactly what it did before. One ring sews only the outer ring of each stone, so the stone keeps its size and a bling stone sews half the stitches. Stored as `blingRings`; the engine accepts only 1 or 2. Settable over MCP.
- Covered by an engine test (one ring keeps the stone's bounds and halves the stitch count of the square stones; 3 is rejected) and an e2e test (the select shows for bling, defaults to two rings, and one ring sews fewer stitches). Screenshot: `design/progress/features/bling-one-ring.png`.
- Limits: the choice applies to every stone shape, including the round ones; a single ring has no backing, so on some fabrics a stone can lift at its edge. No other fixing layouts.

## 2026-10-24 bead shape: dash or dot

- Beads have a Bead shape select: Dash (the default, the one pass across the path at each point) or Dot. A dot is a small round bead, a 13-point ring as wide as the bead size (`motifSize`, 2 mm by default), so it sits on the path at each point. Stored as `beadShape`; the engine accepts only dash or dot. Settable over MCP.
- Scope decision: the queued item said a dot sews one stitch at each point. One stitch is not visible on the fabric, so a dot is a small round bead instead. Recorded in the roadmap.
- Covered by an engine test (a dot path is 2 mm tall and sews more stitches than the dash path; a dash path has no height; an unknown bead shape is rejected) and an e2e test (the Bead shape select shows for beads only, defaults to dash, and dot sews more stitches). Screenshot: `design/progress/features/bead-dot.png`.
- Limits: a dot is a plain ring; there is no bead-size control separate from the bead size, and no dispensing control.

## 2026-10-24 twin beads

- Beads have a Twin beads checkbox (`beadTwin: true`, shown for beads only, settable over MCP). Each point gets two beads side by side across the path, one either side of the centre line, centres a bead length apart. Works for both shapes: two dashes or two dots.
- Scope note: the engine's dash runs along the path, not across it as an older comment said; the twin dashes are therefore side by side across the path. The default output (twin off, dash) is unchanged.
- Covered by an engine test (a single dot is 2 mm across the path, twin dots 4 mm, about twice the stitches; twin dashes 2 mm across; `beadTwin` must be true or false) and an e2e test (the checkbox shows for beads only, is off by default, and turning it on adds stitches). Screenshot: `design/progress/features/bead-twin.png`.
- Limits: the two beads are the same shape and size; no per-bead offset control.

## 2026-10-24 per-side pull on satin

- A satin path takes a Satin pull on the right and a Satin pull on the left (0–2 mm, shown for satin paths only; `pullRight` and `pullLeft` over MCP, null clears). The right and left rails are the two sides of the column as seen walking along the path on screen; each rail moves out by its own pull, and an unset side uses the object's pull compensation as before.
- Default output is unchanged: with neither side set, the satin column compiles as it did.
- Covered by an engine test (an unpulled 4 mm column spans -2 to 2 across the path; pullRight moves only the right rail, pullLeft only the left, both together take their own pulls; an unset side uses the object's compensation; out-of-range values are rejected) and an e2e test (the fields show for satin only and a typed value is kept). Screenshot: `design/progress/features/satin-pull.png`.
- Limits: fills keep one pull compensation; the pull is a shift of the needle points, not a change of the stitch angle. The sign of "right" follows the screen (y down), so a path drawn the other way swaps the rails.

## 2026-10-24 laydown underlay

- Fills have a Laydown (wide rows) underlay type. It sews one light fill at 4 mm rows, across the grain of the top fill (the top fill's angle plus 90°), inset from the outline like the other underlays, to flatten the pile of towelling and fleece. The underlay type is a single choice, so laydown replaces the other underlays rather than adding to them; `contour+laydown` is not a valid type. Stored as `underlayType: 'laydown'`; settable over MCP.
- Laydown is rejected on satin paths, because a satin path is open and has no closed area for the fill. The row spacing is fixed at 4 mm for now; the underlay spacing setting does not change it.
- Covered by an engine test (laydown adds stitches to a 40 by 30 mm fill, stays inside the shape, and is rejected on a satin path) and an e2e test (the option is offered for fills, and sewing a closed square with laydown adds stitches compared with None). Screenshot: `design/progress/features/fill-laydown.png`.
- Limits: a single rate of 4 mm for every fabric; no tatami-style combination with the top fill; no laydown for satin or lettering.

## 2026-10-24 print template

- Export has a Print template · 1:1 SVG option (Plantilla para imprimir in Spanish). It downloads `<name>-template.svg`: a placement sheet in millimetres, the size of the hoop (`width` and `height` in mm, the viewBox centred on the hoop's centre), with the design's outlines in green, the hoop outline dashed red, a centre cross, and a 10 mm scale bar and the design name at the top left. Stitch layers appear as their bounding box.
- Covered by an engine test (the sheet is the hoop in millimetres, centred; a shape's outline stays inside the hoop; the scale bar is 10 mm long at the bottom left and labelled) and an e2e test (the export downloads a `-template.svg` with the hoop's size and the scale bar label). Screenshot: `design/progress/features/print-template.png`, which renders the downloaded sheet itself (`scripts/print-template-shot.mjs`).
- Limits: the sheet is for placement, not printer calibration: printers scale pages unless set to 100%, so the scale bar is the check. Only the outlines are drawn, not the stitches. The hoop shown is the design's hoop, not a machine's hoop shape.

## 2026-10-24 fabric presets

- The document stitch settings have a Fabric select: Woven (the defaults), Knit, or Towel or fleece. It is a `set_settings { fabric }` operation that writes the preset into the document settings: Knit sets pull compensation to 0.5 mm; Towel sets pull compensation 0.4 mm, stitch length 2.5 mm, needle stagger 8 phases (the widest the select offers; 6 would leave the select blank) and auto underlay. Explicit settings in the same operation win, so a preset followed by a compensation change keeps the change. The chosen fabric is stored as `settings.fabric`; settable over MCP.
- Decision: the towel preset uses the auto underlay instead of the centre underlay the queue item suggested. A centre underlay applies to satin only, so as a document setting it would drop the underlay from every fill. Recorded in the roadmap.
- Covered by an engine test (knit and towel set the expected settings, a towel plan differs from a woven one, an explicit compensation after a preset wins, an unknown fabric is rejected) and an e2e test (the select sets the compensation field to 0.4 and changes the stitch count). Screenshot: `design/progress/features/fabric-towel.png`.
- Limits: three presets only; choosing a preset does not lock the other settings, and changing them later leaves the Fabric select showing the last preset chosen.

## 2026-10-24 redwork outline

- Shape and path tools have a Redwork outline button. For a selected closed shape (a rectangle, an ellipse, or a closed path) it adds a new run object, named `<name> redwork`, that goes once around the shape's outline and is sewn back over itself in Redwork (out and back) style. The original shape is kept. Settable over MCP as `redwork_outline { id }`. An open path is refused with a message.
- Covered by an engine test (the new object is a closed run in Redwork style; it sews about twice a plain run around the same points; an open path is refused) and an e2e test (the button adds one redwork row to the list). Screenshot: `design/progress/features/redwork-outline.png`.
- Limits: the new run is a copy of the outline, not linked to the shape, so moving or editing the shape later does not update it; the stitches are the Redwork style's out-and-back run, with no separate underlay.

## 2026-10-24 satin end inset

- A satin path has a Satin end inset field (0–2 mm, empty to clear; `endInset` over MCP). It moves the first and last needle of the column inward along the column by that amount, so the stitches at each end are shorter. The rest of the column, the stitch count and the underlay do not change.
- Found on the way: the last needle pairs of a column sit at the same spot, so the inward direction at the end came out as zero and the end did not move. The direction is now taken from the nearest pair whose midpoint differs.
- Covered by an engine test (with a 1 mm inset the first and last needle each move 1 mm inward, the stitch count is unchanged, and 3 mm is rejected) and an e2e test (the field shows for satin only and a typed value is kept). Screenshot: `design/progress/features/satin-end-inset.png` (the field at 1.5 mm; at this zoom the shortening is subtle).
- Limits: one value for both ends; the underlay is not inset by it; Ink/Stitch's multi-value short stitch inset is not implemented.

## 2026-10-24 sequin fill

- Fill pattern Sequin fill (fillMethod `sequin`) covers a closed shape with sequins on a staggered grid, every row offset by half a spacing, each sequin a centre stitch and a fixing ring. It reuses the motif fill layout; spacing is `motifSpacing` (default 8 mm) and sequin size `motifSize` (default 3 mm). Settable over MCP.
- Covered by an engine test (a 40 by 30 mm sequin fill stays within a sequin of the shape and sews well under half the stitches of a tatami fill) and an e2e test (the option is offered for fills, and choosing it lowers the stitch count). Screenshot: `design/progress/features/sequin-fill.png`.
- Limits: the sequin rings reach about a sequin radius past the edge of the shape, as the motif fill's loops do; there is no twin option or dispensing control for fills.

## 2026-10-24 hoop size presets

- The hoop size in the footer has a Hoop preset select: Custom size, Default 110 × 110, Brother 4×4 · 100 × 100, Brother 5×7 · 180 × 130, Brother 6×10 · 260 × 160. Choosing one sets the document hoop through the existing `set_hoop` operation; typing a different size moves the select to Custom size. The sizes live in `HOOP_PRESETS` in `src/engine.js`.
- Sources, checked 2026-10-24: 100 × 100 mm is Brother's 4×4 hoop (SA443, "100mm X 100mm (approx. 4" X 4")", Allstitch's kit page). 180 × 130 mm is the 5×7 hoop (SA444, listed by Sew Jersey as "180mm x 130mm"; Echidna Sewing's table gives 5" × 7"). 260 × 160 mm is the 6×10 hoop: Echidna's table gives 6" × 10" for 160 × 260 mm, and one retailer's slide-on 6×10 hoop is listed for it. That was one guide; a second source was then found: Brother's SA441 6×10 hoop is listed with a 10.5 × 6.25 inch embroidery field (about 267 × 159 mm), matching a frame of about 160 × 260 mm. Confirmed 2026-10-24 by the supervisor review. The long side is the width. The queued 150 × 240 mm size was dropped: no source lists it.
- Decision: no MCP key for presets. `set_hoop` already sets any size, so an agent can use the same sizes; a preset name would only add a second way to say the same thing.
- Covered by an engine test (the four presets are exactly these sizes, each is stored by `set_hoop` and validates, and an out-of-range width is rejected) and an e2e test (choosing 5×7 sets both fields, and typing a width moves the select to Custom size). Screenshot: `design/progress/features/hoop-preset.png` (the 6×10 preset).
- Limits: in the narrow footer the select truncates its label ("Brother 6" in the screenshot); the title tooltip has the full name. Queued as a follow-up.

## 2026-10-24 raised fill

- Fills have a Raised fill checkbox (extra tatami underlay). It adds a second tatami underlay at 2 mm rows, at the same 90° to the top fill as the fill underlay, inside the shape, so the fill stands up. It is stored as the existing `raised` flag, which satin already uses for its centre run and zigzag. Settable over MCP for fills and satin.
- Decision: the queued item asked for the raised underlay to sit over the usual underlay and under the top fill, at 90°. It does, but when the Underlay select also includes the tatami fill (auto for large shapes), the two layers are the same direction and add up. That is the intended stacking for a higher lift, and it is in the limits below.
- Covered by an engine test (a raised 40 by 30 mm fill sews more than 1.1 times the stitches of the same fill; the extra stays inside the shape; a non-boolean value is rejected) and an e2e test (the checkbox shows for fills only and ticking it with no other underlay adds stitches). Screenshot: `design/progress/features/fill-raised.png`.
- Limits: the raised layer uses a fixed 2 mm spacing, not a setting; it stacks on whatever underlay is chosen, so with auto underlay on a large shape the stitch count rises noticeably; not sew-tested on a machine.

## 2026-10-24 accordion spacing

- A rows (tatami) fill has Accordion start (mm) and Accordion end (mm) fields (0.25–1.2 mm). The row spacing is the start value at the top of the fill and the end value at the bottom, changing linearly in between, measured across the fill at its angle. They override the row spacing for that fill; the stitch angle still applies. Set both or neither; setting one copies its value to the other, so the fill starts even. Settable over MCP.
- Source and spec: Wilcom's help documents this as Accordion Spacing (Shading and Open Fills add-on): it works best on tatami fill, overrides the auto and fractional spacing while the stitch angle still applies, takes a density at each end of a gradient, and is best used without auto underlay. Wilcom's placement algorithm is not published, so this is Welcome's own linear version of that behaviour.
- Covered by an engine test (on a 40 by 30 mm fill, rows above the centre line outnumber rows below by more than 1.5 times with a start of 0.4 and end of 1.2, against an even split for uniform spacing; the accordion fill sews fewer than 75% of the rows of a uniform 0.4 fill; a single value is rejected) and an e2e test (the fields show for rows fills only; setting the start copies it to the end; changing the end lowers the stitch count). Measured: 27 rows above and 15 below, 42 in total, against 38, 38 and 76 for uniform 0.4. Screenshot: `design/progress/features/accordion-fill.png`.
- Limits: linear only (Wilcom's presets and two-way profiles are not built); rows pattern only; the auto underlay is not turned off for you (set it yourself, as Wilcom advises).

## 2026-10-24 hoop preset label fits the footer

- The Hoop preset select now shows short labels that fit its 76 px width: Custom, Default, 4×4 in, 5×7 in and 6×10 in. The full names (Brother 4×4 · 100 × 100 and so on) are in the select's tooltip. The values and the hoop sizes are unchanged. This fixes the truncation noted in the hoop presets entry.
- Covered by the e2e hoop preset test, which now checks the visible label (`5×7 in` after choosing 5×7). Screenshot: `design/progress/features/hoop-preset.png`, where the footer reads `6×10 in`.
- Limits: the labels are short, so the size is shown by the width and height fields; the names in full are only in the tooltip.

## 2026-10-24 raised spacing

- The raised fill's extra underlay has a Raised spacing (mm) field (1–4 mm, empty for the 2 mm default), shown when Raised fill is on. It is stored as `raisedSpacing` and settable over MCP. It replaces the fixed 2 mm row spacing of the raised layer from `74f8c8e`.
- Covered by an engine test (a 4 mm raised spacing sews fewer than 70% of the raised stitches of the 2 mm default, measured above a plain fill; 5 mm is rejected) and the e2e raised fill test, which ticks Raised fill, then sets the spacing to 4 mm and checks that the count falls. Screenshot: `design/progress/features/fill-raised.png` (4 mm).
- Limits: one spacing for the raised layer; it still stacks on the chosen underlay.

## 2026-10-24 bling fill

- Fill pattern Bling fill (fillMethod `bling`) covers a closed shape with the bling stones (Stone shape and Fixing rings settings) on the sequin fill's staggered grid, every row offset by half a spacing, in a fixed orientation. Spacing is `motifSpacing` (default 8 mm), stone size `motifSize` (default 4 mm). Settable over MCP.
- The stone drawing moved out of the bling stroke into one shared function, `blingStones`, used by both the stroke and the fill; the bling stroke's output is unchanged (the existing bling tests pass unchanged).
- Correction to the queued item: it expected a square-stone fill to sew more stitches than a sequin fill at the same spacing. Measured on a 40 by 30 mm fill at 3 mm: sequin 344, square bling 288, round bling 630 (round stones have two fixing rings), hexagon 366 at 3 mm, heart 992 at the 4 mm default. The test asserts that round bling sews more than sequins and that the stones stay near the shape.
- Also fixed: the editor showed the motif defaults (spacing 4, size 1.6) for bling and sequin fills, while the engine sews 8 and 4 (sequin fill 8 and 3). The editor now shows what is sewn. The e2e bling fill test checks the displayed defaults.
- Covered by an engine test (the bling fill stays near the shape; round bling sews more than sequins; an unknown stone shape is refused), the e2e test (the Bling fill option appears, its defaults show, and changing the stone shape changes the count), and `npm run test:mcp`. Screenshot: `design/progress/features/bling-fill.png` (hexagon stones).
- Limits: stones in a fixed orientation (no turning on a fill); no per-stone spacing; the stones do not stop at the edge, so an outline can reach about a stone's radius past the shape.

## 2026-10-24 name drop batch

- The batch export has a Name drop box: one name per line. Each name becomes one copy; the copy's first lettering object (in design order) is given that name, and the batch info line counts the names. Copies are laid out on the batch grid and written one file per hoop, as before. A design with no lettering is refused with "Name drop needs a lettering object in the design." An empty box keeps the plain batch.
- Covered by an engine test (three names give three copies carrying the names in order, each compiles, and a design with no lettering is refused) and an e2e test (three names download a `-hoop1` file and the info line says "3 copies need"; a design without lettering shows the refusal). Screenshot: `design/progress/features/name-drop.png`.
- Limits: only the first lettering object takes the names; the names box is not in MCP; names are not checked for the bundled font's glyphs beyond the normal lettering check (an unsupported character is refused by the existing validation); the design view still shows one copy.

## 2026-10-24 DXF import

- Opening an ASCII `.dxf` file (the file picker now accepts it) imports its LINE and LWPOLYLINE entities as path objects in one new document, named "Imported DXF". Units are taken as millimetres. DXF's y axis points up, so y is flipped to match the editor, and the drawing is centred on the hoop origin. A closed polyline (flag 1) becomes a closed path; the closing vertex is not repeated. Each path is sewn as a running stitch. Other entities (CIRCLE, ARC, TEXT and so on) are skipped and counted in the import message; polyline bulges (arcs) are sewn as straight segments and counted.
- Binary DXF is refused with "Binary DXF is not supported; save the file as ASCII DXF." A file with no LINE or LWPOLYLINE is refused. Limits: 1,000 points per polyline and 5,000 in total, as for SVG.
- Covered by unit tests in `test/dxf.test.js` (LINE and closed LWPOLYLINE points after the flip and centring, CIRCLE reported as skipped, binary and empty files refused, bulges counted, malformed group codes refused), an e2e test that opens `fixtures/dxf/simple.dxf` through the file picker and checks two rows and the import message, and `npm run test:mcp`, which still passes because `server.js` only gained the module in its allowlist. Screenshot: `design/progress/features/dxf-import.png`.
- Limits: no arcs, circles, text, splines, layers or blocks; no DXF units other than millimetres; the import message is in English only; MCP has no DXF import tool.

## 2026-10-24 satin end inset per end

- A satin path has two end-inset fields, Satin end inset: start (mm) and end (mm), each 0–2 mm (empty to clear). The start value moves the first needle inward along the column; the end value moves the last. They replace the single field. The single `endInset` still works: an unset end uses it, so saved documents compile exactly as before. Over MCP: `endInsetStart` and `endInsetEnd`, alongside `endInset`.
- Covered by an engine test (a start inset moves only the first needle, an end inset only the last; both together match the single value on both ends; an explicit end value of 0 overrides a single value at that end; the stitch count is unchanged; a start value of 3 is refused) and the e2e end inset test, which sets start 1 and end 0.5 and checks both fields and that the row hides for other stitch types. Screenshot: `design/progress/features/satin-end-inset.png` (start 1.5, end 0.5).
- Limits: the insets are still only the needle moves, not a separate underlay inset; the underlay is not changed.

## 2026-10-24 organize custom fonts

- The document stitch settings have an Organize fonts button. It opens a dialog listing each custom font in the document (a TrueType font loaded from a file and stored in the project), with the lettering objects that use it. Remove unused fonts deletes the custom fonts that no lettering uses; it is one undoable step, and it is disabled when every font is in use. Over MCP: `remove_unused_fonts`.
- Covered by an engine test (the listing shows a used font with one use and an unused font with none; removing unused fonts keeps the used one, and running it again changes nothing) and an e2e test (load a font, the dialog lists it used by one lettering, Remove is disabled; delete the lettering, the dialog shows zero uses, and Remove drops the font with a toast). Screenshot: `design/progress/features/organize-fonts.png`.
- Limits: bundled fonts are not listed (they are not stored in the document); no rename or merge; the dialog and its messages are English-only apart from the button labels.

## 2026-10-24 font and MCP request limits raised

- A document can hold up to 16 custom fonts (was 8). The per-font cap of 400 glyphs is unchanged.
- The MCP request body limit is 8 MB (was 2 MB). The limit applies to `/mcp` requests through `bodyJson`; the relay's own limits are unchanged.
- Why these numbers: a stored custom font of 200 glyphs measures about 96.5 KB of JSON (Bebas Neue, from a 61 KB `.ttf`, measured 2026-10-24). Sixteen fonts at the 400-glyph cap come to roughly 3 MB, which fits in 8 MB with room for objects and a reference picture (up to 1.5 MB of base64 data). At 8 fonts and 2 MB, a font-heavy design could not be sent through MCP alongside a reference picture.
- Covered by an engine test (16 custom fonts validate, a 17th is refused) and the MCP smoke test, which sends a 3 MB request and checks the server does not reject it for size. The same test fails with the old 2 MB limit ("Request body exceeds 2 MB."), which was checked by restoring the old value briefly.
- Limits: no UI change; the editor itself has no font-count message beyond the validation error. Font files of up to 12 MB can still be loaded in the picker, as before.

## 2026-10-24 PES import

- Brother PES files import through the machine picker (`.pes`), the stitch-layer validation and the MCP import enum (`format: "pes"`). `readPes` in `src/readers.js` covers every PES version the samples hold (1 to 10): bytes 8 to 11 give the offset of the PEC block, whose label `LA:` sits at that offset (eight bytes into the block), so a `#PEC0001` header is put in front and the existing PEC reader decodes it.
- Parity: all 73 PES samples in `fixtures/embroidepy/samples.zip` decode to the command counts, thread counts and coordinate digests of pyembroidery 1.5.1's PesReader, pinned in `scripts/pes-parity.json` (generated by `scripts/pes-reference.py`) and compared in `test/readers.test.js`. Versions: 20 version 1, 9 version 2, 5 version 3, 11 version 4, 10 version 5, 16 version 6, 1 version 9, 1 version 10.
- Covered by unit tests in `test/pes-import.test.js` (a spiral design imports and compiles and keeps its source bytes; a PEC offset past the end and a file without the PES signature are refused; the spiral exports to JEF, and a sample with steps over 12.7 mm is refused by JEF but exports to DST), an e2e test (the spiral design opens through the machine picker as "96 commands", source PES), and the MCP smoke test (a PES import is accepted). Screenshot: `design/progress/features/pes-import.png` (the spiral design, 16 thread colours, 64 stitches compiled).
- Limits: the reader does not read PES's own header metadata (names, categories) beyond what the PEC block holds; some samples (the random ones) have stitch steps of 50 to 80 mm that JEF cannot carry, so JEF export refuses them with its existing message, while DST exports them.

## 2026-10-24 vertical lettering

- Lettering has a Vertical (one letter under another) checkbox for registry fonts. With it on, each letter is a row, stacked at the line height and centred on the lettering's x position (the column's middle sits at x, not its left edge). Stored as `vertical`; settable over MCP on `add_text` and `set_object`.
- Validation refuses vertical lettering with more than one line, on a path (text on path), or with the two older single-line fonts (Welcome Mono, Néon). A vertical column that runs past the hoop gets the usual "exceeds the hoop" sewing tip.
- Covered by an engine test (a vertical "ABC" is far taller and one letter wide, the column is centred on x, and the three refusals) and an e2e test (the checkbox changes the stitch count of the demo lettering). Screenshot: `design/progress/features/vertical-lettering.png` (LATO, four letters stacked; the hoop tip shows because it is taller than 110 mm).
- Limits: the column is not scaled to fit the hoop; the object's frame and handles still show the one-line box; no vertical alignment options beyond the centre.

## 2026-10-24 SVG strokes as satin columns

- An SVG path, line or polyline with no fill and a stroke, and a `stroke-width` attribute of at least 0.3 mm after the viewBox scale (the scale that fits the file to the 110 mm hoop), imports as a satin column of that width in the stroke's colour. A narrower stroke, or a path with no `stroke-width`, still imports as a running stitch, as before. Widths are clamped to the satin range (0.5 to 12 mm).
- Covered by an e2e test (`test/fixtures/strokes.svg`: a 4 mm stroke becomes one satin row, a 0.2 mm stroke and an unset stroke stay running stitches). Screenshot: `design/progress/features/svg-stroke-satin.png`.
- Limit: the engine test the queue asked for is not possible, because the SVG importer runs in the browser (it uses DOMParser), so the check is the e2e test. Filled shapes and text are unchanged; no MCP import of SVG strokes.

## 2026-10-24 DXF export of paths

- The Export dialog has a DXF option ("DXF · paths (CAD)"). It writes an ASCII DXF of every visible object's outline, as returned by the engine's geometry function: rectangles, ellipses, paths, and lettering outlines. A two-point open path is written as a LINE; every other outline is an LWPOLYLINE, with the closed flag (70 = 1) set for closed paths and the closing vertex not repeated. Coordinates are millimetres, with y flipped back to y-up (the importer's inverse). The header sets `$INSUNITS` to 4 (millimetres).
- Stitch layers have no outline, so they are not written and are counted as skipped. The download message reports the number of paths written and the layers skipped.
- Covered by unit tests in `test/dxf.test.js`: a closed rectangle exported and read back by the importer gives the same four points, and a stitch layer is counted as skipped. An e2e test downloads a `.dxf` file and checks for an LWPOLYLINE, the EOF marker and the "DXF exported" message. Screenshot: `design/progress/features/dxf-export.png`.
- Limits: outlines only, so no stitches, layers, colours or arcs (the geometry is polyline); no MCP export tool; the option label is clipped by the dialog's select width.

## 2026-10-24 Rotate around a pivot

- **Set pivot** (Transform section) arms pivot mode: the next click on the canvas sets the rotation pivot, rounded to 0.1 mm, and the point is drawn as a ring with ticks on the canvas. The panel reads "Pivot at x, y mm" and **Use centre** clears it.
- With a pivot set, changing the **Rotation** field turns each selected object by the change in the field, about the pivot (the `rotate` operation with the pivot as its centre). Without a pivot the field keeps its old meaning: it sets the object's own angle about its own centre.
- Over MCP, the `transform` operation takes an optional `pivot: {x, y}`. With it, `rotation` turns the object about the pivot by the difference from its current rotation, so its centre moves; without it, `rotation` sets the angle as before.
- Covered by an engine test (`test/engine.test.js`: two objects turned 90° about a point land on the rotated centres; a rotation about an object's own centre keeps it; the transform pivot key moves the centre and turns by the change), and an e2e test (`test/editor.spec.js`: the pivot is set by a canvas click, the field turns the rectangle, its centre matches the predicted position, and Use centre clears the marker). Screenshot: `design/progress/features/rotate-pivot.png`.
- Limits: the pivot is not stored in the project and is lost on reload; it is not cleared when the selection changes; the marker is hidden while a path's nodes are being edited; the rotate handle and Alt+arrow keys still turn about each selection's own centre, not the pivot.

## 2026-10-24 Teardrop and baguette bling stones

- Two stone shapes join the bling list. A **teardrop** is a circle whose tangents meet at a point ahead of it, so it follows the path like the heart (its tip points along the path). A **baguette** is a long rectangle with chamfered ends; it turns with the path like the square, and its turn setting is shown in the panel.
- Both are accepted by the validator and by the MCP `set_object` shape enum. Covered by an engine test (compile and validate; the baguette keeps its turn setting) and an e2e test (both appear in the shape list; only the baguette shows the turn setting). Screenshots: `design/progress/features/bling-teardrop.png`, `bling-baguette.png`.
- Limits: outlines with fixing rings only, no per-stone size control beyond Size (mm).

## 2026-10-24 Sewing tips to show, and PES header names

- **Sewing tips** now carry a category: outside the hoop, duplicate objects, small or thin fills, very short paths, satin columns too narrow or too wide, and small lettering. The side panel's **Sewing tips to show** list has one checkbox per category. Unticked categories are hidden from the tip panel and the tip count (the issues button). The choice is stored in local storage under `welcome.hiddenTips`, per browser; an unknown id in that list is ignored.
- **PES header metadata:** PES files from version 4 on hold a name, category, author, keywords and comments after a 16-byte prefix, each a length byte and the text. `readers.js` reads them (versions 1 to 3 have none; malformed fields are ignored and the stitches still import). The name becomes the stitch layer's name when the file has one; the source keeps the fields (validated: five known keys, at most 240 characters each); the info panel shows the name and `by <author>`.
- Checked against pyembroidery 1.5.1: a sample with name, author and comments written in imports with the same fields and the same 96 stitches.
- Covered by engine tests (the category filter; the PES metadata round trip and refusal), an e2e test for the tip checkboxes and saved choice, and an e2e test for a PES upload. Screenshots: `sewing-tips-settings.png`, `pes-metadata.png`. The metadata sample is built in the tests by `test/pes-with-metadata.js`, because the pinned PES samples have empty fields.
- Limits: the tips list is per browser, not per document; keywords and category are read but not shown; the MCP has no tip filter.

## 2026-10-24 Husqvarna HUS import

- `.hus` files import from the machine picker and the MCP `document_import_embroidery` tool (format `hus`) as stitch layers, keeping the source bytes like the other machine formats. The thread colours come from the HUS chart of 29 colours, with the chart's name and code on each thread.
- The reader ports pyembroidery 1.5.1's `HusReader` and its `EmbCompress` decoder (a Huffman and back-reference scheme over three streams: commands, x and y). Coordinates are 0.1 mm with y stored negated, as pyembroidery reports them. Trims are a move then a trim; colour changes and the end code follow pyembroidery's handling. Malformed streams (bad codes, offsets out of order, unknown thread index, back-references before the start) are refused with a HUS message.
- Parity: `scripts/hus-reference.py` writes `scripts/hus-parity.json`, one digest per sample (file SHA-256, command counts, thread count, and a SHA-256 of every command and 0.1 mm position) from pyembroidery 1.5.1. `test/readers.test.js` decodes all 15 HUS samples in `fixtures/embroidepy/samples.zip` (MIT, EmbroidePy) and matches every digest.
- Covered by the parity test, an integration test (`test/import-integration.test.js`: thread colours, no placeholder warnings, the layer compiles and encodes to DST), and an e2e test (the picker imports a HUS file as a HUS stitch layer). Screenshot: `design/progress/features/import-hus.png`.
- Limits: import only, there is no HUS export (HUS is not in the export list); no per-stitch metadata beyond the chart; the thread chart is the 29 colours pyembroidery uses, so a thread outside it is refused rather than guessed.

## 2026-10-24 Singer XXX import

- `.xxx` files import from the machine picker and the MCP import tool (format `xxx`) as stitch layers, keeping the source bytes. The reader ports pyembroidery 1.5.1's `XxxReader`: commands from offset 0x100 (a 7F escape for moves, trims and colour changes; 7D and 7E for big jumps), the colour count at 0x27, and the colours after the end code as big-endian 32-bit values.
- Five of the 29 pinned samples have no colour table. Every colour block beyond the table gets a placeholder colour (`#527461`, named Colour 1, 2 and so on), and the layer's source warnings say so. Samples whose colour table is all zeros (pyembroidery reads them as black) keep black.
- Parity: `scripts/machine-reference.py xxx` writes `scripts/xxx-parity.json`. `test/readers.test.js` decodes all 29 XXX samples and matches every digest, and checks the thread count against the colour blocks. `scripts/machine-reference.py` now serves any format; the HUS digests were regenerated by it and are unchanged in content.
- Covered by the parity test, an integration test (`test/import-integration.test.js`: colours from the table, DST encoding; a no-table sample gets one placeholder per colour block and compiles), and an e2e test (the picker imports an XXX file). Screenshot: `design/progress/features/import-xxx.png`.
- Limits: import only; no XXX export; the placeholder colours are not the machine's own.

## 2026-10-24 Barudan DSB import

- `.dsb` files import from the machine picker and the MCP import tool (format `dsb`) as stitch layers, keeping the source bytes. The reader ports pyembroidery 1.5.1's `DsbReader`: a 512-byte DST-style header, then 3-byte records. The control byte gives the command (low five bits 0 for a stitch, 1 for a move; 0xE7 trim, 0xE8 stop, 0xE9 to 0xF7 a needle change, 0xF8 end) and its 0x40 and 0x20 bits flip y and x. Coordinates are read as unsigned bytes, as pyembroidery reads them.
- There is no colour table. Each needle change starts a colour block, and each block gets a placeholder colour (`#527461`, named Colour 1, 2 and so on), reported in the layer's source warnings.
- Parity: `scripts/machine-reference.py dsb` writes `scripts/dsb-parity.json`, and `test/readers.test.js` decodes all 10 DSB samples and matches every digest. The reference maps pyembroidery's needle-change command to `color`, since the editor treats a needle change as a colour change.
- Covered by the parity test, an integration test (`test/import-integration.test.js`: one placeholder per colour block and a DST encoding of the SpiralBox sample, which is the same design as the PES sample), and an e2e test (the picker imports a DSB file). Screenshot: `design/progress/features/import-dsb.png`.
- Limits: import only; no DSB export; the first pinned sample in the corpus has a single stitch, so the screenshot and integration test use the SpiralBox sample instead.

## 2026-10-24 Barudan DSZ import

- `.dsz` files import from the machine picker and the MCP import tool (format `dsz`) as stitch layers, keeping the source bytes. The reader ports pyembroidery 1.5.1's `DszReader`. It has the DSB header and 3-byte records, but the bytes are y, x, control; the control codes are 0x82 stop, 0x9B trim and 0x83 to 0x9A needle change, and the file has no end code (it stops at the last whole record).
- The colour blocks share DSB's placeholder rule: one placeholder colour per needle change block, reported as a warning when there is more than one block. The two readers share the helper.
- Parity: `scripts/machine-reference.py dsz` writes `scripts/dsz-parity.json`; `test/readers.test.js` matches all 10 DSZ samples. Covered by the parity test, an integration test (the SpiralBox DSZ: placeholders per block and a DST encoding), and an e2e test (the picker imports a DSZ file). Screenshot: `design/progress/features/import-dsz.png`.
- Limits: import only; no DSZ export; placeholder colours are not the machine's own.
