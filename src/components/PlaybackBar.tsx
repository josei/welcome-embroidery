import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {blockTimeLabel} from '../engine.js';
import {lang, t} from '../i18n.js';
import {threadName} from '../threadPalette.js';
import {playbackActions, playbackState} from '../playbackState.js';
import {formatCount, formatNumber} from '../decimalText.js';
import {groupColourMarkers} from '../timelineMarkers.js';
// The simulation bar below the canvas, rendered by React: play and restart, the time and stitch count, the thread blocks as a
// track with the seek position on it, and the summary. Ids match the markup it replaced, because app.js and the tests use them.
// A thread's name for its marker. A colour with no palette name shows as its hex code, which a reader cannot use, so it is called
// by its place in the plan instead: the thread's number, counted from 1.
function threadLabel(spans: {thread: string}[], index: number) {
 const name = threadName(spans[index].thread);
 return name.startsWith('#') ? t('Thread {n}', {n: index + 1}) : name;
}

export function PlaybackBar() {
 const p = useSyncExternalStore(playbackState.subscribe, playbackState.get);
 const sliderRef = useRef<HTMLDivElement>(null);
 const [trackPx, setTrackPx] = useState(0);
 // The markers are grouped by their distance on screen, so the track's width is measured and followed as the window changes.
 useEffect(() => {
  const el = sliderRef.current;
  if (!el) return;
  const measure = () => setTrackPx(el.getBoundingClientRect().width);
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(el);
  return () => observer.disconnect();
 }, []);
 const groups = groupColourMarkers(p.spans, p.seekMax, trackPx);
 const playLabel = p.playing ? t('Pause stitch simulation') : p.hasPlan ? t('Play stitch simulation') : t('Compile and play stitch simulation');
 const sewnText = p.ready ? t('Ready to simulate') : t('{n} of {m} stitches', {n: formatCount(p.sewn, lang), m: formatCount(p.count, lang)});
 const changesText = p.colourChanges === 1 ? t('1 color change') : t('{n} color changes', {n: p.colourChanges});
 const trimsText = p.trims === 1 ? t('1 trim') : t('{n} trims', {n: p.trims});
 const metresText = t('{m} m thread', {m: formatNumber(p.metres, lang, 1)});
 return (
  <div className="playback-bar">
   <button type="button" id="resetPlayback" className="icon-button playback-control" aria-label={t('Restart stitch simulation')} title={t(
     'Restart stitch simulation')} data-tooltip={t('Restart simulation')} onClick={() => playbackActions.restart()}>
    <svg className="icon"><use href="#i-reset" /></svg>
   </button>
   <button type="button" id="play" className={`icon-button playback-control${p.playing ? ' playing' : ''}`} aria-label={playLabel} title={playLabel}
     data-tooltip={p.playing ?
     t('Pause simulation') : p.hasPlan ? t('Play simulation') : t('Compile and play')} onClick={() => playbackActions.togglePlay()}>
    <svg className="icon"><use href={`#i-${p.playing ? 'pause' : 'play'}`} /></svg>
   </button>
   <div className="playback-time">
    <span id="playbackTime">{`${blockTimeLabel(p.sewnSeconds)} / ${blockTimeLabel(p.totalSeconds)}`}</span>
    <span id="playbackStitches">{t('Stitch {n} of {m}', {n: formatCount(p.sewn, lang), m: formatCount(p.count, lang)})}</span>
   </div>
   <div className="playback-track">
    <div className="playback-slider" ref={sliderRef}>
    {/* A marker at each colour change, in the new thread's colour: clicking it seeks to that change. Changes that would sit on top of
        each other share one marker, which seeks to the first of them. The marker's place goes through --marker-at, which the CSS
        clamps, so the dot stays inside the track at either end. */}
    {groups.map(g => {
     const when = blockTimeLabel(g.seconds);
     const name = threadLabel(p.spans, g.index);
     const label = g.count > 1 ? t('{n} color changes from {time}', {n: g.count, time: when}) : t('Color change to {n} at {time}', {n: name, time: when});
     return (
      <button
       key={g.start}
       type="button"
       className="timeline-marker"
       data-index={g.start}
       style={{'--marker-at': `${g.at * 100}%`, background: g.thread} as React.CSSProperties}
       title={label}
       aria-label={label}
       onClick={() => playbackActions.seek(g.start)}
      />
     );
    })}
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
