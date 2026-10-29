import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {t} from '../i18n.js';
import {THREAD_PALETTE, recents, remember} from '../threadPalette.js';
import {closeThreadPopover, threadPopoverState} from '../threadPopoverState.js';
// The thread colour picker, rendered by React once for every thread select. Ids and classes match the picker it replaced,
// because the styles and the tests use them.
export function ThreadPopover() {
 const {owner, anchor} = useSyncExternalStore(threadPopoverState.subscribe, threadPopoverState.get);
 const ref = useRef<HTMLDivElement>(null);
 const [place, setPlace] = useState({left: 0, top: 0});
 const cur = (owner?.value || '').toLowerCase();
 const valid = /^#[0-9a-f]{6}$/.test(cur);
 const [colour, setColour] = useState('#527461');
 const [hexText, setHexText] = useState('');
 useEffect(() => {
  setColour(valid ? cur : '#527461');
  setHexText(valid ? cur : '');
 }, [owner?.id, cur, valid]);
 // Place the picker beside its button, after it has been drawn so its size is known.
 useLayoutEffect(() => {
  const pop = ref.current;
  if (!owner || !anchor || !pop) return;
  const h = pop.offsetHeight, vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  setPlace({
   left: Math.max(6, Math.min(vw - pop.offsetWidth - 6, anchor.right - pop.offsetWidth)),
   top: Math.max(6, anchor.bottom + 6 + h > vh ? anchor.top - h - 6 : anchor.bottom + 6),
  });
 }, [owner, anchor]);
 // Close on a press outside the picker (a thread button press is left to that button) and on Escape.
 useEffect(() => {
  if (!owner) return;
  const onPointer = (e: PointerEvent) => {
   const target = e.target as Element;
   if (ref.current && !ref.current.contains(target) && !target.closest?.('.thread-btn')) closeThreadPopover();
  };
  const onKey = (e: KeyboardEvent) => {
   if (e.key === 'Escape') {
    e.stopImmediatePropagation();
    closeThreadPopover();
   }
  };
  document.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('keydown', onKey, true);
  return () => {
   document.removeEventListener('pointerdown', onPointer, true);
   window.removeEventListener('keydown', onKey, true);
  };
 }, [owner]);
 const pick = (hex: string) => {
  if (!owner) return;
  if (hex) remember(hex);
  const apply = owner.onPick;
  closeThreadPopover();
  apply(hex);
 };
 const useTyped = () => {
  const v = hexText.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) pick(v);
 };
 const recent = owner ? recents() : [];
 return (
  <div id="threadPop" ref={ref} role="dialog" aria-label={t('Choose a thread colour')} hidden={!owner} style={{left: place.left, top: place.top}}>
   {owner && (
    <>
     <button type="button" className="none-btn" onClick={() => pick('')}>{t('None')}</button>
     <div className="grid">
      {THREAD_PALETTE.map(([name, hex]) => (
       <button key={hex} type="button" style={{background: hex}} title={t(name)} aria-label={t(name)} aria-pressed={hex === cur} onClick={() => pick(hex)} />
      ))}
     </div>
     {recent.length > 0 && (
      <>
       <h5>{t('Recent')}</h5>
       <div className="grid">
        {recent.map(hex => <button key={hex} type="button" style={{background: hex}} title={hex} aria-label={hex} onClick={() => pick(hex)} />)}
       </div>
      </>
     )}
     <div className="custom">
      <input type="color" value={colour} aria-label={t('Custom colour')} onChange={e => { setColour(e.target.value); setHexText(e.target.value); }} />
      <input type="text" value={hexText} placeholder="#rrggbb" maxLength={7} aria-label={t('Hex colour')} onChange={e => setHexText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); useTyped(); } }} />
      <button type="button" onClick={useTyped}>{t('Use')}</button>
     </div>
    </>
   )}
  </div>
 );
}
