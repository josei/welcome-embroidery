import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {DragEvent, MouseEvent} from 'react';
import {documentState} from '../documentState.js';
import {selectionState} from '../selectionState.js';
import {layersActions} from '../layersState.js';
import {sewingCountsState} from '../sewingCountsState.js';
import {compileIssueState} from '../compileIssueState.js';
import {t} from '../i18n.js';
// The object list in sewing order, rendered by React. It is a listbox: each row is an option that a click, or Enter or Space,
// selects (Shift adds to the selection). Hide and Lock are their own buttons beside each row, not inside it. Groups collapse,
// a double click renames, and rows drag to reorder. Ids and classes match the markup it replaced, because the styles and tests use them.
interface Obj {
 id: string;
 name?: string;
 kind: string;
 thread?: string;
 stitch?: string;
 visible?: boolean;
 locked?: boolean;
 groupId?: string;
}
// The icon of each stitch type, the same ones the stitch type cards show.
const STITCH_ICON: Record<string, string> = {
 fill: 'i-fill',
 run: 'i-run',
 satin: 'i-satin',
 motif: 'i-cross',
 sequin: 'i-ripple',
 bead: 'i-satin',
 bling: 'i-ripple',
};
const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#${name}`} /></svg>;
type Drop = {id: string; after: boolean};
type Entry = {kind: 'group'; groupId: string; members: Obj[]; open: boolean} | {kind: 'row'; o: Obj; depth: number};

// Groups are listed once, at their first member; the members follow, unless the group is collapsed.
function entriesOf(objects: Obj[], collapsed: Set<string>): Entry[] {
 const out: Entry[] = [], seen = new Set<string>();
 for (const o of objects) {
  if (seen.has(o.id)) continue;
  if (o.groupId) {
   const members = objects.filter(v => v.groupId === o.groupId);
   members.forEach(m => seen.add(m.id));
   const open = !collapsed.has(o.groupId);
   out.push({kind: 'group', groupId: o.groupId, members, open});
   if (open) for (const m of members) out.push({kind: 'row', o: m, depth: 1});
  } else {
   seen.add(o.id);
   out.push({kind: 'row', o, depth: 0});
  }
 }
 return out;
}

// A group's stitches are the sum of its members' counts, if any member has one.
function groupCount(members: Obj[], counts: Record<string, number>): number | undefined {
 const known = members.map(m => counts[m.id]).filter((n): n is number => n !== undefined);
 return known.length ? known.reduce((sum, n) => sum + n, 0) : undefined;
}

function useObjects(): Obj[] {
 const {doc} = useSyncExternalStore(documentState.subscribe, documentState.get);
 return doc.objects ?? [];
}

// The heading: the object count and the thread count, as the sewing order panel shows them.
export function ObjectListHead() {
 const objects = useObjects();
 const n = objects.length, threads = new Set(objects.map(o => o.thread)).size;
 const objectsText = n === 1 ? t('1 object') : t('{n} objects', {n});
 const threadsText = threads === 1 ? t('1 thread') : t('{m} threads', {m: threads});
 return <div className="layers-head"><h3>{t('Sewing order')}</h3><span>{`${objectsText} · ${threadsText}`}</span></div>;
}

// The name field of a row being renamed. Enter or leaving the field keeps the text, Escape drops it.
function RenameField({name, onDone}: {name: string; onDone: (text: string | null) => void}) {
 const ref = useRef<HTMLInputElement>(null);
 const finished = useRef(false);
 useEffect(() => {
  ref.current?.focus();
  ref.current?.select();
 }, []);
 const done = (keep: boolean) => {
  if (finished.current || !ref.current) return;
  finished.current = true;
  onDone(keep ? ref.current.value : null);
 };
 return (
  <input
   ref={ref}
   className="row-rename"
   defaultValue={name}
   maxLength={120}
   onClick={e => e.stopPropagation()}
   onKeyDown={e => {
    e.stopPropagation();
    if (e.key === 'Enter') done(true);
    else if (e.key === 'Escape') done(false);
   }}
   onBlur={() => done(true)}
  />
 );
}

