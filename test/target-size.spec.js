import {test,expect} from '@playwright/test';

// WCAG 2.5.8 (issue #259, from audit #170): pointer targets are at least 24x24 CSS px. This file measures the row, header and
// checkbox controls that used to be smaller, so a regression fails here rather than in a manual audit.
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('row and header controls meet the 24px target minimum (WCAG 2.5.8)',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('/');await newDesign(page);await page.locator('#rect').click();
 const sized=async(locator,name)=>{const box=await locator.boundingBox();expect(box,name).not.toBeNull();expect(box.width,`${name} width`).toBeGreaterThanOrEqual(24);expect(box.height,`${name} height`).toBeGreaterThanOrEqual(24);};
 // Hide and Lock row buttons
 const row=page.locator('.object-line').first();
 await sized(row.locator('.row-eye'),'Hide row button');await sized(row.locator('.row-lock'),'Lock row button');
 // Rotate hoop and Messages
 await sized(page.locator('#hoopRotate'),'Rotate hoop');await sized(page.locator('#messagesBtn'),'Messages');
 // Every visible select (header and panel), sr-only selects excluded
 const selects=page.locator('select:visible:not(.sr-only)');const n=await selects.count();expect(n).toBeGreaterThan(0);
 for(let i=0;i<n;i++){const s=selects.nth(i);await sized(s,`${await s.evaluate(e=>e.id||e.getAttribute('aria-label')||e.className)} select`);}
 // Checkbox rows: the whole label is the target, so the label box must be at least 24px tall
 const checks=page.locator('label:has(input[type=checkbox]):visible');const c=await checks.count();expect(c).toBeGreaterThan(0);
 for(let i=0;i<c;i++){const box=await checks.nth(i).boundingBox();expect(box.height,`checkbox label ${i} height`).toBeGreaterThanOrEqual(24);}
 expect(errors).toEqual([]);
});

test('checkboxes draw a 24px box at 1280 and 1024 px wide',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');await newDesign(page);await page.locator('#rect').click();
 for(const width of [1280,1024]){
  await page.setViewportSize({width,height:800});
  const boxes=page.locator('input[type=checkbox]:not(.icon-check):visible');const n=await boxes.count();expect(n,`visible checkboxes at ${width}`).toBeGreaterThan(0);
  for(let i=0;i<n;i++){const b=await boxes.nth(i).boundingBox();const id=await boxes.nth(i).evaluate(e=>e.id||e.parentElement?.textContent?.trim().slice(0,40));expect(b.width,`${id} ${width} width`).toBeGreaterThanOrEqual(24);expect(b.height,`${id} ${width} height`).toBeGreaterThanOrEqual(24);}
 // The five named boxes: export dialog and Document stitch settings
  await page.locator('#export').click();
  for(const id of ['allFormats','withWorksheet']){const b=await page.locator(`#${id}`).boundingBox();expect(b.width,`#${id} ${width} width`).toBeGreaterThanOrEqual(24);expect(b.height,`#${id} ${width} height`).toBeGreaterThanOrEqual(24);}
  await page.keyboard.press('Escape');
  await page.locator('#secDoc summary').click();
  for(const id of ['ties','trims','underlay']){const b=await page.locator(`#${id}`).boundingBox();expect(b.width,`#${id} ${width} width`).toBeGreaterThanOrEqual(24);expect(b.height,`#${id} ${width} height`).toBeGreaterThanOrEqual(24);}
  await page.locator('#secDoc summary').click();
 }
 expect(errors).toEqual([]);
});
