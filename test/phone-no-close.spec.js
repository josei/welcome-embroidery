import {test,expect} from '@playwright/test';

// The phone Menu has no Close or × control. Layers and Properties close with the shared × in their heading row, never a text Close. Menu > View
// holds the 2D / Stitches / 3D switch on a landscape phone, and the canvas has none. On a landscape phone, choosing Menu > Layers or
// Menu > Properties closes the Menu and opens the sheet. A tap outside each closes it.
const SIZES=[[390,844],[844,390]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const closeLike=/^(close|cerrar|×|✕|x)$/i;

for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test.describe(()=>{
 test.use({hasTouch:width>height});
 test(`the Menu has no Close control, and Layers and Properties have no text Close at ${width}x${height} (${lang})`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.setViewportSize({width,height});
  await page.goto(lang==='en'?'/':`/?lang=${lang}`);
  await page.locator('#phoneMenu').click();
  const labels=await page.locator('#phoneMenuList button:visible').evaluateAll(bs=>bs.map(b=>(b.getAttribute('aria-label')||b.textContent||'').trim()));
  expect(labels.filter(l=>closeLike.test(l)||/close|cerrar/i.test(l))).toEqual([]);
  await expect(page.locator('#phoneMenuList use[href="#i-cross"]')).toHaveCount(0);
  await page.locator('#menuLayers').click();
  await expect(page.locator('#phoneMenuList')).toHaveCount(0);
  await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
  // The panels close with the × control in their heading row (see close-control.spec.js); the Menu has none. Neither header has a
  // word button that closes it.
  const layerWords=await page.locator('#layersSheet button:visible').evaluateAll(bs=>bs.map(b=>(b.textContent||'').trim()));
  expect(layerWords.filter(l=>closeLike.test(l))).toEqual([]);
  await page.waitForTimeout(300);
  await page.locator('#layersSheet').getByRole('button',{name:/^(Close|Cerrar)$/}).click();
  await expect(page.locator('#layersSheet')).not.toHaveClass(/sheet-open/);
  await page.locator('#phoneMenu').click();
  await page.locator('#menuProperties').click();
  await expect(page.locator('#phoneMenuList')).toHaveCount(0);
  await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
  const propWords=await page.locator('#inspector button:visible').evaluateAll(bs=>bs.map(b=>(b.textContent||'').trim()));
  expect(propWords.filter(l=>closeLike.test(l))).toEqual([]);
  await page.waitForTimeout(300);
  await page.locator('#inspector').getByRole('button',{name:/^(Close|Cerrar)$/}).click();
  await expect(page.locator('#inspector')).not.toHaveClass(/sheet-open/);
  expect(errors).toEqual([]);
 });
});
}

test('the 2D / Stitches / 3D switch is in Menu > View on a landscape phone, not on the canvas',async({page})=>{
 await page.setViewportSize({width:844,height:390});
 await page.goto('/');
 await expect(page.locator('.canvas .canvas-views')).toBeHidden();
 await page.locator('#phoneMenu').click();
 for(const [id,mode] of [['menuView-stitches','stitches'],['menuView-preview','preview'],['menuView-design','design']]){
  await page.locator(`#${id}`).click();
  if(mode==='design') await expect(page.locator('.layout main')).toHaveClass(/design-view/);
  else await expect(page.locator('.layout main')).not.toHaveClass(/design-view/);
  if(mode!=='design') await page.locator('#phoneMenu').click();
 }
});
