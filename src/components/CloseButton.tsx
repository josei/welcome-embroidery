import type {ButtonHTMLAttributes} from 'react';
import {t} from '../i18n.js';

// The one close control for every panel, sheet and dialog: a × glyph with no words. Its name is in aria-label and title. The
// data attribute marks it as this component, so the close-control spec can tell it from an ad-hoc close button.
export function CloseButton({label, onDark, className, ...rest}: ButtonHTMLAttributes<HTMLButtonElement> & {label?: string; onDark?: boolean}) {
 const name = label ?? t('Close');
 const classes = ['close-control', onDark ? 'on-dark' : '', className ?? ''].filter(Boolean).join(' ');
 return (
  <button type="button" className={classes} data-close-control aria-label={name} title={name} {...rest}>
   <svg className="icon" aria-hidden="true" focusable="false"><use href="#i-close" /></svg>
  </button>
 );
}
