import {useSyncExternalStore} from 'react';
import {viewActions, viewMode} from '../viewMode.js';

const VIEWS = [
 {id: 'design', label: '2D'},
 {id: 'stitches', label: 'Stitches'},
 {id: 'preview', label: '3D'},
] as const;

// The 2D, Stitches and 3D switch on the canvas (the ids stay design, stitches and preview). The current view lives in viewMode.
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