// The stitch count as the row shows it. Before any count exists, a row the failed compile names says so instead of showing nothing.
const stitchesText = (count: number) => (count === 1 ? t('1 stitch') : t('{n} stitches', {n: count.toLocaleString()}));
const countText = (count: number | undefined, warning: string | undefined) => {
 if (count !== undefined) return stitchesText(count);
 return warning ? t('not compiled') : '';
};

function ObjectRow({o, depth, selected, dropping, renaming, count, warning, onRenameDone, onSelect, onToggleVisible, onToggleLock}: {
 o: Obj;
 depth: number;
 selected: boolean;
 dropping: Drop | null;
 renaming: boolean;
 count: number | undefined;
 warning: string | undefined;
 onRenameDone: (text: string | null) => void;
 onSelect: (shift: boolean) => void;
 onToggleVisible: () => void;
 onToggleLock: () => void;
}) {
 const name = o.name || o.kind;
 const hidden = o.visible === false, locked = Boolean(o.locked);
 const drop = dropping && (dropping.after ? 'drop-after' : 'drop-before');
 const cls = ['object-row', selected && 'selected', hidden && 'is-hidden', locked && 'is-locked', drop].filter(Boolean).join(' ');
 const stitchIcon = o.kind === 'stitch_layer' ? undefined : STITCH_ICON[o.stitch ?? ''];
 const label = [name, countText(count, warning)].filter(Boolean).join(' · ');
 // Hide and Lock are siblings of the row, not descendants, so the row's accessible name is only the object's name and count.
 return (
  <div className="object-line" role="none">
   <div
    className={cls}
    data-id={o.id}
    draggable={true}
    tabIndex={0}
    role="option"
    aria-selected={selected}
    aria-label={label}
    style={{paddingLeft: `${8 + depth * 16}px`}}
    onKeyDown={e => {
     if (e.target !== e.currentTarget) return;
     if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(e.shiftKey);
     }
    }}
   >
    <i className="swatch" style={{background: o.thread}} />
    {stitchIcon && <svg className="icon row-icon" aria-hidden="true"><use href={`#${stitchIcon}`} /></svg>}
    <span className="row-text">
     {renaming ? <RenameField name={o.name || ''} onDone={onRenameDone} /> : <span className="row-name">{name}</span>}
     <span className="row-tag">
      {[o.kind === 'stitch_layer' ? t('machine stitches') : t(o.stitch), countText(count, warning)].filter(Boolean).join(' · ')}
     </span>
    </span>
    {warning && <span className="row-warn" role="img" aria-label={warning} title={warning}>⚠</span>}
   </div>
   <button
    type="button"
    className="row-btn row-eye"
    aria-label={`Hide ${name}`}
    aria-pressed={hidden}
    title={`Hide ${name}`}
    onClick={onToggleVisible}
   >
    {icon(hidden ? 'i-eye-off' : 'i-eye')}
   </button>
   <button
    type="button"
    className={`row-btn row-lock${locked ? ' on' : ''}`}
    aria-label={`Lock ${name}`}
    aria-pressed={locked}
    title={`Lock ${name}`}
    onClick={onToggleLock}
   >
    {icon(locked ? 'i-lock' : 'i-unlock')}
   </button>
  </div>
 );
}

