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
 // Bling: stones, drawn as diamonds.
 for (const x of [6, 16, 26, 36]) shapes.push(<path key={x} d={`M${x} 6L${x + 4} 12L${x} 18L${x - 4} 12Z`} />);
 return frame(solid, shapes);
}
