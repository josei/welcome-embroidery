// A select with a row of icon buttons beside it. The select keeps the value (it is visually hidden); the buttons show it.
// Clicking a button picks its value, as clicking an option does. The row's labels and icons are the ones the helper it replaces built.
export interface IconOption {
  value: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

export function IconSelect({id, groupLabel, value, options, disabled = false, onChoose}: {
  id: string;
  groupLabel: string;
  value: string;
  options: IconOption[];
  disabled?: boolean;
  onChoose: (value: string) => void;
}) {
 return (
  <>
   <select id={id} className="sr-only" tabIndex={-1} value={value} disabled={disabled} onChange={e => onChoose(e.target.value)}>{options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}</select>
   <div className="icon-seg" role="radiogroup" aria-label={groupLabel}>{options.map(o => <button key={o.value} type="button" data-value={o.value} title={o.label} aria-label={o.label} role="radio" aria-checked={value === o.value} aria-pressed={value === o.value} onClick={e => { e.preventDefault(); if (value !== o.value) onChoose(o.value); }}><svg className="icon" aria-hidden="true"><use href={`#${o.icon}`} /></svg></button>)}</div>
  </>
 );
}
