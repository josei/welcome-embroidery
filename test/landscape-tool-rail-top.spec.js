import {test,expect} from '@playwright/test';

// At 844x390 landscape the tool rail sits directly under the top bar, with no band between them. The rail and the selection
// bar were once pushed down 24 px to clear a status strip that no longer exists.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const lang of ['en','es']){
 test(`the tool rail top equals the top bar bottom at 844x390 (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width:844,height:390});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await expect(page.locator('.tool-rail')).toBeVisible();
  const box=s=>page.locator(s).boundingBox();
  const bar=await box('header.top'), rail=await box('.tool-rail');
  expect(bar).not.toBeNull();
  expect(rail.y,'tool rail top').toBeCloseTo(bar.y+bar.height,0);
  expect(errors).toEqual([]);
 });
}

test('the tool rail and selection bar take no extra offset at 844x390 (en)',async({page})=>{
 await page.setViewportSize({width:844,height:390});
 await page.goto('/');
 await expect(page.locator('.tool-rail')).toBeVisible();
 await page.screenshot({path:'test-results/landscape/landscape-844x390-en.png'});
 const top=await page.evaluate(()=>getComputedStyle(document.querySelector('.tool-rail')).top);
 expect(top).toBe(`${(await page.locator('header.top').boundingBox()).height}px`);
});
