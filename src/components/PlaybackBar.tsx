import {useSyncExternalStore} from 'react';
import {blockTimeLabel} from '../engine.js';
import {t} from '../i18n.js';
import {playbackActions, playbackState} from '../playbackState.js';
// The simulation bar below the canvas, rendered by React: play and restart, the time and stitch count, the thread blocks as a
// track with the seek position on it, and the summary. Ids match the markup it replaced, because app.js and the tests use them.
export function PlaybackBar() {
 const p = useSyncExternalStore(playbackState.subscribe, playbackState.get);
 const playLabel = p.playing ? t('Pause stitch simulation') : p.hasPlan ? t('Play stitch simulation') : t('Compile and play stitch simulation');
 const sewnText = p.ready ? t('Ready to simulate') : t('{n} of {m} stitches', {n: p.sewn.toLocaleString(), m: p.count.toLocaleString()});
 const changesText = p.colourChanges === 1 ? t('1 colour change') : t('{n} colour changes', {n: p.colourChanges});
 const trimsText = p.trims === 1 ? t('1 trim') : t('{n} trims', {n: p.trims});
 const metresText = t('{m} m thread', {m: p.metres.toFixed(1)});
 return (
  <div className="playback-bar">
   <button type="button" id="resetPlayback" className="icon-button playback-control" aria-label={t('Restart stitch simulation')} title={t('Restart stitch simulation')} data-tooltip={t('Restart simulation')} onClick={() => playbackActions.restart()}>
    <svg className="icon"><use href="#i-reset" /></svg>
   </button>
   <button type="button" id="play" className={`icon-button playback-control${p.playing ? ' playing' : ''}`} aria-label={playLabel} title={playLabel} data-tooltip={p.playing ? t('Pause simulation') : p.hasPlan ? t('Play simulation') : t('Compile and play')} onClick={() => playbackActions.togglePlay()}>
    <svg className="icon"><use href={`#i-${p.playing ? 'pause' : 'play'}`} /></svg>
   </button>
   <div className="playback-time">
    <span id="playbackTime">{`${blockTimeLabel(p.sewnSeconds)} / ${blockTimeLabel(p.totalSeconds)}`}</span>
    <span id="playbackStitches">{t('Stitch {n} of {m}', {n: p.sewn.toLocaleString(), m: p.count.toLocaleString()})}</span>
   </div>
   <div className="playback-track">
    <div className="playback-slider">
    <div className="playback-spans" aria-hidden="true">
     {p.spans.map((s, i) => (
      <span key={i} style={{flex: `${s.end - s.start} 1 0`, background: s.thread, opacity: p.index >= s.end ? 1 : p.index > s.start ? 0.8 : 0.45}} />
     ))}
    </div>
    {/* onInput does the seek: it fires for every change of the slider. onChange is here only because React needs one on a controlled field. */}
    <input
     id="seek"
     type="range"
     min={0}
     max={p.seekMax}
     value={p.index}
     aria-label={t('Stitch simulation progress')}
     aria-valuetext={sewnText}
     title={t('Stitch simulation progress')}
     onInput={e => playbackActions.seek(Number(e.currentTarget.value))}
     onChange={() => undefined}
    />
    </div>
    <span id="playbackSummary" className="playback-summary">{p.hasPlan ? `${changesText} · ${trimsText} · ${metresText}` : ''}</span>
   </div>
  </div>
 );
}
