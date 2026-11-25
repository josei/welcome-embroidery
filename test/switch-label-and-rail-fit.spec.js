import {test,expect} from '@playwright/test';

// The Properties switch words keep their own width in English and Spanish, and a tall tool rail stops above the zoom bar.
const PANEL_SIZES=[[375,667],[390,844],[768,1024],[1024,768]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const lang of ['en','es']){
 for(const [width,height] of PANEL_SIZES){
  test(`switch words are not squeezed in the Properties panel at ${width}x${height} (${lang})`,async({page})=>{
   await page.setViewportSize({width,height});
   await page.goto(lang==='en'?'/':'/?lang=es');
   await page.locator('#rect').click();
   if(width<=600){
    await page.locator('#barProperties').click();
   }
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const words=page.locator('span.switch-state:visible');
   expect(await words.count(),'at least one switch word is shown').toBeGreaterThan(0);
   const sizes=await words.evaluateAll(els=>els.map(e=>[e.scrollWidth,e.clientWidth]));
   for(const [scroll,client] of sizes) expect(scroll,'switch word fits its box').toBeLessThanOrEqual(client);
  });
 }
}

test('a tall tool rail stops above the zoom bar at 1024x768',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/');
 await page.locator('#rect').click();
 await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='900px';document.querySelector('.canvas .tool-rail').appendChild(spacer);});
 const boxes=await page.evaluate(()=>{
  const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};};
  return {rail:box(document.querySelector('.canvas .tool-rail')),zoom:[...document.querySelectorAll('.canvas .zoombar button')].filter(e=>e.getClientRects().length).map(box)};
 });
 expect(boxes.zoom.length,'zoom controls are shown').toBeGreaterThan(0);
 for(const z of boxes.zoom){
  const overlaps=boxes.rail.x<z.right&&z.x<boxes.rail.right&&boxes.rail.y<z.bottom&&z.y<boxes.rail.bottom;
  expect(overlaps,'tool rail does not overlap a zoom control').toBe(false);
 }
});
