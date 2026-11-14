import {test,expect} from '@playwright/test';

// Fit hoop on a portrait tablet keeps the whole hoop in view with a margin on each side. The phone layout is the only touch
// layout that fits edge to edge.
test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test('Fit hoop leaves the whole hoop visible with a margin on each side on a touch portrait tablet', async({page})=>{
  await page.setViewportSize({width:768,height:1024});
  await page.goto('/');
  await expect(page.locator('.tool-rail')).toBeVisible();
  expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
  await page.locator('#zoomFit').click();
  const {c,h}=await page.evaluate(()=>{
   const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {l:b.left,t:b.top,r:b.right,b:b.bottom};};
   return {c:r('.layout main>.canvas'),h:r('#hoopOuter')};
  });
  expect(h.l).toBeGreaterThan(c.l);
  expect(h.r).toBeLessThan(c.r);
  expect(h.t).toBeGreaterThan(c.t);
  expect(h.b).toBeLessThan(c.b);
});
