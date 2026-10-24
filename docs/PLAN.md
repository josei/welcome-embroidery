# Welcome Embroidery — product and delivery plan

Updated 2026-10-18 — the first usable release described below now largely exists; see IMPLEMENTATION_STATUS.md for what was built, what is verified and what remains (EMB, signing, real-machine testing)

## Product

Welcome is a vector editor that understands how designs are sewn. A person or AI agent can draw shapes, edit curves, compose lettering, choose stitch behavior, inspect the sewing sequence, and export a design for a supported embroidery machine. The ambition is an open-source alternative to Wilcom; the first release is a useful, narrower digitizing workflow, not a claim of Wilcom feature parity.

The interface should feel familiar to people using Figma, Sketch, or Miro: direct manipulation, contextual properties, clear selection, keyboard tools, and space for the work. Embroidery is part of the document from the start, rather than a final file conversion.

## Established requirements

- Browser editor distributed entirely as static assets. Drawing, digitizing, lettering, preview, saving, and machine export run locally without a processing backend.
- Userless app: no accounts, login, registration, profiles, user avatars, or authentication flows. This applies to the editor and planned MCP surfaces.
- Local files are the primary document workflow: New, Open, Save, Save As and machine Export. The header identifies the current document, never a person.
- The user-refined `design/index2.html` is the current visual reference.
- A macOS application using the same editor, plus native file access and local MCP.
- Optional self-hosting, including MCP, using the same release artifacts.
- Online MCP that lets an agent produce and revise embroidery designs.
- Vector drawing and lettering first; no automatic bitmap digitizing in the initial scope.
- Reuse suitable Ink/Stitch algorithms and embroidery fonts, respecting their individual licenses.
- Include Wilcom `.emb` compatibility as a product goal, with separate import, editable-object fidelity and export milestones gated by feasibility.
- No shared rooms, multiplayer presence, collaboration synchronization, or room relay.
- Zero humans in the development/validation loop: no manual Wilcom checks, user-supplied samples, machine access or physical sew-outs as release gates. Use automated reference comparisons and fixture corpora.
- For formats supported by Ink/Stitch, reproduce a pinned Ink/Stitch/pystitch implementation rather than inventing new machine behavior.
- Plans and interface designs before application implementation.

## Recommended first usable release

| Area | First usable release |
| --- | --- |
| Drawing | Pen and Bézier nodes; open/closed paths; rectangles/ellipses; move, scale, rotate, duplicate, align, group; basic union/subtract; undo/redo; snapping and mm rulers |
| Import | A documented SVG subset: paths, shapes, groups, transforms, holes, fills and strokes; explicit report for unsupported features |
| Digitizing | Running and repeated running stitches; manually defined satin columns with rails/rungs; tatami fills with angle and holes; underlay, pull compensation, stitch length and spacing |
| Sequence | Explicit object sewing order, thread blocks, start/end points, jumps, trims, tie-in/tie-off, color changes and stops subject to machine capabilities |
| Lettering | A small audited set of digitized fonts; editable text, spacing, alignment and line height; missing-glyph and supported-size feedback |
| Lettering | Organize fonts: list the custom fonts in a document with the lettering that uses them, and remove the ones no lettering uses (Ink/Stitch 3.3 Organize Glyphs, the same idea) | Built (basic; custom fonts only) |
| Lettering | Vertical lettering: one letter under another, centred on the lettering's x position, at the line height (one line, bundled or loaded TrueType font, not on a path) | Built (basic; the vertical column is not fitted to the hoop) |
| Preview | Vector view, actual generated stitch paths, stitch-by-stitch playback, jump/trim overlays, counts and issue navigation |
| Files | Open/save local versioned `.welcome` projects; local SVG import; Save As; machine export; thread list and printable sewing worksheet |
| Machines | JEF and VP3 first; automate parity with pinned Ink/Stitch/pystitch behavior and documented hoop/format profiles |
| Automation | Same validated operations for UI and MCP; create/edit/inspect/compile/export; live editor and headless document sessions |
| Distribution | Static web bundle, signed/notarized macOS app/DMG, self-host container, standalone MCP CLI |

