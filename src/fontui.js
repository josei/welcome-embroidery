import {t} from './i18n.js';
// Font picker: a searchable, filterable list where every row previews the text being edited in that font.
// Rows load their font lazily (IntersectionObserver), so opening the picker never downloads all 195 fonts at once.
import {textPrimitives,geometry} from './engine.js';
import {getFont} from './fonts.js';

const SVG='http://www.w3.org/2000/svg';
export const LEGACY=[{fid:'welcom-mono/1',name:'Welcome Mono',kind:'line',keywords:['running_stitch','sans_serif','latin'],license:'Original (GPL-3.0-or-later)',description:'Single-line capitals, 4–16 mm',size:8,minScale:.5,maxScale:2,legacy:true},
  {fid:'neon-blinking/1',name:'Néon blinking (centerline)',kind:'line',keywords:['running_stitch','sans_serif','latin'],license:'SIL Open Font License v1.1',description:'Ink/Stitch bean-stitch font as plain centerline running stitch',size:40,minScale:.5,maxScale:1.5,legacy:true}];
export const CATEGORIES=[['all','All',()=>true],['satin','Satin',f=>f.keywords?.includes('satin')],['fill','Fill',f=>f.kind==='outline'||f.prims?.includes('f')],['running','Running',f=>f.keywords?.includes('running_stitch')||f.kind==='line'],['cross','Cross stitch',f=>f.keywords?.includes('crossstitch')],
  ['serif','Serif',f=>f.keywords?.includes('serif')],['sans','Sans',f=>f.keywords?.some(k=>k==='sans_serif'||k==='sans')],['script','Script',f=>f.keywords?.some(k=>k==='handwriting'||k==='script')],['display','Display',f=>f.keywords?.some(k=>k==='display'||k==='monogram')],
  ['tt','TrueType',f=>f.kind==='outline'&&f.fid?.startsWith('ttf/')],['ink','Ink/Stitch',f=>f.fid?.startsWith('inkstitch/')],['custom','Loaded',f=>f.fid?.startsWith('custom/')]];

export async function fetchFontIndex(){const out=[...LEGACY];for(const group of ['inkstitch','ttf']){try{const r=await fetch(new URL(`../fonts/${group}/index.json`,import.meta.url));if(!r.ok)continue;for(const f of await r.json())out.push({...f,fid:`${group}/${f.id}`});}catch{}}return out;}

