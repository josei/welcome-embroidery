import {test,expect} from '@playwright/test';

// The font picker, the Settings dialog and the 3D overlay keep 44 px touch targets on phones and tablets, like the
// dock, the sheet fields and the inspector rows around them. Measured at 390x844 and 768x1024 in English and Spanish.
// A tick keeps its small glyph and its whole row is the target, so a sewing tip and the Show pull switch are measured
// by the label that wraps them.
test.use({hasTouch:true});
const SIZES=[[390,844],[768,1024]];
test.setTimeout(240000);
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// Every matched control, with its size, whether its own text overflows it, whether a tap at its centre lands on it, and
// its box for the overlap check. Elements with no drawn box (a closed dialog, a hidden sheet) are left out.
const measure=(page,selector)=>page.evaluate(sel=>{
 // Boxes and text fit are read in one layout, so the overlap check compares controls where they really sit. A chip row
 // scrolls sideways, so a chip far along it has no on-screen box until it is scrolled to; only its tap check scrolls.
 const found=[];
 for(const el of document.querySelectorAll(sel)){
  if(el.closest('.sr-only,[hidden]'))continue;
  const cs=getComputedStyle(el);
  if(cs.visibility==='hidden'||cs.display==='none')continue;
  const r=el.getBoundingClientRect();
  if(r.width<=1||r.height<=1)continue;
  found.push({el,name:`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''} "${(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,32)}"`,
   w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,
   cut:el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1,
   box:{x:r.x,y:r.y,w:r.width,h:r.height}});
 }
 return found.map(({el,name,w,h,cut,box})=>{
  el.scrollIntoView({block:'nearest',inline:'center'});
  const r=el.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;
  const hit=document.elementFromPoint(cx,cy);
  return {name,w,h,cut,box,hit:Boolean(hit&&(hit===el||el.contains(hit)))};
 });
},selector);

// Each control is at least 44x44, is not cut, answers a tap at its centre, and does not overlap the next one.
const expectTouchTargets=async(page,selector,where)=>{
 const list=await measure(page,selector);
 expect(list.length,`${where}: controls found`).toBeGreaterThan(0);
 expect(list.filter(c=>c.w<44||c.h<44).map(c=>`${c.name} ${c.w}x${c.h}`),`${where}: controls under 44 px`).toEqual([]);
 expect(list.filter(c=>c.cut).map(c=>c.name),`${where}: text cut inside its control`).toEqual([]);
 expect(list.filter(c=>!c.hit).map(c=>c.name),`${where}: tap at the centre misses the control`).toEqual([]);
 const overlaps=[];
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i].box,b=list[j].box;
  const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
  if(w>1&&h>1)overlaps.push(`${list[i].name} / ${list[j].name}`);
 }
 expect(overlaps,`${where}: controls overlap`).toEqual([]);
 return list;
};

// A text object, its Properties panel, then the font picker it opens. A phone keeps Properties in a sheet, so the
// sheet is opened first; a tablet shows the panel all the time.
async function openFontPicker(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#letter').click();
 const field=page.locator('#letteringText');
 if(!(await field.isVisible())){
  if(await page.locator('#propertiesBtn').isVisible())await page.locator('#propertiesBtn').click();
  if(!(await field.isVisible())){await page.locator('#phoneMenu').click();await page.locator('#menuProperties').click();}
 }
 await expect(field).toBeVisible();
 await field.fill('HI');
 await field.press('Tab');
 await page.locator('#fontButton').click();
 await expect(page.locator('#fontPanel')).toBeVisible();
}

