import type {MouseEventHandler, ReactNode} from 'react';

// The one tile the phone bars are built from: the context bar under the canvas, the tool dock and the landscape rail.
// A tile is a glyph over a word (or a glyph alone for − and +, whose names are the same in both languages). Its full
// name is its aria-label and tooltip, so a glyph-only tile still reads by name. Selected (a tool armed, a toggle on, a
// tile whose menu is open) draws a mint fill with a 1 px teal border inside the tile; the rest state has no border.
// Sizes, radius and fill come from the `.chrome-tile` rules in styles.css, so every tile on a phone looks the same.
type ChromeTileProps = {
 id?: string;
 /** The glyph's symbol name, without the `i-` prefix. */
 icon?: string;
 /** The word under the glyph. Omit for a glyph-only tile. */
 label?: ReactNode;
 /** The full name, read by screen readers and shown as the tooltip. Defaults to the label. */
 name: string;
 /** Selected: the command is armed or on (a tool, a toggle, a pressed hand). */
 selected?: boolean;
 /** Set for tiles that act as toggles, so aria-pressed says the same as the fill. */
 pressed?: boolean;
 /** The tile opens a menu. */
 expanded?: boolean;
 disabled?: boolean;
 className?: string;
 onClick?: MouseEventHandler<HTMLButtonElement>;
 /** Tile content for the zoom stepper's percentage, which is text rather than a glyph and word. */
 children?: ReactNode;
};

export function ChromeTile({id, icon, label, name, selected = false, pressed, expanded, disabled, className, onClick, children}: ChromeTileProps) {
 const classes = ['chrome-tile', selected && 'is-selected', label === undefined && !children && 'glyph-only', className].filter(Boolean).join(' ');
 return (
  <button type="button" id={id} className={classes} aria-label={name} title={name} aria-pressed={pressed} aria-expanded={expanded}
   aria-haspopup={expanded === undefined ? undefined : 'menu'} disabled={disabled} onClick={onClick}>
   {icon ? <svg className="icon" aria-hidden="true" focusable="false"><use href={`#i-${icon}`} /></svg> : null}
   {label !== undefined ? <span className="tile-word">{label}</span> : null}
   {children}
  </button>
 );
}
