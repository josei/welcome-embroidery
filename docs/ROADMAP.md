# Operational roadmap (Paseo heartbeat queue)

This file is the working queue for the automated build loop: a supervisor (Claude Sonnet 5, Paseo agent `b01634e5-24da-4d96-9f9d-b14ee6adb2b3`) reviews and refreshes it every 6 hours; a builder (Claude Haiku 5.5) picks the top "Ready to build" item and ships something every hour. The builder is **not** one persistent agent — it's a Paseo schedule (`44e95934`, cron `0 * * * *`) that starts a fresh Haiku agent each hour, because the harness blocks an agent from giving itself a recurring heartbeat. Each hour's agent is stateless and re-reads this file from scratch; that's by design. Strategic scope and decisions still live in `docs/PLAN.md`; detailed build history lives in `docs/IMPLEMENTATION_STATUS.md`. This file only tracks what to build next and what just shipped.

Rules for the builder: always take the top item in "Ready to build" you haven't finished. If it's ambiguous or too big for one hour, scope a complete, tested slice of it yourself — do not wait for a decision. Never leave a heartbeat with nothing shipped. If the queue is empty, pull the next concrete item from `docs/PLAN.md`'s open work yourself, add it here, and build it.

Rules for the supervisor: verify tests actually pass and diffs match commit messages before moving an item to "Done this cycle". Keep at least 4 concrete, unambiguous items queued at all times. Push to `origin/main` only once verified.

## Current preview

- Public URL: https://medications-fred-traditional-align.trycloudflare.com (started 2026-10-23 by the builder: `HOST=127.0.0.1 PORT=8790 node server.js` plus a `cloudflared tunnel --no-autoupdate --http-host-header localhost --url http://127.0.0.1:8790` reverse tunnel; a quick tunnel URL changes if cloudflared restarts). Verified returning HTTP 200 at the 2026-10-23 18:00 UTC supervisor review. There is an unrelated second `cloudflared` process on this machine (port 8788) from a different project — leave it alone.
- Latest screenshot set: `design/progress/features/` (one PNG per feature, see `scripts/feature-shots.mjs`).

## Ready to build

1. **Thread plan export** — the editor shows a thread plan (colours in sewing order with stitch counts) but there is no way to export it as a printable/standalone artifact. Add a "Download sewing worksheet" action (plain text or SVG, listing thread colours, stitch counts, and the sewing-time estimate) available in the UI and over MCP. Engine + e2e test, status entry, screenshot.
2. **Motif warp for paths, not just fills** — the motif size warp shipped 2026-10-23 is scoped to motif fills only (its own commit note says so). Add the equivalent along-the-path warp for motif loops/paired loops on open or closed paths (loops shrink/grow along the path's length instead of across a fill's bounding box), documented as the same pseudo-depth cue, not a real surface. Engine + e2e test, status entry, screenshot.
3. **Batch export for VP3 and DST** — "Export batch" in the Array section currently writes one JEF file per hoop only (`docs/PLAN.md`'s Wilcom-parity table: "Built (JEF only)"). Extend the same batch grid/hoop-splitting logic to also offer VP3 and DST batch export. Engine + e2e test, status entry, `docs/PLAN.md` row update, screenshot.
4. **Fix the WebKit browser-benchmark launch and record Safari-engine numbers** — `npm run bench:browser` (added 2026-10-23) only has Chromium numbers; Playwright's WebKit would not launch on the build machine even after installing its browser build. Diagnose the launch failure (missing system libraries are the usual cause on Linux; check what `test:e2e:webkit` needs versus what's installed), fix it, and record WebKit compile/encode timings in `docs/PLAN.md` next to the Chromium baseline — or, if it's genuinely not fixable in this environment, document exactly why and what would be needed, rather than leaving it silently unmeasured.

## Done this cycle — pending supervisor review

_(builder moves finished items here with date, commit hash, and test results; supervisor reconciles into `docs/IMPLEMENTATION_STATUS.md`/this file's history on each 6-hour review)_

## History

- 2026-10-23: queue created by the supervisor (Claude Sonnet 5) to seed the hourly build loop.
- 2026-10-23: builder shipped bling stone shapes (`412ce6e`, round/square), motif size warp across a fill (`6e0c5b0`), SEW export (`fa4f88e`) and the in-browser compile benchmark (`d1e1a02`); documented that the desktop CI matrix in `desktop.yml` already covers macOS/Windows (no code change needed). The builder's own attempt to self-register an hourly heartbeat was denied by the harness's auto-mode classifier, which is why the hourly cadence runs as a Paseo schedule (`44e95934`) instead.
- 2026-10-23 18:00 UTC supervisor review: independently reran and passed `npm run test:engine` (109/109), `CI=1 npm run test:e2e` (96/96), `npm run test:mcp`, and `npm run test:dist`; spot-checked the diffs for all four builder commits above (including independently confirming `.github/workflows/desktop.yml` already has the 3-OS matrix) — all match their `docs/IMPLEMENTATION_STATUS.md` entries. Confirmed the local server and Cloudflare tunnel are still up and the public URL still returns 200; screenshots are current. Pushed `origin/main` up to and including `22f5ffc`. Queue topped up to 4 items (added the WebKit benchmark fix, since the browser-benchmark item shipped without it).
