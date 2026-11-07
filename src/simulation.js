// @ts-check
// The stitch view and the 3D thread preview: draws the compiled plan's thread paths, keeps the simulation bar's state
// in step with the playback position, and wires the preview controls and the pull estimate.
import {documentNow} from './documentState.js';
import {viewMode} from './viewMode.js';
import {setStatus} from './statusState.js';
import {setPlayback, playbackActions} from './playbackState.js';
import {previewState, setPreviewState, previewActions} from './previewState.js';
import {distortionGrid, hoopSize, threadPlan, threadSpans, sewingSeconds, sewingSecondsUpTo} from './engine.js';
import {createThreadPreview} from './preview3d.js';
import {t} from './i18n.js';
import {getPlan, getLastPlan, compileNow} from './compileService.js';
import {editor} from './editorContext.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** @type {any} */
let preview3d = null;
/** @type {any} */
let preview3dPlan = null;
/** @type {string | null} */
let pullFabric = null;
/** @type {number | null} */
let playIndex = null;
/** @type {any} */
let playbackTimer = null;
/** @type {{plan: any, spans: any[], trims: number, metres: number, changes: number}} */
let spanCache = {plan: null, spans: [], trims: 0, metres: 0, changes: 0};

function planSpans() {
  const plan = getPlan();
  if (spanCache.plan !== plan) {
    const spans = plan ? threadSpans(plan).map((/** @type {any} */ s) => ({...s, seconds: sewingSecondsUpTo(plan, s.start)})) : [];
    spanCache = {
      plan,
      spans,
      trims: plan ? plan.stitches.filter((/** @type {any} */ s) => s.cmd === 'trim').length : 0,
      metres: plan ? threadPlan(plan).reduce((n, b) => n + b.mm, 0) / 1000 : 0,
      changes: Math.max(0, spans.length - 1),
    };
  }
  return spanCache;
}

/** Stops the timer and puts the playback position back at the start. */
export function stopPlayback() {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackTimer = null;
  playIndex = null;
}

/** Resets playback because the document changed; compileService calls this through configureCompile. */
export function resetPlayback() {
  stopPlayback();
  syncPlaybackControls();
}

/** Puts the playback position back at the start after a new plan, without touching the timer. */
export function resetPlaybackIndex() {
  playIndex = null;
}

/** Sets the simulation bar's state from the plan and the playback position. */
export function syncPlaybackControls() {
  const plan = getPlan();
  const cache = planSpans(), length = plan?.stitches.length || 0, ready = playIndex === null;
  const limit = ready ? length : Math.min(playIndex ?? 0, length);
  let sewn = 0, current = null;
  for (let i = 0; i < limit; i++) {
    const item = plan.stitches[i];
    if (item.cmd === 'stitch') { sewn++; current = item; }
  }
  setPlayback({
    hasPlan: Boolean(plan), ready, playing: Boolean(playbackTimer), index: limit,
    seekMax: Math.max(1, length), count: plan?.count || 0, sewn,
    sewnSeconds: plan ? sewingSecondsUpTo(plan, limit) : 0,
    totalSeconds: plan ? sewingSeconds(plan) : 0,
    spans: cache.spans, colourChanges: cache.changes, trims: cache.trims, metres: cache.metres,
  });
  if (!plan) { setStatus({playback: 'Ready to simulate', needle: ''}); return; }
  if (ready) { setStatus({playback: `Ready · ${plan.count.toLocaleString()} stitches`, needle: ''}); return; }
  const percent = length ? Math.floor(limit / length * 100) : 0;
  setStatus({
    playback: `${sewn.toLocaleString()} / ${plan.count.toLocaleString()} stitches · ${percent}%`,
    needle: current ? `Needle ${current.x.toFixed(1)}, ${current.y.toFixed(1)} mm` : 'Needle at start',
  });
}

/** The pull estimate: from the compiled plan and the fabric, shown only while the 3D view and the checkbox are on. */
function refreshPull() {
  const state = previewState.get(), doc = documentNow().doc;
  if (!state.pull || !state.threeD || !preview3dPlan) {
    preview3d.setPull(null);
    if (state.note) setPreviewState({note: ''});
    return;
  }
  const grid = distortionGrid(preview3dPlan, doc.settings.fabric ?? 'woven', hoopSize(doc));
  preview3d.setPull(grid);
  setPreviewState(
    {note:
    t(
    'Peak estimate {n}% of the scale on {fabric}. Lines show the direction the fabric pulls. A guide for where to look: it uses stitch density, stitch ' +
    'direction and fabric stretch, not a simulation of the machine.',
    {n: Math.round(grid.peak * 100), fabric: t(grid.label)})});
}

/** Mounts the 3D preview canvas and wires the preview controls. */
export function mountSimulation() {
  preview3d = createThreadPreview(document.getElementById('preview3d'));
  previewActions.choosePull = checked => { setPreviewState({pull: checked}); refreshPull(); };
  previewActions.chooseView = view => setPreviewState({view});
  previewActions.chooseLoupe = on => setPreviewState({loupe: on});
  previewState.subscribe(() => {
    if (!preview3d.available) return;
    const state = previewState.get();
    preview3d.setView(state.view);
    preview3d.setLoupe(state.loupe);
  });
}

