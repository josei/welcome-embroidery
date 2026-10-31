// A choice shown as pill buttons. The select keeps the value (visually hidden, for the form, the keyboard and the tests) and the pills show it.
// Clicking a pill picks its value, as choosing the option does.
export function PillSelect({id, groupLabel, value, options, onChoose}: {
  id: string;
  groupLabel: string;
  value: string;
  options: {value: string; label: string}[];
  onChoose: (value: string) => void;
}) {
 return (
  <>
   <select id={id} className="sr-only" tabIndex={-1} value={value} onChange={e => onChoose(e.target.value)}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
   </select>
   <div className="pill-group" role="radiogroup" aria-label={groupLabel}>
    {options.map(o => (
     <button
      key={o.value}
      type="button"
      data-value={o.value}
      role="radio"
      aria-checked={value === o.value}
      className={value === o.value ? 'pill on' : 'pill'}
      onClick={() => {
       if (value !== o.value) onChoose(o.value);
      }}
     >
      {o.label}
     </button>
    ))}
   </div>
  </>
 );
}
