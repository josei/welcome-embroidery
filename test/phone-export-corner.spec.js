import {test,expect} from '@playwright/test';

// The Export button sits flush with the top-right corner of the screen on a landscape and a portrait phone, not inset
// from it by the bar's padding.
for(const [w,h] of [[844,390],[390,844]]) test(`the Export button is flush with the top-right corner at ${w}x${h}`,async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:w,height:h});
 await page.goto('/');
 await expect(page.locator('#export')).toBeVisible();
 const bar=await page.locator('header.top').boundingBox();
 const split=await page.locator('.top .export-split').boundingBox();
 expect(split.x+split.width,'right edge').toBeCloseTo(bar.x+bar.width,0);
 expect(split.y,'top edge').toBeCloseTo(bar.y,0);
 const radius=await page.locator('.top .export-split').evaluate(e=>getComputedStyle(e).borderTopRightRadius);
 expect(radius).toBe('0px');
});