/** Draws the stitch view or steps the 3D preview for the current plan and playback position. */
export function renderSimulation() {
  const plan = getPlan(), lastPlan = getLastPlan();
  const root = /** @type {HTMLElement} */ (document.getElementById('stitches'));
  root.replaceChildren();
  const active = playIndex !== null;
  const P = plan || (viewMode.get() === 'stitches' && !active && lastPlan && lastPlan.revision !== undefined ? lastPlan : null);
  const limit = P ? (active ? Math.min(playIndex ?? 0, P.stitches.length) : P.stitches.length) : 0;
  root.classList.toggle('stale', Boolean(P) && !plan);
  let needle = null;
  if (P && (viewMode.get() !== 'design' || active)) {
    const paths = new Map();
    let travel = '', last = null, color = P.colors[0] || '#527461';
    for (let i = 0; i < limit; i++) {
      const item = P.stitches[i];
      if (item.cmd === 'color') { color = item.thread || color; last = {x: item.x, y: item.y}; continue; }
      if (item.cmd === 'jump') { if (last) travel += `M${last.x},${last.y}L${item.x},${item.y}`; last = item; continue; }
      if (item.cmd === 'trim' || item.cmd === 'end') { last = null; continue; }
      if (item.cmd === 'stop') continue;
      if (item.cmd === 'stitch') {
        if (last) paths.set(color, (paths.get(color) || '') + `M${last.x},${last.y}L${item.x},${item.y}`);
        last = item;
        needle = item;
      }
    }
    if (viewMode.get() === 'preview' && !active && !preview3d.available) {
      /** @type {(cls: string, d: string, width: number, stroke: string | null, dx?: number, dy?: number) => SVGPathElement} */
      const layer = (cls, d, width, stroke, dx = 0, dy = 0) => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', cls);
        path.setAttribute('stroke-width', String(width));
        if (stroke) path.style.stroke = stroke;
        if (dx || dy) path.setAttribute('transform', `translate(${dx} ${dy})`);
        return path;
      };
      for (const [, d] of paths) root.append(layer('thread-shadow', d, .5, null, .14, .2));
      for (const [thread, d] of paths) {
        root.append(layer('thread-body', d, .4, thread));
        root.append(layer('thread-sheen', d, .1, null, -.07, -.09));
      }
    } else {
      for (const [thread, d] of paths) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'stitch-path');
        path.style.stroke = thread;
        root.append(path);
      }
    }
    if (travel) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', travel);
      path.setAttribute('class', 'stitch-path jump');
      root.append(path);
    }
    if (active && needle) {
      const marker = document.createElementNS(SVG_NS, 'circle');
      marker.setAttribute('id', 'needleMarker');
      marker.setAttribute('cx', String(needle.x));
      marker.setAttribute('cy', String(needle.y));
      marker.setAttribute('r', '1.2');
      root.append(marker);
    }
  }
  {
    const use3d = viewMode.get() === 'preview' && Boolean(plan) && preview3d.available;
    setPreviewState({threeD: use3d});
    let fresh = false;
    if (use3d && preview3dPlan !== plan) {
      preview3d.setPlan(plan, hoopSize(documentNow().doc));
      preview3dPlan = plan;
      fresh = true;
    }
    if (use3d) preview3d.setLimit(active ? playIndex : null);
    if (preview3d.available) {
      preview3d.show(use3d);
      const art = /** @type {HTMLElement} */ (document.getElementById('art'));
      art.style.visibility = use3d ? 'hidden' : '';
      const controls = /** @type {HTMLElement} */ (document.getElementById('controls'));
      controls.style.display = use3d ? 'none' : controls.style.display;
    }
    const fabricNow = documentNow().doc.settings.fabric ?? 'woven';
    if (preview3d.available) preview3d.setFabric(fabricNow);
    if (use3d && (fresh || fabricNow !== pullFabric)) { pullFabric = fabricNow; refreshPull(); }
  }
  editor.syncThreads?.();
  editor.renderPlan?.();
  editor.autosave?.schedule();
  const shapes = /** @type {HTMLElement} */ (document.getElementById('shapes'));
  shapes.style.opacity = String(viewMode.get() === 'stitches' ? .18 : viewMode.get() === 'preview' && plan ? 0 : viewMode.get() === 'preview' ? .55 : 1);
  const controls = /** @type {HTMLElement} */ (document.getElementById('controls'));
  controls.style.display = viewMode.get() === 'design' ? '' : 'none';
  syncPlaybackControls();
}

playbackActions.seek = index => {
  const plan = getPlan();
  if (!plan) return;
  if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null; }
  if (viewMode.get() === 'design') viewMode.set('stitches');
  playIndex = index;
  editor.render();
};

playbackActions.togglePlay = async () => {
  const plan = getPlan();
  if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null; editor.render(); return; }
  if (!plan) await compileNow(true);
  const next = getPlan();
  if (!next) return;
  if (viewMode.get() === 'design') viewMode.set('stitches');
  if (playIndex === null || playIndex >= next.stitches.length) playIndex = 0;
  playbackTimer = setInterval(() => {
    const current = getPlan();
    if (!current) return;
    playIndex = Math.min(current.stitches.length, (playIndex ?? 0) + Math.max(1, Math.ceil(current.stitches.length / 180)));
    if (playIndex >= current.stitches.length) { clearInterval(playbackTimer); playbackTimer = null; }
    editor.render();
  }, 50);
  editor.render();
};

playbackActions.restart = () => {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackTimer = null;
  if (viewMode.get() === 'design') viewMode.set('stitches');
  playIndex = 0;
  editor.render();
};
