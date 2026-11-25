import {test,expect} from '@playwright/test';

// In portrait the zoom bar and the selection bar share the canvas's centre line, so the two bars stacked over the dock line up.
// At 360 px in Spanish the longest dock label, "Seleccionar", keeps at least 4 px clear of each side of its tile.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const [width,height] of [[360,640],[390,844]]){
 for(const lang of ['en','es']){
  test(`the zoom bar and selection bar share a centre line at ${width}x${height} (${lang})`,async({page})=>{
   await page.setViewportSize({width,height});
   await page.goto(lang==='en'?'/':'/?lang=es');
   await page.locator('#rect').tap();
   const bar=await page.locator('.phone-selection').boundingBox();
   const zoom=await page.locator('.canvas .zoombar').boundingBox();
   expect(zoom.x+zoom.width/2,'zoom bar centre matches the selection bar centre').toBeCloseTo(bar.x+bar.width/2,0);
  });
 }
}

test('the Seleccionar dock label keeps 4 px clear of its tile at 360x640 (es)',async({page})=>{
 await page.setViewportSize({width:360,height:640});
 await page.goto('/?lang=es');
 const gap=await page.evaluate(()=>{
  const tile=[...document.querySelectorAll('.layout main>.tool-rail .icon-button')].find(b=>b.getAttribute('aria-label')?.startsWith('Seleccionar')) ?? document.querySelector('.layout main>.tool-rail .icon-button');
  const label=tile.querySelector('.rail-label');
  const range=document.createRange();range.selectNodeContents(label);
  const text=range.getBoundingClientRect(),box=tile.getBoundingClientRect();
  return {left:text.left-box.left,right:box.right-text.right,label:label.textContent.trim()};
 });
 expect(gap.label).toBe('Seleccionar');
 expect(gap.left,'space left of the word').toBeGreaterThanOrEqual(4);
 expect(gap.right,'space right of the word').toBeGreaterThanOrEqual(4);
});
