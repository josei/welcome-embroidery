import {useState} from 'react';
import type * as React from 'react';
// A range slider that shows the same value as the number field beside it. Dragging or using the arrow keys changes only the
// slider until the user lets go, so one change is one undo step, as typing one value is.
// With swatch, a tile beside the slider draws rows at the shown spacing: a 4 mm square at true scale, so the rows are the real spacing.
export function SliderField({id, label, min, max, step, value, onCommit, swatch = false}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: string;
  onCommit: (text: string) => void;
  swatch?: boolean;
}) {
 const [live, setLive] = useState<string | null>(null);
 const stored = Number(value);
 const shown = live ?? String(Number.isFinite(stored) ? Math.min(max, Math.max(min, stored)) : min);
 const finish = () => {
  if (live === null) return;
  setLive(null);
  onCommit(String(Number(Number(live).toFixed(2))));
 };
 const input = (
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
 if (!swatch) return input;
 // 44 px for 4 mm: 11 px to the millimetre, so a row's pitch on the tile is its spacing.
 const spacingMm = Number(shown);
 return (
  <div className="density-row">
   <div className="density-swatch" data-spacing={shown} style={{'--pitch': `${spacingMm * 11}px`} as React.CSSProperties} aria-hidden="true" />
   {input}
  </div>
 );
}