function GroupRow({groupId, members, open, selectedIds, count, warning, onSelect, onToggleOpen, onToggleVisible, onToggleLock}: {
 groupId: string;
 members: Obj[];
 open: boolean;
 selectedIds: Set<string>;
 count: number | undefined;
 warning: string | undefined;
 onSelect: (shift: boolean) => void;
 onToggleOpen: () => void;
 onToggleVisible: () => void;
 onToggleLock: () => void;
}) {
 const all = members.every(m => selectedIds.has(m.id));
 const hiddenAll = members.every(m => m.visible === false);
 const lockedAll = members.every(m => m.locked);
 const name = `Group · ${members.length} objects`;
 const label = [name, countText(count, warning)].filter(Boolean).join(' · ');
 return (
  <div className="object-line group-line" role="none">
   <button type="button" className="row-btn group-caret" aria-label={`${open ? 'Collapse' : 'Expand'} group`} aria-expanded={open} onClick={onToggleOpen}>
    {icon(open ? 'i-chevron' : 'i-chevron-right')}
   </button>
   <div
    className={`group-row${all ? ' selected' : ''}`}
    data-group={groupId}
    tabIndex={0}
    role="option"
    aria-selected={all}
    aria-label={label}
    onKeyDown={e => {
     if (e.target !== e.currentTarget) return;
     if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(e.shiftKey);
     }
    }}
   >
    {icon('i-group')}
    <span className="row-text">
     <span className="row-name">{name}</span>
     {countText(count, warning) && <span className="row-tag">{countText(count, warning)}</span>}
    </span>
    {warning && <span className="row-warn" role="img" aria-label={warning} title={warning}>⚠</span>}
   </div>
   <button type="button" className="row-btn row-eye" aria-label={`Hide ${name}`} aria-pressed={hiddenAll} title={`Hide ${name}`} onClick={onToggleVisible}>
    {icon(hiddenAll ? 'i-eye-off' : 'i-eye')}
   </button>
   <button type="button" className={`row-btn row-lock${lockedAll ? ' on' : ''}`} aria-label={`Lock ${name}`} aria-pressed={lockedAll} title={`Lock ${name}`} onClick={onToggleLock}>
    {icon(lockedAll ? 'i-lock' : 'i-unlock')}
   </button>
  </div>
 );
}

