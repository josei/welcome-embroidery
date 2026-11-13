// The Arrange button on the selection bar and its one sheet. The sheet has four groups: Align (with Distribute),
// Flip, Order and Boolean. It is portalled to the body, because the bar scrolls sideways and would clip a sheet inside it.
import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {alignActions, alignState} from '../alignState.js';
import {selectionState} from '../selectionState.js';
import {selectionToolbarActions, selectionToolbarState} from '../selectionToolbarState.js';
import {moveSelection} from '../sewingOrder.js';
import {t} from '../i18n.js';

type Item = {key: string; label: string; icon?: string; disabled: boolean; run: () => void};

export function ArrangeSheet() {
 const [open, setOpen] = useState(false);
 const [place, setPlace] = useState<{top?: number; bottom?: number; left: number}>({left: 0});
 const trigger = useRef<HTMLButtonElement>(null);
 const sheet = useRef<HTMLDivElement>(null);
 const align = useSyncExternalStore(alignState.subscribe, alignState.get);
 const toolbar = useSyncExternalStore(selectionToolbarState.subscribe, selectionToolbarState.get);
 const selection = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const noneSelected = selection.multi.size === 0;

 useEffect(() => {
  if (!open) return;
  const away = (e: Event) => {
   const target = e.target as Node;
   if (!trigger.current?.contains(target) && !sheet.current?.contains(target)) setOpen(false);
  };
  const escape = (e: KeyboardEvent) => {
   if (e.key !== 'Escape') return;
   setOpen(false);
   trigger.current?.focus();
  };
  document.addEventListener('pointerdown', away);
  document.addEventListener('keydown', escape);
  return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
 }, [open]);

 const toggle = () => {
  if (!open && trigger.current) {
   const r = trigger.current.getBoundingClientRect();
   // Opens away from the nearer window edge: below the button when it is in the top half, above it at the bottom (the phone bar). Kept inside on the right.
   const left = Math.max(8, Math.min(r.left, window.innerWidth - 264));
   setPlace(r.top > window.innerHeight / 2 ? {bottom: window.innerHeight - r.top + 6, left} : {top: r.bottom + 6, left});
  }
  setOpen(!open);
 };
 // Choosing a row runs it and closes the sheet, as the Arrange menu does.
 const choose = (run: () => void) => { setOpen(false); trigger.current?.focus(); run(); };
 const press = (name: string) => () => alignActions.press(name);
 const flip = (name: 'flipH' | 'flipV') => () => selectionToolbarActions.press(name);
 const bool = (name: 'subtract' | 'union' | 'intersect') => () => selectionToolbarActions.press(name);

 const groups: Array<{title: string; items: Item[]}> = [
  {title: t('Align'), items: [
   {key: 'left', label: t('Align left'), icon: 'i-al-left', disabled: align.align, run: press('left')},
   {key: 'hcenter', label: t('Align horizontal centers'), icon: 'i-al-hcenter', disabled: align.align, run: press('hcenter')},
   {key: 'right', label: t('Align right'), icon: 'i-al-right', disabled: align.align, run: press('right')},
   {key: 'top', label: t('Align top'), icon: 'i-al-top', disabled: align.align, run: press('top')},
   {key: 'vcenter', label: t('Align vertical centers'), icon: 'i-al-vcenter', disabled: align.align, run: press('vcenter')},
   {key: 'bottom', label: t('Align bottom'), icon: 'i-al-bottom', disabled: align.align, run: press('bottom')},
   {key: 'horizontal', label: t('Distribute horizontally'), icon: 'i-dist-h', disabled: align.distribute, run: press('horizontal')},
   {key: 'vertical', label: t('Distribute vertically'), icon: 'i-dist-v', disabled: align.distribute, run: press('vertical')},
  ]},
  {title: t('Flip'), items: [
   {key: 'flipH', label: t('Flip horizontally'), icon: 'i-flip-h', disabled: toolbar.flip, run: flip('flipH')},
   {key: 'flipV', label: t('Flip vertically'), icon: 'i-flip-v', disabled: toolbar.flip, run: flip('flipV')},
  ]},
  {title: t('Order'), items: [
   {key: 'front', label: t('Bring to front'), disabled: noneSelected, run: () => moveSelection('front')},
   {key: 'back', label: t('Send to back'), disabled: noneSelected, run: () => moveSelection('back')},
  ]},
  {title: t('Boolean'), items: [
   {key: 'subtract', label: t('Subtract'), disabled: toolbar.subtract, run: bool('subtract')},
   {key: 'union', label: t('Union'), disabled: toolbar.union, run: bool('union')},
   {key: 'intersect', label: t('Intersect'), disabled: toolbar.intersect, run: bool('intersect')},
  ]},
 ];

 const body: ReactNode = (
  <div ref={sheet} role={"dialog"} aria-label={t('Arrange')} className={"arrange-sheet"} id={"arrangeSheet"} style={{top: place.top, bottom: place.bottom, left: place.left}}>
   {groups.map(group => (
    <section key={group.title} className={"arrange-group"}>
     <h3 className={"arrange-title"}>{group.title}</h3>
     <div className={"arrange-items"}>
      {group.items.map(item => (
       <button key={item.key} type={"button"} className={"arrange-item"} data-arrange={item.key} aria-label={item.label} title={item.label}
        data-tooltip={item.label} disabled={item.disabled} onClick={() => choose(item.run)}>
        {item.icon ? <svg className={"icon"} aria-hidden={"true"}><use href={`#${item.icon}`} /></svg> : null}
        <span>{item.label}</span>
       </button>
      ))}
     </div>
    </section>
   ))}
  </div>
 );

 return (
  <>
   <button type={"button"} ref={trigger} className={"icon-button tb-start"} id={"arrangeBtn"} aria-haspopup={"dialog"} aria-expanded={open}
    aria-controls={"arrangeSheet"} aria-label={t('Arrange')} title={t('Arrange')} data-tooltip={t('Arrange')} onClick={toggle}>
    <svg className={"icon"}><use href={"#i-arrange"} /></svg>
   </button>
   {open ? createPortal(body, document.body) : null}
  </>
 );
}
