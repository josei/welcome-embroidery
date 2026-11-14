import {test,expect} from '@playwright/test';

// After drawing a shape the confirmation stays on screen for a few seconds. It must not sit over the zoom bar, which
// hangs over the canvas bottom, at phone and desktop sizes: the two would otherwise hide each other's controls.
const newDesign=async page=>{
 const menu=page.locator('#phoneMenu');
 if(await menu.count()&&await menu.isVisible()){await menu.click();await page.locator('#menuNew').click();}
 else await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
};
const openStitches=async page=>{
 const menu=page.locator('#phoneMenu');
 if(await menu.count()&&await menu.isVisible()){await menu.click();await page.locator('#menuView-stitches').click();}
 else await page.locator('button[data-view="stitches"]').click();
};
// The visible zoom bar buttons' boxes.
const zoomButtons=page=>page.locator('.zoombar button').filter({visible:true});

test('one confirmation stays clear of the zoom bar on a 390×844 phone in Spanish',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await newDesign(page);
 await page.locator('#rect').click();
 await page.keyboard.press('Escape');
 await page.locator('#toolMore').click();
 await page.locator('#ellipse').click();
 await page.keyboard.press('Escape');
 await openStitches(page);
 await expect(page.locator('button[data-view="stitches"]').first()).toHaveAttribute('aria-pressed','true');
 // The second add replaces the first, so exactly one confirmation is on screen.
 await expect(page.locator('#toast .toast-item')).toHaveCount(1);
 await expect(page.locator('#toast')).toContainText('Elipse añadida junto a las demás');
 const toast=page.locator('#toast .toast-item').first(),tb=await toast.boundingBox();
 expect(tb,'toast box').not.toBeNull();
 const buttons=zoomButtons(page);
 expect(await buttons.count()).toBeGreaterThan(0);
 for(let i=0;i<await buttons.count();i++){
  const b=await buttons.nth(i).boundingBox();
  const ox=Math.min(tb.x+tb.width,b.x+b.width)-Math.max(tb.x,b.x);
  const oy=Math.min(tb.y+tb.height,b.y+b.height)-Math.max(tb.y,b.y);
  expect(ox>0&&oy>0,`zoom button ${i} clear of the toast`).toBe(false);
 }
 expect(errors).toEqual([]);
});

test('one confirmation stays clear of the zoom bar at 1440 px',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?lang=es');
 await newDesign(page);
 await page.locator('#rect').click();
 await page.keyboard.press('Escape');
 await page.locator('#ellipse').click();
 await page.keyboard.press('Escape');
 await openStitches(page);
 await expect(page.locator('button[data-view="stitches"]').first()).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#toast .toast-item')).toHaveCount(1);
 const toast=page.locator('#toast .toast-item').first(),tb=await toast.boundingBox();
 expect(tb,'toast box').not.toBeNull();
 const buttons=zoomButtons(page);
 for(let i=0;i<await buttons.count();i++){
  const b=await buttons.nth(i).boundingBox();
  const ox=Math.min(tb.x+tb.width,b.x+b.width)-Math.max(tb.x,b.x);
  const oy=Math.min(tb.y+tb.height,b.y+b.height)-Math.max(tb.y,b.y);
  expect(ox>0&&oy>0,`zoom button ${i} clear of the toast`).toBe(false);
 }
 expect(errors).toEqual([]);
});
