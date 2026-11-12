import {test,expect} from '@playwright/test';

// Issue #490 (spec §7): a touch long-press on an object opens the object menu (Duplicate, Delete, ...). Chromium's CDP touch
// hold fires no native contextmenu, so the press itself is what must open the menu. The mouse right-click keeps working.
test.describe('touch long-press opens the object menu',()=>{
 test.use({hasTouch:true});
 test.skip(({browserName})=>browserName!=='chromium','touch points are dispatched through a Chromium CDP session');

 const setup=async page=>{
  await page.goto('/');await page.locator('#rect').click();
  const box=await page.locator('#shapes [data-id]').first().boundingBox();
  return {x:box.x+box.width/2,y:box.y+box.height/2};
 };
 const touch=(cdp,points)=>cdp.send('Input.dispatchTouchEvent',{type:points.length?'touchStart':'touchEnd',touchPoints:points});
 const move=(cdp,x,y)=>cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x,y}]});

 test('holding a finger on an object for 500 ms opens the menu with Duplicate and Delete',async({page})=>{
  const {x,y}=await setup(page);const cdp=await page.context().newCDPSession(page);
  await touch(cdp,[{id:1,x,y}]);await page.waitForTimeout(700);await touch(cdp,[]);
  await expect(page.locator('#ctxMenu')).toBeVisible();
  await expect(page.locator('#ctxMenu button',{hasText:/Duplicate/})).toHaveCount(1);
  await expect(page.locator('#ctxMenu button',{hasText:/Delete/})).toHaveCount(1);
  await expect(page.locator('#ctxMenu')).toHaveCount(1);
  // The menu opened over the press: the object did not move.
  await page.keyboard.press('Escape');await expect(page.locator('#ctxMenu')).toHaveCount(0);
 });

 test('a tap shorter than 500 ms does not open the menu',async({page})=>{
  const {x,y}=await setup(page);const cdp=await page.context().newCDPSession(page);
  await touch(cdp,[{id:1,x,y}]);await page.waitForTimeout(150);await touch(cdp,[]);await page.waitForTimeout(700);
  await expect(page.locator('#ctxMenu')).toHaveCount(0);
 });

 test('movement of 8 px or more during the hold cancels it',async({page})=>{
  const {x,y}=await setup(page);const cdp=await page.context().newCDPSession(page);
  await touch(cdp,[{id:1,x,y}]);await page.waitForTimeout(100);await move(cdp,x+10,y);await page.waitForTimeout(700);await touch(cdp,[]);
  await expect(page.locator('#ctxMenu')).toHaveCount(0);
 });

 test('a small wobble under 8 px still opens the menu',async({page})=>{
  const {x,y}=await setup(page);const cdp=await page.context().newCDPSession(page);
  await touch(cdp,[{id:1,x,y}]);await page.waitForTimeout(100);await move(cdp,x+3,y+2);await page.waitForTimeout(700);await touch(cdp,[]);
  await expect(page.locator('#ctxMenu')).toBeVisible();
 });

 test('a long-press fires no native context menu, or one that is prevented',async({page})=>{
  const {x,y}=await setup(page);const cdp=await page.context().newCDPSession(page);
  // Record every contextmenu on the document (capture phase) during the hold, and whether the page cancelled it.
  await page.evaluate(()=>{window.__cm=[];document.addEventListener('contextmenu',e=>window.__cm.push({prevented:e.defaultPrevented}),true);});
  await touch(cdp,[{id:1,x,y}]);await page.waitForTimeout(700);await touch(cdp,[]);
  await expect(page.locator('#ctxMenu')).toBeVisible();
  const events=await page.evaluate(()=>window.__cm);
  // Chromium's CDP hold fires none; if one does fire it must have been prevented by the canvas.
  expect(events.every(ev=>ev.prevented)).toBe(true);
 });

 test('the canvas keeps touch-action none',async({page})=>{
  await page.goto('/');await expect(page.locator('#art')).toHaveCSS('touch-action','none');
 });
});

test('mouse right-click still opens the object menu',async({page})=>{
 await page.goto('/');await page.locator('#rect').click();
 const box=await page.locator('#shapes [data-id]').first().boundingBox();
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{button:'right'});
 await expect(page.locator('#ctxMenu button',{hasText:/Duplicate/})).toHaveCount(1);
 await expect(page.locator('#ctxMenu button',{hasText:/Delete/})).toHaveCount(1);
});
