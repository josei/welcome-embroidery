# Research notes

Reviewed 2026-10-04. Upstream `main` links are evidence for planning, not reproducible dependency pins. Record actual commits/checksums before reuse. No upstream code or fonts were copied during this review.

## Pigma in the local workspace

The user confirms Pigma is WIP. The observations below describe one inspected checkout, not a stable upstream contract. Use its intended release model and reassess reusable code at implementation time.

Read `pigma/package.json`, `README.md`, `docs/DESKTOP.md`, `docs/SELF_HOSTING.md`, `docs/MCP.md`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, and the service wiring in `server/deployment.ts`.

| Finding | Consequence for Welcome |
| --- | --- |
| React/TS/Vite editor, SVG canvas, MIT project license | Reusable implementation patterns; retain MIT notices for any copied code |
| Tauri 2 config targets `.app` and `.dmg`, with frontend `dist/` | Good match for the requested macOS distribution |
| Desktop asset manifest, cache, hashes and rollback code | Reuse the approach after validation; add authenticated manifest and shell/core compatibility design |
| Shared MCP stdio and HTTP transport surfaces and deployment capability config | Useful structure to adapt around Welcome's embroidery document commands |
| MCP live editor bridge exists separately from room collaboration | Welcome still needs a command bridge for live browser edits, even with no room relay |
| Self-host entry is coupled to room relay/snapshots | Build a smaller service entry with static assets, MCP and document-session routing only |
| Desktop docs describe a bundled server; inspected `main.rs` reports endpoint metadata but has no MCP process launch | Treat desktop service lifecycle as required new work; do not claim the Pigma wrapper already supplies it |
| Desktop source comments explicitly flag unverified Rust/Tauri compilation | Verify the actual packaged app on macOS, including signing/notarization and offline MCP |

This is a targeted source review, not a full Pigma audit. No Pigma tests or packaging were run, and deployment availability was not tested.

## Ink/Stitch and codecs

[Ink/Stitch](https://github.com/inkstitch/inkstitch) is an Inkscape extension with GPL licensing. Its [feature page](https://inkstitch.org/features/) specifies GPL version 3 or later. Proposed application license: GPL-3.0-or-later to accommodate direct adaptations, with upstream attribution, modification records and corresponding source in releases. Finalize exact notices against pinned source files before importing them.

The [current project dependency file](https://github.com/inkstitch/inkstitch/blob/main/pyproject.toml) includes Python, inkex, wxPython, Shapely, NumPy and lxml. This makes browser reuse an extraction/porting problem, not merely a package installation.

The former Ink/Stitch `pyembroidery` URL redirects to [pystitch](https://github.com/inkstitch/pystitch); Ink/Stitch currently depends on `pystitch`. Its [license](https://github.com/inkstitch/pystitch/blob/main/LICENSE) is MIT. Keep the distinction between stitch generation and stitch-file encoding: adopting a codec does not supply satin/fill digitizing.

[Ink/Stitch's format matrix](https://inkstitch.org/docs/file-formats/) lists JEF and VP3 among writable formats; SEW, EMD, PCS and other older formats appear in its read list without equivalent write support. Do not infer that importing a brand's format implies it can be exported or used on every model.

## EMB

The user explicitly raised `.emb` compatibility. [Wilcom's format documentation](https://docs.wilcom.com/embroiderystudio/28/en/OnlineHelp/Management/formats/formats-5.htm) describes both object outlines/settings and stitch data, with format variants. Its [API documentation](https://apiguide.wilcom.com/documents/api-interface-specification/) calls EMB proprietary and documents a web service capable of manipulating it. These describe semantics and an integration option, not an open binary-format specification.

The [Ink/Stitch format matrix](https://inkstitch.org/docs/file-formats/) does not list EMB. No usable open EMB reader/writer was verified in this review. Investigate version-specific local parsing with publicly available, suitably licensed sample files, keep read and write milestones separate, and publish per-feature fidelity. A Wilcom service dependency would not meet the browser's local/offline requirement. See the [EMB compatibility track](PLAN.md#emb-compatibility-track).

## Fonts

[Ink/Stitch's font creation guide](https://inkstitch.org/tutorials/font-creation/) describes `font.json`, glyph SVG layers/direction variants and per-font license files. Treat these as digitized geometry and stitch instructions, not ordinary TTF files. Preserve stitch order, rails, commands, glyph metrics and size constraints during conversion.

Use a small starter set only after checking each font's license, attribution, glyph coverage, size limits and unsupported Ink/Stitch features. Retain any source-font notices. The [embroidery-fonts repository](https://github.com/inkstitch/embroidery-fonts) is the asset starting point; individual license auditing has not been performed. Proposed font packs must work locally and remain versioned with the project/compiler.

## Machine compatibility

JEF and VP3 are provisional targets, not blanket brand support.

- An [Elna manual](https://global.elna.com/wp-content/uploads/sites/3/2025/11/ML_E_819T_EN_819800033_R2.pdf) distinguishes JEF, JEF+, JPX and other supported file variants. This demonstrates why exact model documentation matters; it does not identify the user's machine.
- Manufacturer software documentation identifies [VP3 with Husqvarna Viking/Pfaff](https://softwarehelp.mysewnet.com/ECQ/help/mac/10/Topics/File_Formats.htm). A model's accepted format, hoop limits, command interpretation, media layout and filename constraints still need confirmation.

For each supported profile record manual URL/version, physical hoop versus sewing area, format variant, coordinate placement, color/trim behavior, stitch limits, and known-good examples. Keep native editable project data separately from exported machine stitches. Validate against public fixtures and pinned Ink/Stitch/pystitch behavior with fully automated tests. No physical load/sew-out certification or human validation is required.

## Browser and MCP references

[Pyodide documents Python in a Web Worker](https://pyodide.org/en/stable/usage/webworker.html). That supports the proposed runtime experiment but proves neither Ink/Stitch dependency compatibility nor acceptable performance.

The published MCP [transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) specification guides the endpoint design. Pin the SDK/protocol during implementation and test actual clients. Browsers initiate outbound connections; a static asset distribution does not itself provide a public server endpoint.

## Product correction — 2026-10-05

The user specifies a userless app with no auth, opening local files. Earlier OAuth/token proposals are superseded, not implementation requirements. The user-refined `design/index2.html` is the current UI reference; the header should identify the local document and contain no user avatar or name.

## Validation correction — 2026-10-05

The user requires zero humans in the development/validation loop. Manual Wilcom checks, machine access and physical sew-outs are not release gates. Ink/Stitch/pystitch is the software reference for its supported formats. Use public reference files and automated comparisons; see [fixture research](FIXTURES.md).
