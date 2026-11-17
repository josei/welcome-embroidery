import {test,expect} from '@playwright/test';

// On a tablet, Properties scrolled down for one object opens at the top when another object is selected, so the new object's
// name and size are in view. Selecting by tap still shows its Properties.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

async function drawRect(page,from,to){
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*from,c.y+c.height*from);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*to,c.y+c.height*to,{steps:5});
 await page.mouse.up();
}

for(const [w,h] of [[768,1024],[1024,768]]){
 test(`a newly selected object opens Properties at the top at ${w}x${h}`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto('/');
  await expect(page.locator('header.top')).toBeVisible();
  if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
  if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
  await drawRect(page,0.2,0.4);
  await drawRect(page,0.5,0.7);
  await page.waitForTimeout(300);
  await page.locator('.object-row').nth(0).click();
  await expect(page.locator('#inspector')).toBeVisible();
  // Scroll the panel down, then select the other object by tapping its row.
  await page.evaluate(()=>{document.getElementById('inspector').scrollTop=300;});
  await page.locator('.object-row').nth(1).click();
  const top=await page.evaluate(()=>document.getElementById('inspector').scrollTop);
  expect(top).toBe(0);
 });
}
