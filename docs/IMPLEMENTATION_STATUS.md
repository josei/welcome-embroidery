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
- Editable hoop: any width × height from 10 to 400 mm (sidebar fields, no presets by decision, last size remembered in browser storage for new documents, undoable; MCP `document_create` `hoop`/`hoopHeight` and `set_hoop`). The canvas, overflow diagnostics, align-to-hoop and viewBox follow it. Neither format limits the hoop: the JEF header is written like pinned pystitch/pyembroidery (the Ink/Stitch reference), where the hoop code comes from the design's size (<50×50 mm → 1, <126×110 → 3, <140×200 → 2, <200×200 → 4, else 0; codes 0=110×110, 1=50×50, 2=140×200, 3=126×110, 4=200×200) and the four hoop-edge distance sets are copied from it. `scripts/verify-jef-header.mjs` checks header bytes 24–115 against pystitch's `write_jef` for six design sizes. The selected hoop is only used for Welcome's own overflow check. `hoopH` is optional in `.welcome`; omitted means square.
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
- **Fonts from your own files**: any TrueType `.ttf` (glyf outlines; CFF `.otf`, WOFF and collections are rejected with a message) can be loaded in the picker; its Basic Latin/Latin-1 glyphs are stored in the project (`customFonts`, ≤ 8 fonts of ≤ 400 glyphs), so the file is not needed again. Check the font's licence before sharing designs.
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
