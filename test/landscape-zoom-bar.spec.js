import {test,expect} from '@playwright/test';

// At 844x390 landscape the zoom bar sits in the canvas's right-hand column, clear of the hoop at its default fit, in both the
// design and Stitches views. The Stitches playback readouts are not cut off by it, in English and Spanish.
const LANDSCAPE=[844,390];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,lang){
 await page.setViewportSize({width:LANDSCAPE[0],height:LANDSCAPE[1]});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await expect(page.locator('.tool-rail')).toBeVisible();
}

const box=(page,selector)=>page.evaluate(s=>{
 const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();
 return {l:r.left,t:r.top,r:r.right,b:r.bottom};
},selector);

const overlaps=(a,b)=>a&&b&&Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.5;

// Readouts whose text is wider than the box it sits in.
const clipped=(page,selectors)=>page.evaluate(sels=>sels.flatMap(s=>{
 const e=document.querySelector(s);
 return e&&e.scrollWidth>e.clientWidth+1?[`${s} ${e.scrollWidth}>${e.clientWidth}`]:[];
}),selectors);

for(const lang of ['en','es']){
 test(`the zoom bar stays off the hoop at the default fit (${lang})`,async({page})=>{
  await openEditor(page,lang);
  expect(overlaps(await box(page,'.canvas .zoombar'),await box(page,'#hoopOuter'))).toBe(false);
 });

 test(`the zoom bar stays off the hoop in the Stitches view (${lang})`,async({page})=>{
  await openEditor(page,lang);
  await page.locator('#phoneMenu').click();
  await page.locator('#phoneMenuList button, #phoneMenuList [role=menuitem]').filter({hasText:lang==='en'?'Stitches':'Puntadas'}).first().click();
  await expect(page.locator('.layout main:not(.design-view)')).toHaveCount(1);
  expect(overlaps(await box(page,'.canvas .zoombar'),await box(page,'#hoopOuter'))).toBe(false);
 });

 test(`the Stitches playback text and status line are not truncated (${lang})`,async({page})=>{
  await openEditor(page,lang);
  await page.locator('#phoneMenu').click();
  await page.locator('#phoneMenuList button, #phoneMenuList [role=menuitem]').filter({hasText:lang==='en'?'Stitches':'Puntadas'}).first().click();
  await expect(page.locator('.layout main:not(.design-view)')).toHaveCount(1);
  expect(await clipped(page,['#playbackTime','#playbackStitches','#count','#playbackProgress'])).toEqual([]);
 });
}
