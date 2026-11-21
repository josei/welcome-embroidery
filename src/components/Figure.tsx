// A figure shown as an icon and its number on a phone or tablet, where a sentence would not fit. The icon comes from the
// desktop's icon set (or a plain dot for colour changes, which the set has no glyph for). The full sentence is the figure's
// accessible name and its tooltip, so a screen reader and a hover still get the words.
export function Figure({icon, value, label}: {icon?: string; value: string; label: string}) {
 return (
  <span className="figure" role="img" aria-label={label} title={label}>
   {icon ? <svg className="icon" aria-hidden="true" focusable="false"><use href={`#${icon}`} /></svg> : <span className="figure-dot" aria-hidden="true" />}
   <span aria-hidden="true">{value}</span>
  </span>
 );
}