// Draw a font's rendering of `text` into an <svg>. Fills use even-odd rings, satin columns are shown as their band, running stitch as a thin line.
export function drawPreview(svg,fid,text,color='#1d2925'){
  svg.replaceChildren();const font=getFont(fid),legacy=!fid.includes('/')||fid==='welcom-mono/1'||fid==='neon-blinking/1';
  let shapes=[],size=font?.size||(fid==='neon-blinking/1'?40:8);const sample={kind:'text',x:0,y:0,h:size,font:fid,text:String(text||'Hello').slice(0,18),w:0,stitch:font?.kind==='outline'?'fill':'run'};
  try{
    if(legacy){const t={...sample,text:sample.text.toUpperCase(),w:sample.text.length*size*.72};shapes=geometry(t).map(l=>({t:'r',pts:l}));}
    else{if(!font)return false;shapes=textPrimitives(sample)||[];}
  }catch{return false;}
  if(!shapes.length)return false;
  const pts=shapes.flatMap(p=>p.t==='r'?p.pts:p.t==='s'?[...p.a,...p.b]:p.rings.flat());if(!pts.length)return false;
  const x0=Math.min(...pts.map(p=>p[0])),x1=Math.max(...pts.map(p=>p[0])),y0=Math.min(...pts.map(p=>p[1])),y1=Math.max(...pts.map(p=>p[1])),pad=size*.06,stroke=Math.max((y1-y0),size*.4)/90;
  svg.setAttribute('viewBox',`${x0-pad} ${y0-pad} ${Math.max(1,x1-x0+pad*2)} ${Math.max(1,y1-y0+pad*2)}`);svg.setAttribute('preserveAspectRatio','xMinYMid meet');
  const d=(rings,close)=>rings.map(r=>'M'+r.map(p=>`${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')+(close?'Z':'')).join('');
  const add=(attrs)=>{const el=document.createElementNS(SVG,'path');for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);svg.append(el);};
  for(const p of shapes){if(p.t==='f')add({d:d(p.rings,true),fill:color,'fill-rule':'evenodd'});else if(p.t==='s')add({d:d([[...p.a,...[...p.b].reverse()]],true),fill:color,'fill-opacity':'.9'});else add({d:d([p.pts],false),fill:'none',stroke:color,'stroke-width':stroke,'stroke-linecap':'round','stroke-linejoin':'round'});}
  return true;
}

export function createFontPicker({button,buttonPreview,buttonName,panel,search,chips,list,loadFile,fileInput,getIndex,getCurrent,getSample,getColor,ensureLoaded,onPick,onLoadFile}){
  let open=false,category='all',rows=[],active=-1,observer=null;
  const visible=()=>getIndex().filter(f=>(CATEGORIES.find(c=>c[0]===category)?.[2]||(()=>true))(f)&&(!search.value||`${f.name} ${f.license||''} ${f.original||''} ${(f.keywords||[]).join(' ')}`.toLowerCase().includes(search.value.trim().toLowerCase())));
  const label=f=>f?.name||'Font';
  chips.replaceChildren(...CATEGORIES.map(([id,name])=>{const b=document.createElement('button');b.type='button';b.className='chip';b.dataset.cat=id;b.textContent=name;b.setAttribute('aria-pressed',String(id===category));b.onclick=()=>{category=id;[...chips.children].forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.cat===id)));renderList();};return b;}));
  function renderList(){
    observer?.disconnect();list.replaceChildren();rows=[];const cur=getCurrent(),items=visible();
    observer=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;observer.unobserve(e.target);const f=e.target._font;(async()=>{try{await ensureLoaded(f.fid);}catch{e.target.classList.add('failed');return;}drawPreview(e.target.querySelector('svg'),f.fid,getSample(),getColor());})();}},{root:list,rootMargin:'120px'});
    for(const f of items){const row=document.createElement('div');row.className='font-row';row.setAttribute('role','option');row.tabIndex=-1;row._font=f;row.setAttribute('aria-selected',String(f.fid===cur));
      const tags=[f.kind==='outline'?'fill':f.kind==='line'?'running':(f.keywords||[]).filter(k=>['satin','running_stitch','crossstitch','applique','tartan'].includes(k)).map(k=>k.replace('_stitch','').replace('crossstitch','cross')).slice(0,2).join(' · ')||'stitch'].filter(Boolean);
      row.innerHTML=`<svg class="font-preview" aria-hidden="true"></svg><div class="font-meta"><b></b><span></span></div>`;row.querySelector('b').textContent=label(f);row.querySelector('span').textContent=`${tags[0].split(' · ').map(x=>t(x)).join(' · ')} · ${(f.license||'').replace('SIL Open Font License','OFL').replace(/ v?1\.1$/,'')}`;row.title=`${label(f)} — ${f.license||''}${f.original?` · ${t('based on')} ${f.original}`:''}${f.description?`\n${f.description}`:''}`;
      row.onclick=()=>pick(f.fid);list.append(row);rows.push(row);observer.observe(row);}
    if(!items.length){const empty=document.createElement('p');empty.className='font-empty';empty.textContent='No fonts match.';list.append(empty);}
    active=Math.max(0,rows.findIndex(r=>r._font.fid===cur));rows[active]?.scrollIntoView({block:'center'});highlight();
  }
  function highlight(){rows.forEach((r,i)=>r.classList.toggle('active',i===active));}
  function pick(fid){close();onPick(fid);}
  function place(){const r=button.getBoundingClientRect(),w=Math.min(400,innerWidth-16);panel.style.width=w+'px';panel.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px';panel.style.top=Math.min(r.bottom+6,Math.max(8,innerHeight-Math.min(560,innerHeight-16)-8))+'px';panel.style.maxHeight=Math.min(560,innerHeight-16)+'px';}
  function show(){open=true;panel.hidden=false;button.setAttribute('aria-expanded','true');search.value='';category='all';[...chips.children].forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.cat==='all')));place();renderList();search.focus();}
  function close(){if(!open)return;open=false;panel.hidden=true;button.setAttribute('aria-expanded','false');observer?.disconnect();button.focus();}
  button.onclick=()=>open?close():show();
  search.oninput=()=>renderList();
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(rows.length){active=(active+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;highlight();rows[active].scrollIntoView({block:'nearest'});}}else if(e.key==='Enter'&&document.activeElement===search&&rows[active]){e.preventDefault();pick(rows[active]._font.fid);}});
  document.addEventListener('pointerdown',e=>{if(open&&!panel.contains(e.target)&&!button.contains(e.target))close();});
  addEventListener('resize',()=>{if(open)place();});
  loadFile.onclick=()=>fileInput.click();fileInput.onchange=async()=>{const f=fileInput.files[0];fileInput.value='';if(!f)return;close();await onLoadFile(f);};
  return {refreshButton(){const f=getIndex().find(x=>x.fid===getCurrent());buttonName.textContent=label(f)||getCurrent();(async()=>{try{await ensureLoaded(getCurrent());}catch{}drawPreview(buttonPreview,getCurrent(),getSample(),getColor());})();},isOpen:()=>open,refresh:()=>{if(open)renderList();}};
}
