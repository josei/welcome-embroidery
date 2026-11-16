import {test,expect} from '@playwright/test';

// On tablets and a landscape phone the save status is the same text line as on desktop, set under the top bar. It is an overlay,
// so the design name keeps its box whether the design is clean or has unsaved changes.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const box=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});

for(const [w,h] of [[768,1024],[1024,768],[667,375]])for(const lang of ['en','es']){
 test(`${w} x ${h} ${lang}: the save status is a caption under the bar and the name does not move`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const before=await box(page,'.top #name');
  await page.locator('#rect').click();
  await expect(page.locator('#unsavedMark')).toBeVisible();
  const status=await box(page,'#unsavedMark');
  const name=await box(page,'.top #name');
  expect(status.top,'the caption sits below the bar').toBeGreaterThanOrEqual(name.bottom-1);
  expect(Math.abs(name.left-before.left),'the name keeps its left edge').toBeLessThanOrEqual(0.5);
  expect(Math.abs(name.top-before.top),'the name keeps its top edge').toBeLessThanOrEqual(0.5);
  expect(Math.abs(name.right-before.right),'the name keeps its right edge').toBeLessThanOrEqual(0.5);
 });
}
