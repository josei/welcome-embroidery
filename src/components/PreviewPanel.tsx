import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {previewActions, previewState, type PreviewView} from '../previewState.js';
import {inputMode} from '../inputMode.js';
import {useCompactLayout} from '../compactLayout';
const VIEWS: [PreviewView, string][] = [['front', 'Front ¾'], ['close', 'Close-up'], ['turntable', 'Turntable']];
// The hint under the 3D preview, its view choice and loupe, and its pull estimate, rendered by React.
// The hint is plain text, not a control: it has no button role or pill, so it never reads as one of the tool buttons.
// Ids match the markup it replaced, because app.js wires them by id.
export function PreviewPanel() {
 const preview = useSyncExternalStore(previewState.subscribe, previewState.get);
 // A touch screen has no scroll wheel or double-click, so its hint names the gestures it has.
 const touch = useSyncExternalStore(inputMode.subscribe, inputMode.get) === 'touch';
 const compact = useCompactLayout();
 // The hint is three glyphs, each named in full by aria-label and title: orbit (the Hand's glyph), zoom, and reset. Reset is a cube, not the playback Restart arrow.
 const hint: [string, string, string?][] = [
  ['i-hand', t('Drag to orbit'), undefined],
  ['i-zoom-in', touch ? t('Pinch to zoom') : t('Scroll to zoom'), undefined],
  // The cube is not a universal reset symbol, so the reset item carries its word beside it.
  ['i-view-cube', touch ? t('Double-tap to reset') : t('Double-click to reset'), t('Reset')],
 ];
 const pullLabel = t('Show pull for the fabric');
 return (
  <>
   <div id="previewHint" hidden={!preview.threeD}>
    {hint.map(([glyph, label, word]) => (
     <span key={glyph} className="hint-item">
      <span className="hint-glyph" role="img" aria-label={label} title={label}><svg className="icon" aria-hidden="true" focusable="false"><use href={`#${glyph}`} /></svg></span>
      {word && <span className="hint-word" aria-hidden="true">{word}</span>}
     </span>
    ))}
   </div>
   <div id="previewView" className="segmented" hidden={!preview.threeD} role="group" aria-label={t('3D view')}>
    {VIEWS.map(([view, label]) => (
     <button key={view} type="button" aria-pressed={preview.view === view && !preview.orbited} onClick={() => previewActions.chooseView(view)}>{t(label)}</button>
    ))}
    <button type="button" aria-pressed={preview.loupe} onClick={() => previewActions.chooseLoupe(!preview.loupe)}>{t('Loupe 8×')}</button>
   </div>
   <div id="previewPull" hidden={!preview.threeD}>
    {compact ? (
     <button type="button" id="showPull" className="pull-toggle" aria-pressed={preview.pull} aria-label={pullLabel} title={pullLabel}
      onClick={() => previewActions.choosePull(!preview.pull)}>{t('Pull')}</button>
    ) : (
     <label><input type="checkbox" id="showPull" checked={preview.pull} onChange={e =>
       previewActions.choosePull(e.target.checked)} /> {pullLabel}</label>
    )}
    <p id="pullNote" hidden={!preview.pull} role="status">{preview.note}</p>
   </div>
  </>
 );
}
