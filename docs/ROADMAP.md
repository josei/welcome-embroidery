# Operational roadmap (Paseo heartbeat queue)

This file is the working queue for the automated build loop: a supervisor (Claude Sonnet 5, Paseo agent `b01634e5-24da-4d96-9f9d-b14ee6adb2b3`) reviews and refreshes it every 6 hours; a builder (Claude Haiku 5.5, Paseo agent — see `docs/ORCHESTRATION.md` for the current id) picks the top "Ready to build" item and ships something every hour. Strategic scope and decisions still live in `docs/PLAN.md`; detailed build history lives in `docs/IMPLEMENTATION_STATUS.md`. This file only tracks what to build next and what just shipped.

Rules for the builder: always take the top item in "Ready to build" you haven't finished. If it's ambiguous or too big for one hour, scope a complete, tested slice of it yourself — do not wait for a decision. Never leave a heartbeat with nothing shipped. If the queue is empty, pull the next concrete item from `docs/PLAN.md`'s open work yourself, add it here, and build it.

Rules for the supervisor: verify tests actually pass and diffs match commit messages before moving an item to "Done this cycle". Keep at least 4 concrete, unambiguous items queued at all times. Push to `origin/main` only once verified.

## Current preview

- Public URL: not started yet — the builder's first heartbeat should start `HOST=127.0.0.1 PORT=8790 node server.js` and a `cloudflared tunnel --url http://127.0.0.1:8790` reverse tunnel, then record the live `https://*.trycloudflare.com` URL here.
- Latest screenshot set: `design/progress/features/` (one PNG per feature, see `scripts/feature-shots.mjs`).

## Ready to build

1. **Bling stone shapes** — `docs/PLAN.md`'s Wilcom-parity table lists bling as "Built (basic)" with "no stone shapes, settings or library". Add at least a round and a square/baguette stone shape (`blingShape` on the object, selectable in the sidebar and over MCP `set_object`), each with its own fixing-ring geometry. Engine + e2e test, `docs/IMPLEMENTATION_STATUS.md` entry, feature screenshot.
2. **Second machine format: SEW (Janome native stitch format)** — `docs/PLAN.md` lists "Other machine formats" as not started. Follow the EXP/PEC/PES precedent: port the pyembroidery `SewWriter` record layout (export only), verify by decoding with pinned pyembroidery, add to the export dialog and MCP `embroidery_export`, engine + e2e test, status entry, screenshot.
3. **Motif true-surface warp (basic)** — `docs/PLAN.md` lists "True 3D surface warp of motifs" as not started (the existing warps are width/shape warps, not surface warps). Ship a basic version in the same spirit as the other "Built (basic)" motif entries: scale motif loops across a filled shape by normalized distance along a chosen axis (a cheap pseudo-depth cue), documented explicitly as approximate, not a real 3D surface. Engine + e2e test, status entry, screenshot.
4. **Desktop CI workflow for macOS and Windows** — `docs/PLAN.md`'s desktop table lists CI builds for macOS/Windows as "Proposed", not built. Write the GitHub Actions job(s) (in `.github/workflows/`) that run `tauri build` for macOS and Windows alongside the existing Linux build, gated on a tag or manual dispatch like the existing `desktop.yml`. This is a config/workflow change, not a feature in `src/`; note it in `docs/IMPLEMENTATION_STATUS.md` and do not claim the builds have actually run until CI confirms it.
5. **Browser compile-time benchmark** — `docs/PLAN.md`'s quality criteria note Node benchmark numbers exist (`npm run bench:compile`) but "Browser timings (Safari included) are not measured yet." Add a Playwright-driven in-browser timing harness (reuse the same fixture sizes as the Node bench) and record the measured numbers in `docs/PLAN.md`'s quality-criteria section.
6. **Thread plan export** — the editor shows a thread plan (colours in sewing order with stitch counts) but there is no way to export it as a printable/standalone artifact. Add a "Download sewing worksheet" action (plain text or SVG, listing thread colours, stitch counts, and the sewing-time estimate) available in the UI and over MCP. Engine + e2e test, status entry, screenshot.

## Done this cycle — pending supervisor review

_(builder moves finished items here with date, commit hash, and test results; supervisor reconciles into `docs/IMPLEMENTATION_STATUS.md`/this file's history on each 6-hour review)_

## History

- 2026-10-23: queue created by the supervisor (Claude Sonnet 5) to seed the hourly build loop.
