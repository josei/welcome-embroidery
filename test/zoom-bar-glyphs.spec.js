import {test,expect} from '@playwright/test';

// On a phone the context bar under the canvas holds the view tiles (Hand, Hoop, All) beside the zoom stepper. Each tile has its
// glyph and its word, and keeps its full command name as its accessible name. The Spanish bar stays inside the window.
const SIZES=[[390,844],[844,390],[768,1024]];
// The context bar is the phone's; the tablet keeps the zoom bar on its canvas.
const PHONE_SIZES=[[390,844],[844,390]];

async function openEditor(page,lang,[w,h]){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:w,height:h});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('header.top #name')).toBeVisible();
 return errors;
}

for(const lang of ['en','es'])for(const size of PHONE_SIZES){
 test(`the phone context bar shows each view tile's glyph and word at ${size.join('x')} (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang,size);
  const fit=page.locator('#zoomFit'), all=page.locator('#zoomAll');
  await expect(fit).toBeVisible();
  await expect(all).toBeVisible();
  // The words come from the same tile component as the dock; each tile's own word is its visible text.
  expect((await fit.locator('.tile-word').textContent()).trim(),'Hoop word').toBe(lang==='en'?'Hoop':'Bastidor');
  expect((await all.locator('.tile-word').textContent()).trim(),'All word').toBe(lang==='en'?'All':'Todo');
  expect(await fit.locator('use').getAttribute('href')).toBe('#i-fit');
  expect(await all.locator('use').getAttribute('href')).toBe('#i-fit-all');
  expect(await fit.locator('use').getAttribute('href')).not.toBe(await all.locator('use').getAttribute('href'));
  expect(errors).toEqual([]);
 });

 test(`the phone context bar fits inside the window at ${size.join('x')} (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang,size);
  const bar=await page.locator('.context-bar').boundingBox();
  expect(bar.x).toBeGreaterThanOrEqual(0);
  expect(bar.x+bar.width).toBeLessThanOrEqual(size[0]);
  const overflow=await page.locator('.context-bar').evaluate(el=>el.scrollWidth-el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
 });
}

test('the fit buttons keep their command names as accessible names (en)',async({page})=>{
 await openEditor(page,'en',[390,844]);
 await expect(page.locator('#zoomFit')).toHaveAttribute('aria-label','Fit hoop');
 await expect(page.locator('#zoomAll')).toHaveAttribute('aria-label','Fit everything (⇧1)');
});

test('the fit buttons keep their command names as accessible names (es)',async({page})=>{
 await openEditor(page,'es',[390,844]);
 await expect(page.locator('#zoomFit')).toHaveAttribute('aria-label','Ajustar bastidor');
 await expect(page.locator('#zoomAll')).toHaveAttribute('aria-label','Ajustar todo (⇧1)');
});

test('the desktop zoom bar keeps its words',async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/');
 await expect(page.locator('header.top #name')).toBeVisible();
 await expect(page.locator('#zoomFit')).toHaveText('Fit hoop');
 await expect(page.locator('#zoomAll')).toHaveText('All');
});

// The hoop glyph is a rounded square frame whose corner radius and frame band follow the hoop drawn on the canvas
// (#hoopOuter and #hoopRing in the layout), scaled to the 24-unit icon grid.
const HOOP_GLYPH_PATH='M3.2 2H20.8A1.2 1.2 0 0 1 22 3.2V20.8A1.2 1.2 0 0 1 20.8 22H3.2A1.2 1.2 0 0 1 2 20.8V3.2A1.2 1.2 0 0 1 3.2 2ZM5.5 5H18.5A0.5 0.5 0 0 1 19 5.5V18.5A0.5 0.5 0 0 1 18.5 19H5.5A0.5 0.5 0 0 1 5 18.5V5.5A0.5 0.5 0 0 1 5.5 5Z';

test('the fit glyphs are distinct symbols, and the hoop glyph matches the canvas hoop',async({page})=>{
 await openEditor(page,'en',[1280,800]);
 const paths=await page.evaluate(()=>{
  const d=id=>document.querySelector(`symbol#${id} path`)?.getAttribute('d')??null;
  return {hoop:d('i-fit'),all:d('i-fit-all')};
 });
 expect(paths.hoop,'Fit hoop glyph path').toBeTruthy();
 expect(paths.all,'Fit everything glyph path').toBeTruthy();
 expect(paths.hoop).not.toBe(paths.all);
 expect(paths.hoop).toBe(HOOP_GLYPH_PATH);

 const canvasHoop=await page.evaluate(()=>{
  const r=id=>{const el=document.getElementById(id);return {w:+el.getAttribute('width'),rx:+el.getAttribute('rx')};};
  return {outer:r('hoopOuter'),ring:r('hoopRing')};
 });
 // Corner radius as a share of the side, glyph against canvas, within rounding.
 expect(1.2/20).toBeCloseTo(canvasHoop.outer.rx/canvasHoop.outer.w,2);
 expect(0.5/14).toBeCloseTo(canvasHoop.ring.rx/canvasHoop.ring.w,2);
});
