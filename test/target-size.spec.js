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
