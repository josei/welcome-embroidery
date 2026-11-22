import {test,expect} from '@playwright/test';

// The Export split is the desktop's pill at every size, inset from the right edge by the top bar's own padding,
// and the bar never scrolls sideways.
for(const [w,h] of [[320,568],[360,640],[390,844],[844,390]]) test(`the Export split is inset and rounded at ${w}x${h}`,async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 await page.setViewportSize({width:w,height:h});
 await page.goto('/');
 await expect(page.locator('#export')).toBeVisible();
 const bar=await page.locator('header.top').boundingBox();
 const split=await page.locator('.top .export-split').boundingBox();
 const barPadRight=await page.locator('header.top').evaluate(e=>parseFloat(getComputedStyle(e).paddingRight));
 expect(split.x+split.width,'right edge sits inside the bar padding').toBeCloseTo(bar.x+bar.width-barPadRight,0);
 expect(split.x+split.width,'Export fully inside the viewport').toBeLessThanOrEqual(w);
 const radius=await page.locator('.top .export-split').evaluate(e=>getComputedStyle(e).borderTopRightRadius);
 expect(radius).not.toBe('0px');
 const overflow=await page.locator('header.top').evaluate(e=>e.scrollWidth-e.clientWidth);
 expect(overflow,'no horizontal overflow in the top bar').toBeLessThanOrEqual(0);
});