for(const [w,h] of SIZES) for(const lang of ['en','es']){
 test(`font picker search and category chips are 44 px at ${w}x${h} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:w,height:h});
  await openFontPicker(page,lang);
  const where=`${w}x${h} ${lang} font picker`;
  await expectTouchTargets(page,'#fontSearch, #fontChips .chip',where);

  // The full bundled list is offered before any category narrows it.
  const chips=page.locator('#fontChips .chip');
  expect(await chips.count(),`${where}: category chips`).toBe(12);
  const all=await page.locator('.font-row').count();
  expect(all,`${where}: bundled fonts listed`).toBeGreaterThan(150);

  // Every chip is reachable in the scrolling row and picking it presses it.
  for(let i=0;i<12;i++){
   const chip=chips.nth(i);
   await chip.scrollIntoViewIfNeeded();
   await chip.tap();
   await expect(chip,`${where}: chip ${i} is pressed`).toHaveAttribute('aria-pressed','true');
  }

  // Picking a category still filters the list.
  const satin=page.locator('#fontChips [data-cat=satin]');
  await satin.scrollIntoViewIfNeeded();
  await satin.tap();
  const filtered=await page.locator('.font-row').count();
  expect(filtered,`${where}: Satin narrows the list`).toBeGreaterThan(0);
  expect(filtered,`${where}: Satin narrows the list`).toBeLessThan(all);
  expect(await page.locator('#fontChips [aria-pressed=true]').count(),`${where}: one category pressed`).toBe(1);
  expect(errors).toEqual([]);
 });
}

async function openSettings(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#phoneMenu').click();
 await page.locator('#menuSettings').click();
 await expect(page.locator('#settingsDialog')).toBeVisible();
}

for(const [w,h] of SIZES) for(const lang of ['en','es']){
 test(`Settings dialog buttons and sewing-tip rows are 44 px at ${w}x${h} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:w,height:h});
  const where=`${w}x${h} ${lang} Settings`;
  await openSettings(page,lang);
  await expect(page.locator('#tipsList label'),`${where}: sewing-tip rows`).toHaveCount(7);
  await expectTouchTargets(page,'#settingsDialog button, #settingsDialog .tips-list label',where);

  // Every row and its translation is still there.
  await expect(page.locator('#langEn')).toHaveText('English');
  await expect(page.locator('#langEs')).toHaveText('Español');
  const texts=await page.locator('#tipsList label').allTextContents();
  expect(texts.filter(t=>t.trim()).length,`${where}: sewing-tip labels carry text`).toBe(7);

  // The dialog fits the screen without scrolling, and Close is inside it and on screen.
  const fit=await page.evaluate(()=>{
   const d=document.querySelector('#settingsDialog'),r=d.getBoundingClientRect();
   const close=d.querySelector('form>button:last-of-type').getBoundingClientRect();
   return {scrolls:d.scrollHeight>d.clientHeight+1||d.scrollWidth>d.clientWidth+1,
    onScreen:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,
    closeInDialog:close.bottom<=r.bottom+1&&close.top>=r.top-1&&close.right<=r.right+1};
  });
  expect(fit.scrolls,`${where}: no scrolling inside the dialog`).toBe(false);
  expect(fit.onScreen,`${where}: the dialog fits the screen`).toBe(true);
  expect(fit.closeInDialog,`${where}: Close stays in the dialog`).toBe(true);
  expect(errors).toEqual([]);
 });
}

// The 3D view is a WebGL2 canvas; without it the overlay never draws, so the checks are skipped as the editor's own
// 3D tests do.
async function openPreview(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('.canvas')).toBeVisible();
 const switchView=page.locator('.canvas-views [data-view="preview"]');
 if(await switchView.isVisible())await switchView.click();
 // A phone hides the 2D / Stitches / 3D switch, so the view comes from Menu > View. A tap on the row can land while the
 // menu is still opening; the row is tapped again if the canvas has not taken over by then.
 else for(let attempt=0;attempt<2&&!(await page.locator('#preview3d').isVisible());attempt++){
  await page.locator('#phoneMenu').click();
  await page.locator('#menuView-preview').click();
 }
 await expect(page.locator('#preview3d')).toBeVisible();
 await expect(page.locator('#preview3d')).toHaveAttribute('data-instances',/^[1-9]\d+$/,{timeout:8000});
}

for(const [w,h] of SIZES) for(const lang of ['en','es']){
 test(`3D camera presets and Show pull are 44 px at ${w}x${h} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const webgl=await page.evaluate(()=>Boolean(document.createElement('canvas').getContext('webgl2')));test.skip(!webgl,'WebGL2 is not available in this browser');
  await page.setViewportSize({width:w,height:h});
  const where=`${w}x${h} ${lang} 3D overlay`;
  await openPreview(page,lang);
  const controls=await expectTouchTargets(page,'#previewView button, #previewPull label',where);
  expect(controls.length,`${where}: four presets and the pull row`).toBe(5);

  // The presets still change the camera.
  const canvas=page.locator('#preview3d'),presets=page.locator('#previewView button');
  await presets.nth(1).tap();
  await expect(canvas,`${where}: Close-up moves the camera`).toHaveAttribute('data-view','close');
  await presets.nth(2).tap();
  await expect(canvas,`${where}: Turntable moves the camera`).toHaveAttribute('data-view','turntable');
  await presets.nth(0).tap();
  await expect(canvas,`${where}: Front ¾ moves the camera`).toHaveAttribute('data-view','front');

  // The tick still turns the pull display on and off.
  const tick=page.locator('#previewPull label');
  await expect(canvas).toHaveAttribute('data-pull','off');
  await tick.tap();
  await expect(canvas,`${where}: the tick shows the pull`).toHaveAttribute('data-pull','on');
  await expect(page.locator('#pullNote')).toBeVisible();
  await tick.tap();
  await expect(canvas,`${where}: the tick hides the pull`).toHaveAttribute('data-pull','off');
  await expect(page.locator('#pullNote')).toBeHidden();
  expect(errors).toEqual([]);
 });
}
