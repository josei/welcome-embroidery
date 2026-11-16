import {test,expect} from '@playwright/test';

// A newly drawn shape becomes the selected layer row. On a portrait tablet the Layers list scrolls inside its own panel,
// so the selected row must be scrolled into that panel's visible box, in English and Spanish, without moving the page.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

// Adds one rectangle with the Rectangle tool; the tool places it at the hoop's centre and selects it.
async function addRect(page){
 await page.locator('#rect').click();
}

// The selected row's box and the Layers panel's visible box.
function measure(){
 const row=document.querySelector('#objects .object-row.selected');
 const panel=document.getElementById('layersSheet');
 const r=row.getBoundingClientRect(),p=panel.getBoundingClientRect();
 const list=document.getElementById('objects');
 let scroller=row.parentElement;
 while(scroller&&!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY))scroller=scroller.parentElement;
 return {
  rowTop:r.top,rowBottom:r.bottom,panelTop:p.top,panelBottom:p.bottom,
  panelScrollTop:panel.scrollTop,
  listScrollTop:list.scrollTop,
  pageY:window.scrollY,
  scrollerIsPanel:scroller===panel||panel.contains(scroller),
 };
}

for(const lang of ['en','es']){
 test(`newly drawn shape's row is fully visible in Layers at 768x1024 (${lang})`,async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('header.top')).toBeVisible();
  if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
  if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
  for(let i=0;i<8;i++)await addRect(page);
  await expect(page.locator('#objects .object-row.selected')).toHaveCount(1);
  await expect.poll(async()=>{
   const m=await page.evaluate(measure);
   return m.rowTop>=m.panelTop&&m.rowBottom<=m.panelBottom;
  }).toBe(true);
  const m=await page.evaluate(measure);
  expect(m.rowTop,'row top inside Layers box').toBeGreaterThanOrEqual(m.panelTop);
  expect(m.rowBottom,'row bottom inside Layers box').toBeLessThanOrEqual(m.panelBottom);
  expect(m.pageY,'page does not scroll').toBe(0);
 });
}

test('selecting a row that is already visible does not move the list',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=en');
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 for(let i=0;i<8;i++){
  await addRect(page);
  await expect(page.locator('#objects .object-row.selected')).toHaveCount(1);
 }
 // Scroll to the top so the first row is in view, then select it by clicking it.
 await page.evaluate(()=>{document.getElementById('layersSheet').scrollTop=0;});
 const first=page.locator('#objects .object-row').first();
 const before=await page.evaluate(()=>document.getElementById('layersSheet').scrollTop);
 await first.locator('.row-kind').click().catch(()=>first.click());
 await expect(page.locator('#objects .object-row').first()).toHaveClass(/selected/);
 const after=await page.evaluate(()=>document.getElementById('layersSheet').scrollTop);
 expect(after).toBe(before);
});
