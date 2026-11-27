import {test,expect} from '@playwright/test';

// The phone header reads the same left to right in portrait and landscape: the Menu, Undo, Redo, the design name, then Export.
// The Stitches view keeps the tool dock in portrait. On a landscape phone the dock is hidden there, so the playback buttons stay clear.
const SIZES=[[390,844],[844,390]];

for(const [width,height] of SIZES) for(const lang of ['en','es']) {
 test(`phone header order is Menu, Undo, Redo, name, Export at ${width}x${height} (${lang})`,async({page})=>{
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':'/?lang=es');
  await expect(page.locator('.tool-rail').first()).toBeVisible();
  const order=await page.evaluate(()=>[...document.querySelectorAll('header.top button, header.top input, header.top .export-split')]
   .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';})
   .sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)
   .map(e=>e.id||e.className));
  expect(order.filter(id=>['phoneMenu','undo','redo','name','export-split'].includes(id))).toEqual(['phoneMenu','undo','redo','name','export-split']);
 });

 test(`Stitches shows the tool dock in portrait, and hides it on a landscape phone (${width}x${height}, ${lang})`,async({page})=>{
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':'/?lang=es');
  await expect(page.locator('.tool-rail').first()).toBeVisible();
  await page.evaluate(()=>document.querySelector('[data-view=stitches]').click());
  if(width<height){
   await expect(page.locator('.tool-rail').first()).toBeVisible();
   const buttons=await page.locator('.tool-rail').first().locator('button').count();
   // The dock holds the five drawing tools; Measure moved to the Menu's Tools group.
   expect(buttons).toBe(5);
  } else {
   await expect(page.locator('#play')).toBeVisible();
   await expect(page.locator('.tool-rail').first()).toBeHidden();
  }
 });
}
