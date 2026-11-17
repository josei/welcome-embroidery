import type {ReactElement} from 'react';
// A small picture of a stitch type, for the stitch type cards: the stitch itself, drawn in the current text colour.
const outline = {fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const};
const solid = {fill: 'currentColor'};
const frame = (style: object, children: ReactElement[]) => (
 <svg className="stitch-thumb" viewBox="0 0 40 24" aria-hidden="true" {...style}>{children}</svg>
);

export function StitchThumb({kind}: {kind: string}) {
 const shapes: ReactElement[] = [];
 if (kind === 'fill') {
  // Tatami: rows of short stitches, each row offset by half a stitch.
  for (const y of [5, 10, 15, 20]) {
   for (let x = y % 2 ? 4 : 0; x < 40; x += 8) shapes.push(<path key={`f${y}-${x}`} d={`M${x} ${y}h5`} />);
  }
  return frame(outline, shapes);
 }
 if (kind === 'run') {
  return frame(outline, [<path key="run" d="M3 14Q11 6 20 12T37 10" strokeDasharray="4 3" />]);
 }
 if (kind === 'satin') {
  // Satin: a zigzag that crosses between two rails.
  const points: string[] = [];
  for (let x = 3, up = true; x <= 37; x += 3, up = !up) points.push(`${x},${up ? 6 : 18}`);
  return frame({...outline, strokeWidth: 1.6, strokeLinejoin: 'round'}, [<polyline key="satin" points={points.join(' ')} />]);
 }
 if (kind === 'motif') {
  for (const x of [6, 16, 26, 36]) shapes.push(<circle key={x} cx={x} cy="12" r="3.5" />);
  return frame({...outline, strokeWidth: 1.8}, shapes);
 }
 if (kind === 'sequin') {
  for (const x of [6, 16, 26, 36]) shapes.push(<circle key={x} cx={x} cy="12" r="4" />);
  return frame(solid, shapes);
 }
 if (kind === 'bead') {
  for (const x of [5, 15, 25, 35]) shapes.push(<rect key={x} x={x - 3} y="9" width="6" height="6" rx="3" />);
  return frame(solid, shapes);
 }
 if (kind === 'contour') {
  // Concentric outlines, one inside the next.
  return frame(outline, [<ellipse key="c1" cx="20" cy="12" rx="17" ry="10" />, <ellipse key="c2" cx="20" cy="12" rx="10.5" ry="6" />, <ellipse key="c3" cx="20" cy="12" rx="4" ry="2.2" />]);
 }
 if (kind === 'spiral') {
  // A spiral that winds outward from the centre.
  const points: string[] = [];
  for (let i = 0; i <= 90; i++) {
   const a = i * 0.36, r = 0.4 + i * 0.2;
   points.push(`${(20 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a) * 0.8).toFixed(2)}`);
  }
  return frame({...outline, strokeWidth: 1.6, strokeLinejoin: 'round'}, [<polyline key="spiral" points={points.join(' ')} />]);
 }
 if (kind === 'meander') {
  // Back and forth across the shape, turning at each end.
  return frame({...outline, strokeWidth: 1.6, strokeLinejoin: 'round'}, [<polyline key="meander" points="3,5 37,5 37,10 3,10 3,15 37,15 37,20 3,20" />]);
 }
 if (kind === 'guided') {
  // A line with short stitches laid across it, following the curve.
  const ticks: ReactElement[] = [];
  for (let x = 4; x <= 36; x += 4) {
   const y = 12 - 7 * Math.sin(((x - 4) / 32) * Math.PI);
   ticks.push(<path key={`t${x}`} d={`M${x} ${(y - 3).toFixed(2)}v6`} />);
  }
  return frame(outline, [<path key="guide" d="M2 12Q20 -4 38 12" />, ...ticks]);
 }
 if (kind === 'cross') {
  for (const x of [6, 16, 26, 36]) shapes.push(<path key={x} d={`M${x - 4} 8L${x + 4} 16M${x + 4} 8L${x - 4} 16`} />);
  return frame({...outline, strokeWidth: 2.4}, shapes);
 }
 if (kind === 'ripple') {
  return frame(outline, [<path key="w1" d="M2 8Q6 2 10 8T18 8T26 8T34 8T38 8" />, <path key="w2" d="M2 16Q6 10 10 16T18 16T26 16T34 16T38 16" />]);
 }
 // Bling: stones, drawn as diamonds.
 for (const x of [6, 16, 26, 36]) shapes.push(<path key={x} d={`M${x} 6L${x + 4} 12L${x} 18L${x - 4} 12Z`} />);
 return frame(solid, shapes);
}
