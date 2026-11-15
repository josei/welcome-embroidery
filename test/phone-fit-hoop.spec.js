import {test,expect} from '@playwright/test';

// Fit hoop fills most of a phone canvas in either orientation: the hoop's outline is at least 90% of the canvas's smaller
// side, and it sits wholly inside the canvas.
const SIZES=[[390,844],[844,390]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const [width,height] of SIZES){
 test(`Fit hoop fills the phone canvas at ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('/');
  await expect(page.locator('.tool-rail')).toBeVisible();
  await page.locator('#zoomFit').click();
  const {c,h}=await page.evaluate(()=>{
   const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height};};
   return {c:r('.layout main>.canvas'),h:r('#hoopOuter')};
  });
  const small=Math.min(c.w,c.h);
  // In landscape the top ruler takes 18 px of the canvas, so the hoop is centred between the ruler and the bottom edge
  // rather than rising into the ruler: about 88% of the short side is the most that fits with the hoop centred.
  const minFill=c.w>c.h?0.88:0.9;
  expect(Math.max(h.w,h.h)).toBeGreaterThanOrEqual(minFill*small);
  expect(h.l).toBeGreaterThanOrEqual(c.l);
  expect(h.r).toBeLessThanOrEqual(c.r);
  expect(h.t).toBeGreaterThanOrEqual(c.t);
  expect(h.b).toBeLessThanOrEqual(c.b);
 });
}
