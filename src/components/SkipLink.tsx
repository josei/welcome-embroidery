import {t} from '../i18n.js';

// The first stop on the page: a link that is hidden until it takes focus and moves focus straight to the Select tool. Without it,
// Tab from the top passes the object list and the hoop fields (about 28 stops) before the first drawing tool. It does not move
// anything on screen while unfocused.
export function SkipLink() {
 return (
  <a className="skip-link" href="#select" onClick={e => {
   e.preventDefault();
   document.getElementById('select')?.focus();
  }}>{t('Skip to drawing tools')}</a>
 );
}
