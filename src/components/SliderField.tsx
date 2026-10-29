import {useState} from 'react';
// A range slider that shows the same value as the number field beside it. Dragging or using the arrow keys changes only the
// slider until the user lets go, so one change is one undo step, as typing one value is.
export function SliderField({id, label, min, max, step, value, onCommit}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: string;
  onCommit: (text: string) => void;
}) {
 const [live, setLive] = useState<string | null>(null);
 const stored = Number(value);
 const shown = live ?? String(Number.isFinite(stored) ? Math.min(max, Math.max(min, stored)) : min);
 const finish = () => {
  if (live === null) return;
  setLive(null);
  onCommit(String(Number(Number(live).toFixed(2))));
 };
 return (
  <input
   type="range"
   id={id}
   aria-label={label}
   min={min}
   max={max}
   step={step}
   value={shown}
   onChange={e => setLive(e.target.value)}
   onPointerUp={finish}
   onKeyUp={finish}
   onBlur={finish}
  />
 );
}