Stitch behavior must be explicit. A colored vector shape is not automatically a successful embroidery design. Resizing should regenerate stitches from geometry and parameters; scaling a precomputed stitch stream is a separate, limited operation.

Fabric presets may provide starting values, but cannot certify sewing quality. Numerical values in the interface concept are examples, not recommended settings for a particular fabric.

## Defer until the core is useful

Automatic photo/bitmap digitizing, photostitch, automatic outline-to-satin conversion, advanced motif/gradient fills, appliqué workflows, multi-hoop splitting, curved lettering, broad machine-format coverage, font marketplaces, cloud project libraries, and direct machine control.

## EMB compatibility track

EMB is an explicit compatibility goal. Wilcom describes it as containing editable objects/settings as well as generated stitches; it has multiple versions. It therefore needs its own feasibility track alongside browser digitizing. [Wilcom format documentation](https://docs.wilcom.com/embroiderystudio/28/en/OnlineHelp/Management/formats/formats-5.htm).

1. Inventory relevant EMB versions and assemble publicly available, suitably licensed fixture corpora of simple shapes, lettering, underlay, manual stitch edits and unsupported advanced objects. Determine what an open implementation can decode locally.
2. Prove read/import for named versions: first any reliably recoverable preview/stitches/threads, then editable paths, stitch properties and lettering. Report fidelity per object; stitch-only recovery must never be presented as editable-object import.
3. Develop export as a separate milestone for a declared subset/version, validated using public cross-format reference files, decoded object/stitch expectations and any available automated reference tooling. No manual Wilcom operation or assumed access to proprietary software is required. Import success does not imply a working writer or a lossless round trip.
4. Expand version/object coverage using documented fixture results. Preserve the original file; report unsupported objects rather than silently dropping them. Keep `.welcome` as the fully editable native format.

Ink/Stitch's published format matrix does not list EMB, so this is not covered by adopting its codecs. Wilcom offers an EMB-capable web API, but depending on it would not fulfill local/offline static-browser compatibility. No working open EMB parser or writer has been established in this planning pass. Full support has no release commitment until the feasibility evidence exists. [Ink/Stitch formats](https://inkstitch.org/docs/file-formats/), [Wilcom API](https://apiguide.wilcom.com/documents/api-interface-specification/).

A useful later image feature is a locked reference image for manual tracing. It would not generate stitches. The core renderer can still produce raster screenshots for previews and MCP; this is distinct from turning a bitmap into embroidery.

## Vector-editing roadmap (decided 2026-10-09, built the same day)

| Item | What it means for embroidery | Status |
| --- | --- | --- |
| Per-node stroke widths | A width profile along a satin path (`widthStops`), set at a selected node in the editor or with `set_width_at_node`; smooth between nodes | Built. Stops are positions along the path's length, so editing nodes does not break them |
| Stroke cap and join options | Flat, round or square ends; round, mitered or bevelled corners, with a fan of needles around the inner corner (mitres fall back to bevels where the needle span would exceed 11.5 mm). Satin borders use the join | Built |
| Clipping masks | Fills are intersected with the mask outline exactly; satin, running stitch, lettering and borders are cut where they leave the mask. The mask is not sewn and follows edits; deleting it releases the objects | Built |
| Snapping to other objects while drawing | Nodes, segment midpoints, centres and the nearest point on any other outline, within 9 screen pixels, with a marker; toggle next to the grid snap | Built |
| Gradients | Thread cannot blend, so the supported form is a dithered two-thread blend over a rows fill (`blendThread`, from/to %), shown as a gradient in the editor | Built as a colour blend fill. Smooth vector gradients are not a goal |

Open follow-ups: none in this roadmap; mask nodes and handles are edited in place with a live cut preview.

## Long-term roadmap: Wilcom feature parity (proposed 2026-10-20)

Reference: Wilcom EmbroideryStudio, the commercial digitizing suite. Its feature set is taken from [Wilcom's EmbroideryStudio pages](https://www.wilcom.com/e42), its [help on lettering stitch types](https://docs.wilcom.com/embroiderystudio/28/en/OnlineHelp/Lettering/lettering_advanced/lettering_advanced-7.htm), its [motif and sequin modules](https://docs.wilcom.com/embroiderystudio/27/en/OnlineHelp/Release/elements/elements-1.htm) and [Swing Design's feature summary](https://www.swingdesign.com/products/wilcom-embroiderystudio-decorating-software-2026-full-license). EMB stays out of scope under the standing rules.

| Area | Feature | Welcome status |
| --- | --- | --- |
| Digitizing | Running, satin, tatami and fill stitches with underlay and pull compensation; satin pull set separately on the left and right rails | Built |
| Digitizing | Raised fill: an extra tatami underlay at 2 mm rows under a fill, so it stands up | Built (basic; same 90° as the fill underlay) |
| Digitizing | Accordion spacing: a tatami fill whose row spacing changes linearly from a start to an end value (Wilcom's Accordion Spacing behaviour; Wilcom's placement algorithm is not published) | Built (basic; linear gradient only, rows pattern) |
| Digitizing | SVG import: a stroke-only path with a stroke width of 0.3 mm or more becomes a satin column of that width (Ink/Stitch 3.3's simple strokes as satin) | Built (basic; import only) |
| Digitizing | Satin end inset: the first and last needle of a satin column move inward, so the end stitches are shorter; a start and an end value (Ink/Stitch's short stitch inset) | Built (basic) |
| Digitizing | Fabric presets (woven, knit, towel or fleece) that set pull compensation, stitch length, stagger and underlay for the document | Built (basic; three presets) |
| Digitizing | Laydown underlay for towelling and fleece: a light fill at 4 mm rows under a fill (fills only; satin has no closed area to cover) | Built (basic) |
| Digitizing | Fill patterns: contour, spiral, meander, guided, cross, ripple, sequin fill (sequins on a staggered grid), bling fill (bling stones on a staggered grid) | Built |
| Digitizing | Appliqué, bean run, run length variation | Built |
| Digitizing | Multi-colour blends and gradients (Wilcom Multi Blend) | Built (up to five colours) |
| Digitizing | Clipping masks and holes | Built |
| Digitizing | Snap to objects and guides | Built |
| Digitizing | Continue digitizing from a closed object without starting a new one | Built |
| Digitizing | Auto-digitizing from artwork (shape detection, stitch assignment, underlay) | Partial (raster tracing and photo stitch) |
| Lettering | Fonts with satin, fill and run lettering, text on a path | Built |
| Digitizing | Satin raised effects (thick underlay under the satin) | Built |
| Lettering | Program split fills for lettering (tiled needle phases, via Needle stagger on fills, including lettering) | Built |
| Motifs | Motif loops repeated along a path (first step: fixed loops every 4 mm) | Built (basic) |
| Motifs | Paired motif loops that follow column widths (one loop each side at the satin width) | Built (basic) |
| Motifs | Motif fill: loops on a staggered grid inside a closed shape | Built (basic) |
| Motifs | Motif warp along a tapered column: paired loops follow the satin width, including its end width | Built (basic) |
| Motifs | Motif shape warp: leaf loops whose long axis follows the path (a surface-style warp; no true 3D surface) | Built (basic) |
| Motifs | Motif size warp across a fill: loops shrink from one edge to the other (a pseudo-depth cue, not a 3D surface) | Built (basic) |
| Motifs | Motif size warp along a path: loops shrink from the start of the path to the end (a pseudo-depth cue, not a 3D surface) | Built (basic) |
| Motifs | True 3D surface warp of motifs | Not started |
| Embellishment | Sequins as a stitch type: a centre stitch with a fixing loop every few mm, single or in side-by-side twins (no dispensing control) | Built (basic) |
| Embellishment | Beads as a stitch type: a dash across the path at each point, or a dot (a small round bead) with the dash/dot shape setting; twin beads sew a second one either side of the centre line (basic beading; no bead-shape or dispensing control) | Built (basic) |
| Embellishment | Bling as a stitch type: a stone at each point, a centre stitch with two fixing rings; Round, Square, Oval, Hexagon, Star or Heart stone shape, with one or two fixing rings; the oval and the heart always turn with the path, and square, hexagon and star turn with it by default (Turn stones with the path); no other settings or library | Built (basic) |
| Embellishment | Redwork (out-and-back run), and a redwork outline that follows a closed shape in one step | Built |
| Embellishment | Buttonholes (satin with bar tacks at both ends) | Built |
| Sequencing | Object order, start and end points, jumps and trims | Built |
| Sequencing | Batch planning: copies that fit one hoop and hoops needed (no separate hoop files yet) | Built (planner) |
| Sequencing | Name drop: a batch export with one name per line, each copy's first lettering set to the next name | Built (basic; first lettering only) |
| Sequencing | Batch export: one file per hoop in JEF, VP3, DST or SEW (copies laid out on the batch grid, imported machine files included) | Built (JEF, VP3, DST, SEW; imported layers re-encoded per hoop) |
| Preview | 3D preview and stitch playback | Built |
| Files | JEF and VP3 export and import, DST import and export, SEW import and export, PEC, PES and EXP import | Built |
| Files | EXP (Melco) export and import | Built (export checked by decoding with pyembroidery; import checked against all 35 pinned samples; placeholder colours) |
| Files | PEC (Brother) export and import | Built (export checked by decoding with pyembroidery; import checked against all 25 pinned samples) |
| Files | PES (Brother) import, all versions 1 to 10: the PEC block at the offset in bytes 8-11 | Built (import checked against all 73 pinned samples; JEF export refuses samples with steps over 12.7 mm) |
| Files | PES (version 1) export | Built (export only; checked by decoding with pyembroidery) |
| Files | PES version 6 export | Built (export only; checked by decoding with pyembroidery; thread names omitted) |
| Files | SEW (Janome native) export and import | Built (export checked by decoding with pyembroidery; import checked against all 15 pinned samples; trims not written, no design header) |
| Files | Print template: a 1:1 millimetre SVG placement sheet of the hoop with the design outline, a centre cross and a 10 mm scale bar | Built (basic; not a printer calibration) |
| Files | Hoop presets: Brother 4×4, 5×7 and 6×10 hoops plus the default, chosen from the footer | Built (basic; sizes checked against Brother and retailer listings, see the hoop status entry) |
| Files | ASCII DXF import: LINE and LWPOLYLINE entities become paths (millimetres, y flipped, centred on the hoop); other entities are reported as skipped; binary DXF refused | Built (basic; no arcs, text or layers) |
| Files | ASCII DXF export: each visible object's outline as LINE or LWPOLYLINE (millimetres, y flipped back to y-up); stitch layers skipped and counted | Built (basic; outlines only, no layers, no arcs or splines) |
| Files | Husqvarna HUS import (read-only): stitches and the HUS thread chart, checked against 15 pinned samples | Built (import only) |
| Files | Singer XXX import (read-only): stitches and the colour table, checked against 29 pinned samples | Built (import only; placeholder colours where the table is missing) |
| Files | Barudan DSB and DSZ import (read-only): stitches and needle changes, checked against 10 pinned samples each | Built (import only; placeholder colours per colour block) |
| Files | Other machine formats | Not started |
| Libraries | Thread brand libraries | Not started (licensed data) |
| Automation | Headless MCP document sessions for agents | Built |

## Roadmap status (decided 2026-10-21)

Everything in the feature list is built, partly built, or deliberately out of scope. What remains open, and why it is not built here:

- Closing edge stitches on clipped run and satin objects: built as an opt-in setting (Close edges at the mask); off by default until a sew-out check.
- Thread brand libraries: licensed data; out of scope.
- Several live document slots per agent link: would broaden agent permissions; out of scope.
- A real Safari device check: needs a device.
- macOS and Windows desktop builds: built by CI (`desktop.yml`) on a tag or a manual run. The manual run on `036109f` passed on Linux, macOS and Windows (run 40035382088), after the Windows npm fix.
- Bling stone library: Round, Square, Oval, Hexagon, Star, Heart, Teardrop and Baguette are built, with turn and fixing rings as settings. More shapes and a true 3D surface warp are not started.

## Desktop app roadmap (Tauri, proposed 2026-10-20)

Decided: Tauri replaces Electron for desktop packaging.

| Item | What it means | Status |
| --- | --- | --- |
| Tauri shell | The app starts the bundled Welcome server (Node, on a free 127.0.0.1 port) and opens its window at that address; if Node or the server is missing it falls back to the bundled static editor. The Linux build is tested here. | Built (Linux tested) |
| CI builds | GitHub Actions builds the Linux app (tested here) and the macOS and Windows bundles; macOS builds stay unsigned | Proposed |
| Local MCP | The MCP server runs on the user's machine through the local server, bound to 127.0.0.1; per-tab token links stay revocable; no anonymous MCP. Decision: The desktop bundle includes the Node runtime of the build machine (per platform, from CI); the system Node is used only if the bundled one is missing. | Built (Linux tested; bundled Node) |
| Repository hygiene | Desktop build output is never committed; CI artifacts carry the bundles | Proposed |

## Essential user journeys

0. **Open a local design:** choose a file from the device → validate and load locally → edit → Save or Save As. New documents start untitled. Browser recovery is separate from saving the actual file.
1. **Draw a badge:** choose a documented machine/hoop → draw/import vectors → assign stitch types and threads → adjust sewing order → inspect stitches → export and sew.
2. **Create lettering:** choose a digitized font → type and size in mm → check glyph/size support → arrange with shapes → regenerate → export.
3. **Work with an agent:** enable access for a document → agent reads its constraints → applies a coherent edit → user sees the result and can undo it → compile and inspect → export the exact reviewed revision.
4. **Work offline:** open a cached web installation or bundled desktop app → edit, preview, and export using bundled assets → recover the last autosave. Optional font packs must clearly indicate whether they are available offline.

## Delivery gates

These are ordered by dependency, not calendar promises. A polished mockup is not evidence of embroidery correctness.

| Gate | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 — Product/design review | This plan, clickable workspace concept, machine shortlist, license direction | Workspace and scope recorded; documented format/hoop defaults; outstanding choices recorded without requiring machine ownership |
| 1 — Browser and compatibility feasibility | Small worker-based compile experiment; upstream dependency/license inventory; one audited font conversion; JEF/VP3 encoding experiment; EMB version/fixture and parser investigation | Offline browser produces files from a running path, satin column, fill with a hole, and lettering; independent file decoding; measurements of load, memory, compile and cancellation; explicit engine decision; separate EMB feasibility report |
| 2 — End-to-end slice | One editable badge with lettering, native save/reopen, stitching, export, minimal MCP create/inspect/compile/export | Same design via UI and MCP; exact source revision attached to exports; automated JEF/VP3 reference comparisons on the public fixture corpus |
| 3 — Usable digitizing | Vector editing, sewing order, property inspector, font browser, diagnostics and playback | Representative fixture corpus; hole handling, short stitches, overlap and density review; undo/recovery; keyboard and browser acceptance checks |
| 4 — Distribution/MCP parity | Static bundle, online service, macOS package, self-host image and CLI | Offline core workflow; installed desktop starts/stops its MCP process without system Node/Python; anonymous document-session routing/disconnection; clean self-host setup; signing/notarization verified on macOS |
| 5 — Public beta | Documented limits, fonts/notices, examples, compatibility matrix and reproducible releases | Passing automated compatibility corpus, tested migration/recovery, release checksums and source artifacts; no unsupported “all Elna/Pfaff” claim |

Gate 1 starts only after this planning/design iteration. Do not quietly make server-side digitizing the fallback for a browser engine that fails its gate.

## Quality criteria

- Every generated stitch traces back to its source object, document revision, parameters, engine version, font version, and machine profile.
- Export validates the quantized, encoded result as well as the unencoded stitch plan: hoop bounds, finite coordinates, stitch/jump limits, commands, thread changes, and file structure.
- Fixed inputs generate repeatable stitches. If a format embeds time, normalize it in comparisons and record it separately from geometry.
- Tests compare against pinned Ink/Stitch/pystitch outputs and licensed public fixtures, with additional decoder checks where available. Our own writer/read-back is supplementary. No physical sewing or human review is required; the claim is software parity against the specified reference.
- Freeze reference versions, format settings, random seeds and font versions. Compare byte output where deterministic; normalize only documented volatile fields and otherwise compare decoded commands, coordinates, threads and metadata. Keep intentional format losses explicit.
- Browser responsiveness is measured while compiling. Cancellation and outdated-result rejection are required.
- Measured baseline (2026-10-22, Node 24 on the build machine, `npm run bench:compile`): 100 filled squares of 12 mm, 26,463 stitches, compile 126 ms, JEF encode 10 ms, heap 13 MiB; 100 filled squares of 34 mm, 145,700 stitches, compile 206 ms, JEF encode 33 ms, heap 45 MiB.
- Measured browser baseline (2026-10-23, headless Chromium on darwin arm64, `npm run bench:browser`, the app's stitch worker, median of 5): 100 filled squares of 12 mm, 26,463 stitches, compile 51 ms, compile + JEF 55 ms, longest main-thread gap 6 ms; 100 filled squares of 34 mm, 145,700 stitches, compile 119 ms, compile + JEF 143 ms, longest main-thread gap 6 ms. Measured WebKit baseline (2026-10-23, same machine and fixtures, idle, median of 5, driven by Playwright-core 1.58.2 against the frozen macOS 14 WebKit build (Playwright 1.63 cannot open a page in it); see the 2026-10-23 WebKit entry in `docs/IMPLEMENTATION_STATUS.md`): 12 mm squares, 26,463 stitches, compile 52 ms, compile + JEF 54 ms, longest main-thread gap 9 ms; 34 mm squares, 145,700 stitches, compile 128 ms, compile + JEF 140 ms, longest main-thread gap 10 ms. JS heap is not reported by WebKit. This is not Safari on a device.
- Proposed benchmark: ordinary badges around 20k stitches and stress designs around 100k. Establish actual load/memory/time budgets during Gate 1 on named hardware, including Safari; no unmeasured performance claims.
- Export blockers include invalid geometry/numbers, unsupported commands without an accepted conversion, and stitches outside the selected sewing area. Advisories include unusually short stitches, risky density, long travel, and lettering outside its digitized size range.

## Decisions

| Decision | Status (2026-10-18) |
| --- | --- |
| Elna and Pfaff profiles | Decided: defaults come from public manuals and upstream behaviour (`docs/RESEARCH.md`); user model names may refine coverage later |
| License | Decided: GPL-3.0-or-later for the application (`LICENSE`), with third-party licence files kept alongside |
| Browser stitch runtime | Decided: an original JavaScript compiler runs in the browser, with no Pyodide worker; exports are checked by decoding with pinned pyembroidery. Move to WASM or ports only if a measured budget fails |
| Desktop packaging | Decided: Tauri, built in GitHub Actions for Linux, macOS and Windows; the Linux build is tested locally, macOS bundles stay unsigned. Electron is retired (`desktop/electron/` is gitignored and not maintained) |
| Desktop asset updates | Decided: deferred. The desktop app ships its bundled assets; the signed-manifest update path in `docs/RESEARCH.md` is outside the first release |
| Online MCP sessions | Decided and built: a paired live tab through revocable per-tab token links, plus isolated headless document sessions; no hosted persistent library |
| Visual direction | Decided and built: warm neutral canvas, restrained teal accent, thread colours in the artwork |

The next implementation proposal should follow the review with a small feasibility experiment and its pass/fail criteria, not a scaffold for the entire feature list.
