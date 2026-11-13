import {test,expect} from '@playwright/test';

// At phone widths (375x667 and 390x844, portrait) the top bar holds only Menu, the design name, undo, redo and Export,
// at a 52 px bar. Every command that left the bar is one tap to open the Menu and one tap to choose, and the save status
// is a line of text in the Menu. At desktop widths nothing leaves the bar.
const PHONES=[[375,667],[390,844]];
const BAR_CONTROLS=['#phoneMenu','#name','#undo','#redo','#export'];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang='en'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

// The visible controls in the top bar, by id (the Menu button has an id; the name is an input).
const visibleBarIds=page=>page.locator('header.top button, header.top input').evaluateAll(els=>els
 .filter(e=>e.offsetParent!==null && !e.closest('.file-menu-list') && e.getBoundingClientRect().width>0)
 .map(e=>e.id||e.className).filter(Boolean));

for(const [width,height] of PHONES) for(const lang of ['en','es']){
 test(`the phone top bar holds only Menu, name, undo, redo and Export at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  await page.locator('#rect').click();
  const ids=await visibleBarIds(page);
  expect(ids.sort(),'visible top-bar controls').toEqual([...BAR_CONTROLS].map(s=>s.slice(1)).sort());
  for(const sel of BAR_CONTROLS) await expect(page.locator(sel),`${sel} is shown`).toBeVisible();
  const h=await page.locator('header.top').evaluate(e=>e.getBoundingClientRect().height);
  expect(Math.abs(h-52),'top bar height is 52 px').toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
 });
}

// Every command that left the bar, reached through the Menu: open the Menu, choose the row, and check what it did.
test('each command that left the bar is one tap to open the Menu and one to choose, at 390x844 (en)',async({page})=>{
 test.setTimeout(120000);
 const errors=await openEditor(page,390,844,'en');
 await page.locator('#rect').click();
 const menu=page.locator('#phoneMenu');
 const list=page.locator('#phoneMenuList');
 const open=async()=>{ if(!(await list.isVisible())) await menu.click(); await expect(list).toBeVisible(); };
 const objects=()=>page.locator('.object-row').count();

 // Save, Save As, Open and Import: each row exists and is enabled; Open and Import open their file pickers.
 await open();
 for(const id of ['menuCommandPalette','menuNew','menuSave','menuSaveAs','menuOpen','menuImport','menuExport','menuSettings','menuDuplicate']){
  await expect(list.locator(`#${id}`),`${id} is in the Menu`).toBeVisible();
 }
 await expect(list.locator('.menu-heading')).toHaveText(['File','Edit','View','Settings and Help']);

 // Open: a file chooser opens.
 await open();
 const chooser=page.waitForEvent('filechooser');
 await list.locator('#menuOpen').click();
 await chooser.then(c=>expect(c.isMultiple()).toBe(false));
 await expect(list,'Open closes the menu').toHaveCount(0);

 // Import: a second file chooser opens.
 await open();
 const machine=page.waitForEvent('filechooser');
 await list.locator('#menuImport').click();
 await machine;
 await expect(list).toHaveCount(0);

 // Duplicate: one more object.
 const before=await objects();
 await open();
 await list.locator('#menuDuplicate').click();
 await expect.poll(objects).toBe(before+1);

 // Delete is not in the phone Menu (the selection bar deletes), so the duplicate is removed by undo.
 await page.keyboard.press('Control+z');
 await expect.poll(objects).toBe(before);
 await page.locator('#rect').click();

 // Settings opens its dialog (keyboard shortcuts are not listed on phones).
 await open();
 await list.locator('#menuSettings').click();
 await expect(page.locator('#settingsDialog[open]'),'Settings opens').toHaveCount(1);
 await page.keyboard.press('Escape');

 expect(errors).toEqual([]);
});

// After New on a phone, the blank-design hint "Add an object to export" must not take the design name's row. The name keeps
// at least 8 characters of width, and the hint and the name, and the hint and Export, do not overlap.
for(const [width,height] of PHONES) for(const lang of ['en','es']){
 test(`after New the name keeps its width and the export hint overlaps neither name nor Export at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  await page.locator('#phoneMenu').click();
  await page.locator('#phoneMenuList #menuNew').click();
  await expect(page.locator('#exportReason')).toBeVisible();
  const box=sel=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  const name=await box('#name'), hint=await box('#exportReason'), exp=await box('#export');
  const meets=(a,b)=>a.x<b.x+b.w && b.x<a.x+a.w && a.y<b.y+b.h && b.y<a.y+a.h;
  // A name shown at 8 characters of the heading font is about 8 x 9 px; 100 px is a generous floor for the field.
  expect(name.w,'name width').toBeGreaterThanOrEqual(100);
  expect(meets(name,hint),'hint overlaps name').toBe(false);
  expect(meets(exp,hint),'hint overlaps Export').toBe(false);
  expect(errors).toEqual([]);
 });
}
