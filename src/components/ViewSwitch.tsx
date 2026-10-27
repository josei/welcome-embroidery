import {useSyncExternalStore} from 'react';
import {viewActions, viewMode} from '../viewMode.js';

const VIEWS = [
 {id: 'design', label: 'Design'},
 {id: 'stitches', label: 'Stitches'},
 {id: 'preview', label: 'Preview'},
] as const;

// The Design, Stitches and Preview switch in the header. The current view lives in viewMode.
// Choosing a view runs app.js's view change, which also stops playback and redraws the canvas.
export function ViewSwitch() {
 const current = useSyncExternalStore(viewMode.subscribe, viewMode.get);
 return (
  <div className="segmented" role="group" aria-label="View">
   {VIEWS.map(view => (
    <button
     key={view.id}
     data-view={view.id}
     className={current === view.id ? 'active' : undefined}
     aria-pressed={current === view.id}
     onClick={() => viewActions.choose(view.id)}
    >
     {view.label}
    </button>
   ))}
  </div>
 );
}
