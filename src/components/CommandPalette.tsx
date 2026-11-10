import {useEffect, useRef, useSyncExternalStore} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent} from 'react';
import {useModalDialog} from './useModalDialog';
import {t} from '../i18n.js';
import {paletteRows, runCommand} from '../commandRegistry';
import type {PaletteRow} from '../commandRegistry';
import {paletteState, setPaletteActive, setPaletteOpen, setPaletteQuery} from '../commandPaletteState';

// The command palette: a search box over every command the menus, toolbar and shortcuts run. Recent (the last five runs)
// shows at the top while the box is empty. Up and Down move the selection, Enter runs it, Escape closes. A command that does
// not apply now stays in the list, greyed out, and Enter on it does nothing.
export function CommandPalette() {
 const {open, query, active} = useSyncExternalStore(paletteState.subscribe, paletteState.get);
 const ref = useRef<HTMLDialogElement>(null);
 const input = useRef<HTMLInputElement>(null);
 useModalDialog(ref, open);

 // Each time the palette opens, focus goes to the search box (the store has already emptied it).
 useEffect(() => {
  if (open) input.current?.focus();
 }, [open]);

 const {recent, all} = paletteRows(query);
 const items: Array<{key: string; row: PaletteRow}> = [
  ...recent.map(row => ({key: `recent:${row.id}`, row})),
  ...all.map(row => ({key: `all:${row.id}`, row})),
 ];
 const current = Math.min(active, Math.max(items.length - 1, 0));

 useEffect(() => {
  if (open) document.getElementById(`palette-${current}`)?.scrollIntoView({block: 'nearest'});
 }, [open, current]);

 const run = (row: PaletteRow) => {
  if (!row.enabled) return;
  setPaletteOpen(false);
  runCommand(row.id);
 };

 function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
   e.preventDefault();
   if (!items.length) return;
   const step = e.key === 'ArrowDown' ? 1 : -1;
   setPaletteActive((current + step + items.length) % items.length);
  } else if (e.key === 'Enter') {
   e.preventDefault();
   const picked = items[current];
   if (picked) run(picked.row);
  } else if (e.key === 'Escape') {
   // Closes the palette itself; a search box would otherwise just clear its text.
   e.preventDefault();
   setPaletteOpen(false);
  }
 }

 let index = -1;
 const group = (heading: string, rows: Array<{key: string; row: PaletteRow}>) => rows.length === 0 ? null : (
  <li role="presentation" key={heading}>
   <ul role="group" aria-label={heading} className="palette-group">
    <li role="presentation" className="palette-heading">{heading}</li>
    {rows.map(({key, row}) => {
     index += 1;
     const position = index;
     return (
      <li key={key} id={`palette-${position}`} role="option" aria-selected={position === current}
        aria-disabled={!row.enabled} className={`palette-row${position === current ? ' is-active' : ''}${row.enabled ? '' : ' is-disabled'}`}
        onMouseMove={() => setPaletteActive(position)} onClick={() => run(row)}>
       <span>{row.label}</span>
       {row.shortcut && <kbd>{row.shortcut}</kbd>}
      </li>
     );
    })}
   </ul>
  </li>
 );
 const recentItems = recent.map(row => ({key: `recent:${row.id}`, row}));
 const allItems = all.map(row => ({key: `all:${row.id}`, row}));

 return (
  <dialog id="commandPalette" ref={ref} className="command-palette" aria-label={t('Command palette')}
    onClose={() => setPaletteOpen(false)}>
   <input ref={input} id="paletteInput" type="text" role="combobox" aria-expanded="true" aria-controls="paletteList"
     aria-autocomplete="list" aria-activedescendant={items[current] ? `palette-${current}` : undefined}
     placeholder={t('Type a command')} value={query} autoComplete="off"
     onChange={e => setPaletteQuery(e.target.value)} onKeyDown={onKeyDown} />
   <ul role="listbox" id="paletteList" aria-label={t('Commands')} className="palette-list">
    {recentItems.length > 0 && group(t('Recent'), recentItems)}
    {group(query.trim() ? t('Matching commands') : t('All commands'), allItems)}
    {items.length === 0 && <li role="presentation" className="palette-empty">{t('No command matches.')}</li>}
   </ul>
  </dialog>
 );
}
