import {revealMenuRow} from './menu-reveal.js';
import {test,expect} from '@playwright/test';

// Two phone edges. In landscape (844x390) the phone has no status row: Messages is a Menu row. In portrait (390x844) the unsaved
// mark sits in the design name's field, and the name keeps its edges when the mark appears.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const rect=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};});

// Draws one rectangle on the canvas, so the design has unsaved changes.
async function makeDirty(page){
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*0.4,c.y+c.height*0.4);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*0.6,c.y+c.height*0.6,{steps:5});
 await page.mouse.up();
}

for(const lang of ['en','es']){
 test(`landscape 844x390 ${lang}: Messages is a Menu row, not a pill on the status line`,async({page})=>{
  await page.setViewportSize({width:844,height:390});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  // A landscape phone has no status row: the design's count is under its name and Messages is in the Menu.
  await expect(page.locator('#messagesBtn')).toHaveCount(0);
  await page.locator('#phoneMenu').click();
  await expect(await revealMenuRow(page.locator('#phoneMenuList'),'menuMessages')).toHaveCount(1);
 });

 test(`portrait 390x844 ${lang}: the unsaved status shows as a caption and the name does not move`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const before=await rect(page,'#name');
  await makeDirty(page);
  await expect(page.locator('#unsavedMark'),'the unsaved status is shown').toBeVisible();
  const after=await rect(page,'#name');
  expect(after.l,'the name keeps its left edge').toBeCloseTo(before.l,0);
  expect(after.t,'the name keeps its top edge').toBeCloseTo(before.t,0);
  expect(after.r,'the name keeps its right edge').toBeCloseTo(before.r,0);
 });
}
