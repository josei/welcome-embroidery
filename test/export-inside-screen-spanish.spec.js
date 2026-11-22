import {test,expect} from '@playwright/test';

// In Spanish the phone top bar keeps every control inside the screen: the Export button's right edge is at or inside the
// viewport, the page does not scroll sideways, and each control in the bar is fully visible. Checked at the four phone and
// tablet sizes the top bar is designed for, with a design selected.
const SIZES=[[360,640],[390,844],[768,1024],[844,390]];

for(const [width,height] of SIZES){
 test(`the Export button is fully inside the ${width}x${height} screen in es-ES`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{delete window.showSaveFilePicker;});
  await page.setViewportSize({width,height});
  await page.goto('/?lang=es');
  await page.locator('#rect').click();
  await expect(page.locator('#export')).toBeVisible();

  const m=await page.evaluate(()=>{
   const bar=document.querySelector('header.top');
   const exp=document.querySelector('#export').getBoundingClientRect();
   const controls=[...bar.querySelectorAll('button, input#name')].filter(e=>e.offsetParent!==null&&!e.closest('.file-menu-list'))
    .map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.className,left:r.left,right:r.right,width:r.width};});
   return {
    exportLeft:exp.left,exportRight:exp.right,exportWidth:exp.width,
    viewport:window.innerWidth,
    docScrollWidth:document.documentElement.scrollWidth,
    controls,
   };
  });

  expect(m.exportRight,'Export right edge is inside the viewport').toBeLessThanOrEqual(m.viewport);
  expect(m.exportLeft,'Export left edge is on the screen').toBeGreaterThanOrEqual(0);
  expect(m.docScrollWidth,'no horizontal page overflow').toBeLessThanOrEqual(m.viewport);
  for(const c of m.controls){
   expect(c.left,`${c.id} starts on the screen`).toBeGreaterThanOrEqual(0);
   expect(c.right,`${c.id} ends on the screen`).toBeLessThanOrEqual(m.viewport);
   expect(c.width,`${c.id} has width`).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
 });
}
