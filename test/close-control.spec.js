import {test,expect} from '@playwright/test';

// Every panel, sheet and dialog closes with the one shared close control: a × glyph (i-close) with no words, the same component
// (CloseButton.tsx, marked data-close-control) at every size, drawn no bigger than the top bar's icon buttons and no taller than
// its heading row. The surfaces are found from the DOM, not from a list, so a panel or dialog added later is checked too.
const SIZES=[[360,640],[390,844],[844,390],[768,1024]];
const LANGS=[['en','/'],['es','/?lang=es']];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Returns one problem per close control that breaks the rule, for every visible button named Close or Cerrar on the page. It runs
// in the page, so it reads the same boxes a user sees.
const CLOSE_PROBLEMS=`(() => {
 const named=/^(close|cerrar)$/i;
 const visible=el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
 const name=el=>(el.getAttribute('aria-label')||el.textContent||'').trim();
 const top=document.querySelector('.top .icon-button svg.icon, .top .icon-button .icon');
 const topIcon=top?top.getBoundingClientRect().width:18;
 const problems=[];
 for(const el of document.querySelectorAll('button')){
  if(!visible(el)||!named.test(name(el)))continue;
  const label=el.getAttribute('aria-label')||el.textContent.trim();
  const where=(el.closest('[id]')?.id||el.closest('dialog,aside,[role=dialog]')?.tagName||'page')+' '+label;
  if(el.textContent.trim())problems.push(where+': has visible text "'+el.textContent.trim()+'"');
  if(!el.hasAttribute('data-close-control'))problems.push(where+': is not the shared close control');
  const use=el.querySelector('svg use');
  if(!use||use.getAttribute('href')!=='#i-close')problems.push(where+': lacks the i-close glyph');
  const row=el.closest('.sheet-head,.layers-head,.dialog-head');
  if(row){
   const rr=row.getBoundingClientRect(),br=el.getBoundingClientRect();
   if(br.height>rr.height+0.5)problems.push(where+': is taller ('+br.height+') than its heading row ('+rr.height+')');
  }
  const svg=el.querySelector('svg.icon');
  if(svg&&svg.getBoundingClientRect().width>topIcon+0.5)problems.push(where+': glyph is bigger than the top bar icons ('+svg.getBoundingClientRect().width+' > '+topIcon+')');
 }
 return problems;
})()`;

// Opens every dialog in the DOM (showModal) and every panel with the phone sheet class, checks the close controls it finds, then
// shuts it again. A surface is found from the DOM, so one added later is swept without any change here. Returns the number of
// surfaces checked and every problem found.
async function sweepSurfaces(page){
 const found=new Set();let surfaces=0;
 const dialogs=await page.locator('dialog').count();
 for(let i=0;i<dialogs;i++){
  const d=page.locator('dialog').nth(i);
  const wasOpen=await d.evaluate(e=>e.open);
  if(!wasOpen) await d.evaluate(e=>{try{e.showModal();}catch{}});
  if(!(await d.evaluate(e=>e.open)))continue;
  surfaces++;
  for(const p of await page.evaluate(CLOSE_PROBLEMS))found.add(p);
  if(!wasOpen) await d.evaluate(e=>e.close());
 }
 const panels=await page.locator('aside.panel').count();
 for(let i=0;i<panels;i++){
  const panel=page.locator('aside.panel').nth(i);
  const wasOpen=await panel.evaluate(p=>p.classList.contains('sheet-open'));
  await panel.evaluate(p=>p.classList.add('sheet-open'));
  surfaces++;
  for(const p of await page.evaluate(CLOSE_PROBLEMS))found.add(p);
  if(!wasOpen) await panel.evaluate(p=>p.classList.remove('sheet-open'));
 }
 return {surfaces,problems:[...found]};
}

for(const [width,height] of SIZES) for(const [lang,path] of LANGS){
 test(`every panel, sheet and dialog closes with the shared × control at ${width}x${height} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.setViewportSize({width,height});
  await page.goto(path);
  await expect(page.locator('#phoneMenu, .top')).not.toHaveCount(0);
  const {surfaces,problems}=await sweepSurfaces(page);
  expect(surfaces,'the sweep found the editor’s panels and dialogs').toBeGreaterThan(3);
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
 });
}

// On a phone the Layers and Properties sheets open from the Menu and close with their × control.
for(const [width,height] of [[390,844],[844,390]]) for(const [lang,path] of LANGS){
 test(`the × in the Layers and Properties headers closes each sheet at ${width}x${height} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.setViewportSize({width,height});
  await page.goto(path);
  for(const [item,sheet] of [['#menuLayers','#layersSheet'],['#menuProperties','#inspector']]){
   await page.locator('#phoneMenu').click();
   await page.locator(item).click();
   await expect(page.locator(sheet)).toHaveClass(/sheet-open/);
   const close=page.locator(sheet).getByRole('button',{name:/^(Close|Cerrar)$/});
   await expect(close).toHaveCount(1);
   await expect(close).toHaveAttribute('data-close-control','true');
   await close.click();
   await expect(page.locator(sheet)).not.toHaveClass(/sheet-open/);
  }
  expect(errors).toEqual([]);
 });
}

// The check itself must catch what it claims to. Each case adds a surface the way a future change might, and expects a problem.
test('the check fails on an ad-hoc close button in a new dialog, and on a text Close in a header',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.evaluate(()=>{
  const d=document.createElement('dialog');d.id='adHocDialog';
  d.innerHTML='<div><h2>New panel</h2><button type="button" class="my-close" aria-label="Close">×</button></div>';
  document.body.appendChild(d);
  const header=document.createElement('div');header.className='dialog-head';header.innerHTML='<h2>Header</h2><button type="button">Close</button>';
  const e=document.createElement('dialog');e.id='textCloseDialog';e.appendChild(header);document.body.appendChild(e);
  d.showModal();e.showModal();
 });
 const problems=await page.evaluate(CLOSE_PROBLEMS);
 expect(problems.some(p=>/is not the shared close control/.test(p)),'ad-hoc close flagged').toBe(true);
 expect(problems.some(p=>/has visible text "Close"/.test(p)),'text Close flagged').toBe(true);
});
