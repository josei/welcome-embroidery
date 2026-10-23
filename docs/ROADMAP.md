# Operational roadmap (Paseo heartbeat queue)

This file is the working queue for the automated build loop: a supervisor (Claude Sonnet 5, Paseo agent `b01634e5-24da-4d96-9f9d-b14ee6adb2b3`) reviews and refreshes it every 6 hours; a builder (Claude Haiku 5.5) picks the top "Ready to build" item and ships something every hour. The builder is **not** one persistent agent — it's a Paseo schedule (`44e95934`, cron `0 * * * *`) that starts a fresh Haiku agent each hour, because the harness blocks an agent from giving itself a recurring heartbeat. Each hour's agent is stateless and re-reads this file from scratch; that's by design. Strategic scope and decisions still live in `docs/PLAN.md`; detailed build history lives in `docs/IMPLEMENTATION_STATUS.md`. This file only tracks what to build next and what just shipped.

Rules for the builder: always take the top item in "Ready to build" you haven't finished. If it's ambiguous or too big for one hour, scope a complete, tested slice of it yourself — do not wait for a decision. Never leave a heartbeat with nothing shipped. If the queue is empty, pull the next concrete item from `docs/PLAN.md`'s open work yourself, add it here, and build it.

Rules for the supervisor: verify tests actually pass and diffs match commit messages before moving an item to "Done this cycle". Keep at least 4 concrete, unambiguous items queued at all times. Push to `origin/main` only once verified.

## Current preview

- Public URL: https://medications-fred-traditional-align.trycloudflare.com (started 2026-10-23 by the builder: `HOST=127.0.0.1 PORT=8790 node server.js` plus a `cloudflared tunnel --no-autoupdate --http-host-header localhost --url http://127.0.0.1:8790` reverse tunnel; a quick tunnel URL changes if cloudflared restarts).
- Latest screenshot set: `design/progress/features/` (one PNG per feature, see `scripts/feature-shots.mjs`).

## Ready to build

1. **Thread plan export** — the editor shows a thread plan (colours in sewing order with stitch counts) but there is no way to export it as a printable/standalone artifact. Add a "Download sewing worksheet" action (plain text or SVG, listing thread colours, stitch counts, and the sewing-time estimate) available in the UI and over MCP. Engine + e2e test, status entry, screenshot.
2. **Motif warp for paths, not just fills** — the motif size warp shipped 2026-10-23 is scoped to motif fills only (its own commit note says so). Add the equivalent along-the-path warp for motif loops/paired loops on open or closed paths (loops shrink/grow along the path's length instead of across a fill's bounding box), documented as the same pseudo-depth cue, not a real surface. Engine + e2e test, status entry, screenshot.
3. **Batch export for VP3 and DST** — "Export batch" in the Array section currently writes one JEF file per hoop only (`docs/PLAN.md`'s Wilcom-parity table: "Built (JEF only)"). Extend the same batch grid/hoop-splitting logic to also offer VP3 and DST batch export. Engine + e2e test, status entry, `docs/PLAN.md` row update, screenshot.

## Done this cycle — pending supervisor review

_(builder moves finished items here with date, commit hash, and test results; supervisor reconciles into `docs/IMPLEMENTATION_STATUS.md`/this file's history on each 6-hour review)_

- 2026-10-23 — **Bling stone shapes** (commit `412ce6e`, local, not pushed). Round (default) or Square stone shape, `blingShape` in the sidebar and MCP `set_object`. Tests: `npm run test:engine` 106/106 pass; `CI=1 npm run test:e2e` 93/93 pass. Screenshot: `design/progress/features/bling-square.png`. Status entry added to `docs/IMPLEMENTATION_STATUS.md`. Note: the Playwright Chromium build (revision 1243) had to be installed with `npx playwright install chromium` before the e2e suite could run.
- 2026-10-23 — **Motif size warp across a fill** (commit `6e0c5b0`, local, not pushed). Loop size warp None, Left to right or Top to bottom on motif fills: loops shrink to 40% at the far edge, a pseudo-depth cue (not a 3D surface). Tests: `npm run test:engine` 108/108 pass; `CI=1 npm run test:e2e` 95/95 pass. Screenshot: `design/progress/features/motif-fill-warp.png`. Status entry added to `docs/IMPLEMENTATION_STATUS.md`; `docs/PLAN.md` table updated.
- 2026-10-23 — **SEW (Janome native) export** (commit `fa4f88e`, local, not pushed). Export only, in the export dialog and MCP `embroidery_export`. Pinned pyembroidery has no SEW writer, so the layout follows its `SewReader.py`: colour table, zeros to 0x1D78, EXP-style stream, trims not written. Tests: `npm run test:engine` 107/107 pass; `CI=1 npm run test:e2e` 94/94 pass; `npm run test:mcp` pass; pyembroidery decode check `scripts/verify-sew.mjs` passes (every planned point in order, colour blocks agree). Screenshot: `design/progress/features/export-sew.png`. Machine acceptance is not verified.
- 2026-10-23 — **Browser compile benchmark** (commit `d1e1a02`, local, not pushed). `npm run bench:browser` runs the 100-square fixtures through the app's stitch worker in headless Chromium. Chromium medians: 12 mm, 26,463 stitches, compile 51 ms; 34 mm, 145,700 stitches, compile 119 ms; longest main-thread gap 6 ms. Tests: `npm run test:engine` 109/109 pass; `CI=1 npm run test:e2e` 96/96 pass. Limits: no screenshot (the benchmark has no UI surface); WebKit installed but would not launch on the build machine, so no Safari numbers. Recorded in `docs/PLAN.md` and `docs/IMPLEMENTATION_STATUS.md`.
- 2026-10-23 — **Desktop CI workflow for macOS and Windows** (no new commit). `.github/workflows/desktop.yml` already builds Linux, macOS (macos-14) and Windows in one matrix on a `v*` tag or manual dispatch. Nothing changed; the status note records it. No CI run observed yet.

## History

- 2026-10-23: queue created by the supervisor (Claude Sonnet 5) to seed the hourly build loop.
- 2026-10-23: builder (Claude Haiku 5.5) shipped bling stone shapes (`412ce6e`); the hourly heartbeat registration was denied by the auto-mode classifier and still needs to be set up.
- 2026-10-23: builder (Claude Haiku 5.5) shipped motif size warp across a fill (`6e0c5b0`); the top queue item was done and the queue now has three items.
- 2026-10-23: builder (Claude Haiku 5.5) shipped SEW export (`fa4f88e`) and restarted the local server on port 8790 so the live preview runs the new code; the tunnel URL is unchanged.
- 2026-10-23: builder (Claude Haiku 5.5) shipped the in-browser compile benchmark (`d1e1a02`); the desktop CI item was already in `desktop.yml`, so it moved to Done with no change. The queue now has three items.
