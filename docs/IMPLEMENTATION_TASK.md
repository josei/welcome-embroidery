# Authorized implementation task

User authorized implementation on 2026-10-05. Planning/design approval gates in earlier documents are now satisfied: build and validate autonomously, without asking for routine choices or manual validation. Work in the repository root. Preserve the user's design and existing fixtures.

## Assignment

Implement Welcome Embroidery in one sustained run with GPT-6-Luna through Paseo. Read README.md, docs/PLAN.md, ARCHITECTURE.md, DESIGN.md, FIXTURES.md, and design/index2.html. The refined index2 layout is the UI reference, not an app to ship with mock controls. Plans define the broader product; prioritize a complete usable browser + MCP workflow first, then close remaining scope with explicit evidence. Never describe unimplemented behavior as shipped.

The user-defined success condition is: open a Cloudflare URL without installing anything, make quick embroidery designs, obtain real stitch files, and have an AI agent create a design through the exposed MCP. The supervising agent will independently verify and launch the public tunnel. Prepare the server and deployment commands; avoid launching a competing tunnel.

## Non-negotiable behavior

- Userless: no login, accounts, avatars, auth, tokens or OAuth setup. Open/save local project files. No room sharing or multiplayer relay.
- All manual browser editing, digitizing, preview and JEF/VP3 export works from static assets, without a processing server. Bundle required runtime/fonts; no mandatory CDN. A Node service may provide MCP, session routing, headless jobs and serve assets.
- Reproduce pinned Ink/Stitch/pystitch behavior. Prefer reuse over inventing simplistic embroidery algorithms. Distinguish SVG geometry, editable embroidery objects, compiled stitch plans and machine encoding. Density, underlay, compensation, order, jumps/trims and lettering must have real effects in supported workflows.
- Usable vector editor: draw/edit paths and basic shapes, select/move/resize/rotate/delete/duplicate, undo/redo, local save/open, thread/stitch settings, actual preview/simulation and exported files. Supported SVG import and editable digitized lettering with an audited bundled font. Unsupported cases yield clear actionable errors.
- Reuse actual licensed Ink/Stitch embroidery fonts, not a fake claim that system-font outline text is a bundled embroidery font. Track upstream notices, pins and code modifications; choose GPL-3.0-or-later for derived application code and preserve per-font/dependency notices.
- Browser compile must be real and responsive (worker). Use a measured extraction/Pyodide path or justified port. A native Python reference in automated tests is allowed; mandatory server-side compile for manual browser usage is not.
- Native editable project is lossless for supported application features. JEF and VP3 first; import/export compatibility tested against public corpus and reference codec. EMB remains a separate intended compatibility track; do not claim support without implementation/evidence.
- Same semantic operations used by UI and MCP. Expose actual MCP initialize/list/call over supported Streamable HTTP and optional stdio; use official SDK. Support create/inspect/edit/compile/preview/export/save. Provide resource/artifact URLs and a way to open an MCP-created project in the browser. Support live document connection if planned without shared rooms. No arbitrary shell/code tools.
- Self-host service serves built assets and MCP. Restrict filesystem exposure to public assets and intentionally created artifacts. Cloudflare URL origin discovery must work with a random HTTPS host. Prefer JSON HTTP MCP responses for tunnel compatibility, and a browser bridge compatible with the selected tunnel.
- macOS packaging/shared app architecture and optional self-host artifacts remain in scope. Do not fake macOS build/signing evidence on Linux. Implement feasible source/package parts and report platform-dependent checks precisely.

## Autonomous verification

Zero humans in the loop. No sew-outs, requests for machine owners, manual Wilcom checks, or user-supplied files required. Use fixtures/embroidepy/samples.zip and its manifest/license; begin with 24 JEF + 19 VP3 samples. Reference tests are pinned in docs/FIXTURES.md. Avoid the false proof of only round-tripping your own writer through your own reader.

Automated acceptance evidence must cover:
1. Fresh install/build/typecheck and meaningful tests passing.
2. Playwright on the actual app: draw shapes and lettering, change settings, move objects, undo/redo, save/reopen, preview, download JEF/VP3. Inspect screenshots against index2.
3. Downloaded files decode using pinned upstream reference, with expected dimensions, commands, threads and nonempty stitch content. Corpus read parity and deterministic synthetic writer comparisons; diagnose discrepancies rather than silently ignoring fixtures.
4. Browser core works with backend unavailable after static runtime assets load; no hidden HTTP compile dependency. No network font/CDN dependency.
5. Real MCP client initialize/tools/list/tools/call produces a distinct design, compiles and exports it, downloads artifacts, and opens the editable source in browser. Test through public tunnel later with supervisor.
6. Error handling: malformed projects/SVG, out-of-hoop or unsupported exports, stale revision, cancellation, missing resources; no console errors on normal path.

Use installed tools and public downloads; request necessary sandbox escalation through the tool mechanism, not repeated user questions. Keep changes inside this repo and task-specific temporary paths. Do not modify Pigma, unrelated agents, global settings, or credentials. Do not push/merge unless separately authorized. You may inspect Pigma for reusable MIT patterns but it is WIP.

## Reporting and persistence

Maintain docs/IMPLEMENTATION_STATUS.md with implemented features, exact commands/tests/results, outstanding gaps, runtime decisions and how to launch. Make real artifacts early and keep working after an initial scaffold. Do not end with just a plan, mockup, or 'next steps'. The supervisor will check independently and return concrete gaps. Upon finishing or hitting an external blocker, notify supervisor Paseo agent `f64b3bf7-523c-4e02-ae8e-c657ff77ea06` using `paseo send --no-wait` with concise evidence. This notification is explicitly authorized as part of delegation. Do not mark the whole product complete while outstanding gaps remain.
