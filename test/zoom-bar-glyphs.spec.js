import {test,expect} from '@playwright/test';

// On a phone or tablet the canvas zoom bar's fit buttons show the fit glyph only, with no word, in both languages and at
// every width up to the tablet breakpoint. Each keeps its full command name as its accessible name, and the Spanish bar
// stays inside the canvas.
const SIZES=[[390,844],[844,390],[768,1024]];

async function openEditor(page,lang,[w,h]){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept().catch(()=>{}));
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:w,height:h});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('header.top #name')).toBeVisible();
 return errors;
}

for(const lang of ['en','es'])for(const size of SIZES){
 test(`the zoom bar shows no words at ${size.join('x')} (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang,size);
  const fit=page.locator('#zoomFit'), all=page.locator('#zoomAll');
  await expect(fit).toBeVisible();
  await expect(all).toBeVisible();
  expect((await fit.textContent()).trim(),'Fit hoop text').toBe('');
  expect((await all.textContent()).trim(),'Fit everything text').toBe('');
  expect(await fit.locator('use').getAttribute('href')).toBe('#i-fit');
  expect(await all.locator('use').getAttribute('href')).toBe('#i-fit');
  expect(errors).toEqual([]);
 });

 test(`the zoom bar fits inside the canvas at ${size.join('x')} (${lang})`,async({page})=>{
  const errors=await openEditor(page,lang,size);
  const bar=await page.locator('.canvas .zoombar').boundingBox();
  const canvas=await page.locator('.canvas').boundingBox();
  expect(bar.x).toBeGreaterThanOrEqual(canvas.x);
  expect(bar.x+bar.width).toBeLessThanOrEqual(canvas.x+canvas.width);
  const overflow=await page.locator('.canvas .zoombar').evaluate(el=>el.scrollWidth-el.clientWidth);
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
