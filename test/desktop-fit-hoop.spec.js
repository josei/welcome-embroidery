import {test,expect} from '@playwright/test';

// A mouse window keeps its Fit margin: a short canvas (under 600 px on its smaller side) fills its height edge to edge.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('Fit hoop on a short mouse window still fills the canvas height', async({page})=>{
  await page.setViewportSize({width:1280,height:640});
  await page.goto('/');
  await expect(page.locator('.tool-rail')).toBeVisible();
  expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(false);
  await page.locator('#zoomFit').click();
  const {c,h}=await page.evaluate(()=>{
   const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {t:b.top,b:b.bottom,h:b.height};};
   return {c:r('.layout main>.canvas'),h:r('#hoopOuter')};
  });
  expect(h.h).toBeGreaterThanOrEqual(0.9*c.h);
  expect(h.t).toBeGreaterThanOrEqual(c.t);
  expect(h.b).toBeLessThanOrEqual(c.b);
});
