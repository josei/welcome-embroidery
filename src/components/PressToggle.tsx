// An on/off setting drawn as a button with aria-pressed, so its state reads by shape and words as well as colour:
// the knob sits at the right and the word says On, or the knob sits at the left and the word says Off.
// The row is a label, as the other settings rows are, so it lays out in the same grid. The button is named by the label text.
import {useId} from 'react';

export function PressToggle({id, label, title, pressed, hidden = false, disabled = false, onToggle}: {
  id: string;
  label: string;
  title?: string;
  pressed: boolean;
  hidden?: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
 const labelId = useId();
 return (
  <label className="switch-row" id={`${id}Row`} hidden={hidden} title={title}>
   <span id={labelId}>{label}</span>
   <span className="switch-control">
    <button id={id} type="button" className="press-toggle" aria-pressed={pressed} aria-labelledby={labelId} disabled={disabled} onClick={() => onToggle(!pressed)}>
     <span className="switch-track" aria-hidden="true" />
     <span className="switch-state" aria-hidden="true">{pressed ? 'On' : 'Off'}</span>
    </button>
   </span>
  </label>
 );
}
