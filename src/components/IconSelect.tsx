// A select with a row of icon buttons beside it. The select keeps the value (it is visually hidden); the buttons show it.
// Clicking a button picks its value, as clicking an option does. The row's labels and icons are the ones the helper it replaces built.
// With labelled, each button shows its label under the icon, as cards in a four-column grid (seven stitch types lay out as 4 + 3).
// A value of '' matches no button: the select then shows a disabled Mixed option and no button is pressed.
import {StitchThumb} from './StitchThumb';
import {t} from '../i18n.js';

export interface IconOption {
  value: string;
  label: string;
  icon: string;
  // The stitch picture a labelled card shows in place of the icon (see StitchThumb).
  thumb?: string;
  disabled?: boolean;
  // A plain-language gloss for a kept English term; shown as the tooltip in place of the label.
  hint?: string;
}

export function IconSelect({id, groupLabel, value, options, disabled = false, labelled = false, onChoose}: {
  id: string;
  groupLabel: string;
  value: string;
  options: IconOption[];
  disabled?: boolean;
  labelled?: boolean;
  onChoose: (value: string) => void;
}) {
 return (
  <>
   <select id={id} className="sr-only" tabIndex={-1} value={value} disabled={disabled} onChange={e =>
     onChoose(e.target.value)}>{value === '' && <option value="" disabled>{t('Mixed')}</option>}{options.map(o => <option key={o.value} value={o.value} disabled={o.disabled} title={o.hint}>{o.label}</option>)}</select>
   <div className={labelled ?
     'icon-seg labelled' : 'icon-seg'} role="radiogroup" aria-label={groupLabel}>{options.map(o =>
     <button key={o.value} type="button" data-value={o.value} title={o.hint ?? o.label} aria-label={o.label} role="radio" aria-checked={value ===
     o.value} aria-pressed={value === o.value} disabled={disabled || o.disabled} onClick={e => { e.preventDefault(); if (value !== o.value && !o.disabled) onChoose(o.value); }}>{labelled && o.thumb ?
     <StitchThumb kind={o.thumb} /> : <svg className="icon" aria-hidden="true"><use href={`#${o.icon}`} /></svg>}{labelled &&
     <span>{o.label}</span>}</button>)}</div>
  </>
 );
}