export function ObjectList() {
 const objects = useObjects();
 const sel = useSyncExternalStore(selectionState.subscribe, selectionState.get);
 const counts = useSyncExternalStore(sewingCountsState.subscribe, sewingCountsState.get);
 const issue = useSyncExternalStore(compileIssueState.subscribe, compileIssueState.get);
 // The reason a failed compile gives, on the rows it names. The counts above stay on their rows meanwhile.
 const warningFor = (id: string) => (issue?.objectIds.includes(id) ? `Can't compile: ${issue.message}` : undefined);
 const groupWarning = (members: Obj[]) => members.map(m => warningFor(m.id)).find(Boolean);
 const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
 const [renaming, setRenaming] = useState<string | null>(null);
 const [drop, setDrop] = useState<Drop | null>(null);
 const dragging = useRef<string | null>(null);
 const lastClick = useRef<{id: string; t: number} | null>(null);
 const idsOfGroup = (groupId: string) => objects.filter(o => o.groupId === groupId).map(o => o.id);
 const idsWithGroup = (id: string) => {
  const g = objects.find(o => o.id === id)?.groupId;
  return g ? idsOfGroup(g) : [id];
 };
 // Selecting a row or group is the same whether a click or the keyboard (Enter or Space) asks for it. Shift adds or removes one.
 const selectRow = (id: string, shift: boolean) => {
  if (shift) {
   const next = new Set(sel.multi);
   if (next.has(id) && next.size > 1) next.delete(id);
   else next.add(id);
   layersActions.select([...next], id);
  } else {
   layersActions.select(idsWithGroup(id), id);
  }
 };
 const selectGroup = (groupId: string, shift: boolean) => {
  const ids = idsOfGroup(groupId);
  if (shift) layersActions.select([...new Set([...sel.multi, ...ids])], ids.at(-1)!);
  else layersActions.select(ids, ids.at(-1)!);
 };
 // Hide and Lock toggle the given objects: they show or unlock unless every one already is.
 const toggleVisible = (ids: string[]) => {
  const hide = !objects.filter(o => ids.includes(o.id)).every(o => o.visible === false);
  layersActions.setVisible(ids, !hide);
 };
 const toggleLocked = (ids: string[]) => {
  const lock = !objects.filter(o => ids.includes(o.id)).every(o => o.locked);
  layersActions.setLocked(ids, lock);
 };
 const toggleGroupOpen = (groupId: string) => {
  setCollapsed(c => {
   const next = new Set(c);
   if (next.has(groupId)) next.delete(groupId);
   else next.add(groupId);
   return next;
  });
 };
 // One handler for the rows and group rows: it reads the row or group the click landed on. Hide, Lock and the group caret are
 // their own buttons, beside the row, with their own handlers.
 const onClick = (e: MouseEvent<HTMLDivElement>) => {
  const target = e.target as Element;
  const head = target.closest<HTMLElement>('.group-row');
  const row = target.closest<HTMLElement>('.object-row');
  if (head) {
   selectGroup(head.dataset.group!, e.shiftKey);
   return;
  }
  if (!row) return;
  const id = row.dataset.id!;
  if (!e.shiftKey && target.closest('.row-name')) {
   const now = performance.now();
   if (lastClick.current && lastClick.current.id === id && now - lastClick.current.t < 450) {
    lastClick.current = null;
    setRenaming(id);
    return;
   }
   lastClick.current = {id, t: now};
  }
  selectRow(id, e.shiftKey);
 };
 const onDragStart = (e: DragEvent<HTMLDivElement>) => {
  const row = (e.target as Element).closest<HTMLElement>('.object-row');
  if (!row) return;
  dragging.current = row.dataset.id!;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', row.dataset.id!);
 };
 const onDragOver = (e: DragEvent<HTMLDivElement>) => {
  const row = (e.target as Element).closest<HTMLElement>('.object-row');
  if (!dragging.current || !row || row.dataset.id === dragging.current) return;
  e.preventDefault();
  const r = row.getBoundingClientRect();
  const next = {id: row.dataset.id!, after: e.clientY > r.top + r.height / 2};
  setDrop(d => (d && d.id === next.id && d.after === next.after ? d : next));
 };
 const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
  if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
 };
 const onDrop = (e: DragEvent<HTMLDivElement>) => {
  const row = (e.target as Element).closest<HTMLElement>('.object-row');
  const from = dragging.current;
  setDrop(null);
  if (!from || !row || row.dataset.id === from) {
   dragging.current = null;
   return;
  }
  e.preventDefault();
  const fromIndex = objects.findIndex(o => o.id === from), target = objects.findIndex(o => o.id === row.dataset.id);
  const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
  let to = target + (after ? 1 : 0);
  if (fromIndex < to) to--;
  dragging.current = null;
  if (to !== fromIndex) layersActions.reorder(from, to);
 };
 const onDragEnd = () => {
  dragging.current = null;
  setDrop(null);
 };
 return (
  <div id="objects" onClick={onClick} onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onDragEnd={onDragEnd}>
   {issue && <div className="list-warning" role="status">{`⚠ Can't compile: ${issue.message}`}</div>}
   {objects.length === 0 && <p className="sel-hint empty-hint">{t('No objects yet. Draw a shape or import an image to start.')}</p>}
   {objects.length > 0 && (
    <div className="object-rows" role="listbox" aria-label={t('Sewing order')} aria-multiselectable="true">
     {entriesOf(objects, collapsed).map(entry => entry.kind === 'group' ? (
      <GroupRow
       key={`group:${entry.groupId}`}
       groupId={entry.groupId}
       members={entry.members}
       open={entry.open}
       selectedIds={sel.multi}
       count={groupCount(entry.members, counts)}
       warning={groupWarning(entry.members)}
       onSelect={shift => selectGroup(entry.groupId, shift)}
       onToggleOpen={() => toggleGroupOpen(entry.groupId)}
       onToggleVisible={() => toggleVisible(entry.members.map(m => m.id))}
       onToggleLock={() => toggleLocked(entry.members.map(m => m.id))}
      />
     ) : (
      <ObjectRow
       key={entry.o.id}
       o={entry.o}
       depth={entry.depth}
       selected={sel.multi.has(entry.o.id)}
       dropping={drop && drop.id === entry.o.id ? drop : null}
       renaming={renaming === entry.o.id}
       count={counts[entry.o.id]}
       warning={warningFor(entry.o.id)}
       onRenameDone={text => {
        setRenaming(null);
        layersActions.rename(entry.o.id, text);
       }}
       onSelect={shift => selectRow(entry.o.id, shift)}
       onToggleVisible={() => toggleVisible([entry.o.id])}
       onToggleLock={() => toggleLocked([entry.o.id])}
      />
     ))}
    </div>
   )}
  </div>
 );
}
