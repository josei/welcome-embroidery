# Operational roadmap (Paseo heartbeat queue)

This file is the working queue for the automated build loop: a supervisor (Claude Sonnet 5, Paseo agent `b01634e5-24da-4d96-9f9d-b14ee6adb2b3`) reviews and refreshes it every 6 hours; a builder (Claude Haiku 5.5, Paseo agent — see `docs/ORCHESTRATION.md` for the current id) picks the top "Ready to build" item and ships something every hour. Strategic scope and decisions still live in `docs/PLAN.md`; detailed build history lives in `docs/IMPLEMENTATION_STATUS.md`. This file only tracks what to build next and what just shipped.

Rules for the builder: always take the top item in "Ready to build" you haven't finished. If it's ambiguous or too big for one hour, scope a complete, tested slice of it yourself — do not wait for a decision. Never leave a heartbeat with nothing shipped. If the queue is empty, pull the next concrete item from `docs/PLAN.md`'s open work yourself, add it here, and build it.

Rules for the supervisor: verify tests actually pass and diffs match commit messages before moving an item to "Done this cycle". Keep at least 4 concrete, unambiguous items queued at all times. Push to `origin/main` only once verified.

## Current preview

- Public URL: https://medications-fred-traditional-align.trycloudflare.com (started 2026-10-23 by the builder: `HOST=127.0.0.1 PORT=8790 node server.js` plus a `cloudflared tunnel --no-autoupdate --http-host-header localhost --url http://127.0.0.1:8790` reverse tunnel; a quick tunnel URL changes if cloudflared restarts).
- Latest screenshot set: `design/progress/features/` (one PNG per feature, see `scripts/feature-shots.mjs`).

## Ready to build

1. **Motif true-surface warp (basic)** — `docs/PLAN.md` lists "True 3D surface warp of motifs" as not started (the existing warps are width/shape warps, not surface warps). Ship a basic version in the same spirit as the other "Built (basic)" motif entries: scale motif loops across a filled shape by normalized distance along a chosen axis (a cheap pseudo-depth cue), documented explicitly as approximate, not a real 3D surface. Engine + e2e test, status entry, screenshot.
2. **Desktop CI workflow for macOS and Windows** — `docs/PLAN.md`'s desktop table lists CI builds for macOS/Windows as "Proposed", not built. Write the GitHub Actions job(s) (in `.github/workflows/`) that run `tauri build` for macOS and Windows alongside the existing Linux build, gated on a tag or manual dispatch like the existing `desktop.yml`. This is a config/workflow change, not a feature in `src/`; note it in `docs/IMPLEMENTATION_STATUS.md` and do not claim the builds have actually run until CI confirms it.
3. **Browser compile-time benchmark** — `docs/PLAN.md`'s quality criteria note Node benchmark numbers exist (`npm run bench:compile`) but "Browser timings (Safari included) are not measured yet." Add a Playwright-driven in-browser timing harness (reuse the same fixture sizes as the Node bench) and record the measured numbers in `docs/PLAN.md`'s quality-criteria section.
4. **Thread plan export** — the editor shows a thread plan (colours in sewing order with stitch counts) but there is no way to export it as a printable/standalone artifact. Add a "Download sewing worksheet" action (plain text or SVG, listing thread colours, stitch counts, and the sewing-time estimate) available in the UI and over MCP. Engine + e2e test, status entry, screenshot.

## Done this cycle — pending supervisor review

_(builder moves finished items here with date, commit hash, and test results; supervisor reconciles into `docs/IMPLEMENTATION_STATUS.md`/this file's history on each 6-hour review)_

- 2026-10-23 — **Bling stone shapes** (commit `412ce6e`, local, not pushed). Round (default) or Square stone shape, `blingShape` in the sidebar and MCP `set_object`. Tests: `npm run test:engine` 106/106 pass; `CI=1 npm run test:e2e` 93/93 pass. Screenshot: `design/progress/features/bling-square.png`. Status entry added to `docs/IMPLEMENTATION_STATUS.md`. Note: the Playwright Chromium build (revision 1243) had to be installed with `npx playwright install chromium` before the e2e suite could run.
- 2026-10-23 — **SEW (Janome native) export** (commit `fa4f88e`, local, not pushed). Export only, in the export dialog and MCP `embroidery_export`. Pinned pyembroidery has no SEW writer, so the layout follows its `SewReader.py`: colour table, zeros to 0x1D78, EXP-style stream, trims not written. Tests: `npm run test:engine` 107/107 pass; `CI=1 npm run test:e2e` 94/94 pass; `npm run test:mcp` pass; pyembroidery decode check `scripts/verify-sew.mjs` passes (every planned point in order, colour blocks agree). Screenshot: `design/progress/features/export-sew.png`. Machine acceptance is not verified.

## History

- 2026-10-23: queue created by the supervisor (Claude Sonnet 5) to seed the hourly build loop.
- 2026-10-23: builder (Claude Haiku 5.5) shipped bling stone shapes (`412ce6e`); the hourly heartbeat registration was denied by the auto-mode classifier and still needs to be set up.
- 2026-10-23: builder (Claude Haiku 5.5) shipped SEW export (`fa4f88e`) and restarted the local server on port 8790 so the live preview runs the new code; the tunnel URL is unchanged.
