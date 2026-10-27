import {useSyncExternalStore} from 'react';
import {measureBetween} from '../engine.js';
import {t} from '../i18n.js';
import {measureState} from '../measureState.js';
import {toolMode} from '../toolMode.js';

// The status-bar readout for the measure tool: the hint for the next click, or the distance between the two points.
export function MeasureReadout() {
 const tool = useSyncExternalStore(toolMode.subscribe, toolMode.get);
 const points = useSyncExternalStore(measureState.subscribe, measureState.get);
 let text = '';
 if (tool === 'measure') {
  if (!points) text = t('Measure: click the first point');
  else if (!points.b) text = t('Measure: click the second point');
  else {
   const m = measureBetween(points.a, points.b);
   text = t('Distance {d} mm · dx {dx} mm · dy {dy} mm', {d: m.distance.toFixed(1), dx: m.dx.toFixed(1), dy: m.dy.toFixed(1)});
  }
 }
 return <span id="measureReadout" role="status" hidden={tool !== 'measure'}>{text}</span>;
}
