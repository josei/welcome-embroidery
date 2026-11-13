import {test,expect} from '@playwright/test';

// On a 768x1024 tablet, folding the Layers panel with a tap on the canvas must not leave the page
// wider or taller than the viewport, and the drawing area must stay inside the viewport width.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const lang of ['en','es']){
 test(`768x1024 ${lang}: no page scroll after a canvas tap dismisses Layers`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:768,height:1024});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  const initial=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight}));
  expect(initial.sw,'initial scrollWidth').toBeLessThanOrEqual(initial.cw);
  expect(initial.sh,'initial scrollHeight').toBeLessThanOrEqual(initial.ch);
  const art=await page.locator('.canvas').boundingBox();
  await page.mouse.click(art.x+art.width*0.6,art.y+art.height*0.85);
  await expect(page.locator('#layersSheet')).toBeHidden();
  const after=await page.evaluate(()=>{const a=document.querySelector('#art').getBoundingClientRect();
    return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight,artRight:a.right,vw:innerWidth};});
  expect(after.sw,'scrollWidth after canvas tap').toBeLessThanOrEqual(after.cw);
  expect(after.sh,'scrollHeight after canvas tap').toBeLessThanOrEqual(after.ch);
  expect(after.artRight,'drawing area right edge').toBeLessThanOrEqual(after.vw);
  expect(errors).toEqual([]);
 });
}
