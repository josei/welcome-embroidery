import {test,expect} from '@playwright/test';

// On a portrait tablet the top bar reads status, then Save, then Export at the right edge, so the main action sits at the
// edge. Phones and desktop keep their own orders.
test('the tablet bar reads status, Save, Export at 768x1024 (en)',async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/');
 await expect(page.locator('#export')).toBeVisible();
 const status=page.locator('.top .save-status:visible').first();
 await expect(status).toBeVisible();
 const s=await status.boundingBox(), sv=await page.locator('#save').boundingBox(), ex=await page.locator('#export').boundingBox();
 expect(s.x+s.width).toBeLessThanOrEqual(sv.x);
 expect(sv.x+sv.width).toBeLessThanOrEqual(ex.x);
 const bar=await page.locator('header.top').boundingBox();
 expect(ex.x+ex.width,'Export sits at the right edge of the bar').toBeGreaterThanOrEqual(bar.x+bar.width-12);
 await page.screenshot({path:'test-results/tablet/tablet-768x1024-en.png'});
});
