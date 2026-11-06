import {useRef} from 'react';
import {addPhoto} from '../photoCommands.js';
// The Photo stitch button on the tool rail and the picture input it opens. The picture is read by photoCommands.
export function PhotoStitch() {
 const input = useRef<HTMLInputElement>(null);
 return (
  <>
   <button
    className="icon-button"
    id="photo"
    aria-label="Photo stitch from a picture"
    title="Photo stitch from a picture"
    data-tooltip="Photo stitch from a picture"
    onClick={() => input.current?.click()}
   >
    <svg className="icon"><use href="#i-photo" /></svg>
   </button>
   <input
    id="photoFile"
    ref={input}
    type="file"
    accept="image/*"
    hidden
    onChange={event => {
     const file = event.target.files?.[0];
     event.target.value = '';
     if (file) void addPhoto(file);
    }}
   />
  </>
 );
}
