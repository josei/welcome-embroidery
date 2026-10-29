import {useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {threadName} from '../threadPalette.js';
import {closeThreadPopover, openThreadPopover, threadPopoverState} from '../threadPopoverState.js';
// A thread choice: a hidden select (for the form, the keyboard and the tests) and the button that opens the colour picker.
// The select's options are the colours the picker offers, plus the current colour when it is not one of them.
const DEFAULT_THREADS = ['#527461', '#d9897e', '#d3ad61', '#89a377'];
export function ThreadSelect({id, label, value, onPick}: {id: string; label: string; value: string; onPick: (hex: string) => void}) {
 const {owner} = useSyncExternalStore(threadPopoverState.subscribe, threadPopoverState.get);
 const options = value && !DEFAULT_THREADS.includes(value) ? [...DEFAULT_THREADS, value] : DEFAULT_THREADS;
 const name = value ? threadName(value) : t('None');
 return (
  <>
   <select id={id} className="sr-only" tabIndex={-1} value={value} onChange={e => onPick(e.target.value)}>
    <option value="">None</option>
    {options.map(hex => <option key={hex} value={hex}>{threadName(hex)}</option>)}
   </select>
   <button type="button" className="thread-btn" aria-haspopup="dialog" aria-label={`${label}: ${name}`} onClick={e => {
    e.preventDefault();
    if (owner?.id === id) closeThreadPopover();
    else openThreadPopover({id, value, onPick}, e.currentTarget.getBoundingClientRect());
   }}>
    <span className={value ? 'sw' : 'sw none'} style={value ? {background: value} : undefined} />
    <span className="nm">{name}</span>
   </button>
  </>
 );
}
