import {test,expect} from '@playwright/test';

// Every on state in the chrome is the same treatment: the pale teal fill, teal border and 3 px teal bar on the left.
// The 3D hint is plain text, so it has no button role and no pill.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const ON_STATE=el=>el.evaluate(e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,shadow:s.boxShadow,color:s.color};});

test('the Hand tool on state matches the tool tiles at 390x844 in Spanish',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await expect(page.locator('header.top')).toBeVisible();
 const hand=page.locator('#handTool');
 await expect(hand).toHaveAttribute('aria-pressed','false');
 const offHand=await ON_STATE(hand);
 await hand.click();
 await expect(hand).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(0,0);
 const onHand=await ON_STATE(hand);
 const tile=page.locator('.layout main>.tool-rail .icon-button.active-tool').first();
 const onTile=await ON_STATE(tile);
 expect(onHand,'Hand tool on state equals a tool tile on state').toEqual(onTile);
 expect(onHand.shadow,'on state has the teal bar').toMatch(/3px 0px 0px 0px inset/);
 expect(offHand.shadow,'off and on differ without hover').not.toEqual(onHand.shadow);
 await page.screenshot({path:'test-results/hand-on-390-es.png'});
});

test('the Select toggle on state uses the shared tool on state at 390x844 in Spanish',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?lang=es');
 await expect(page.locator('header.top')).toBeVisible();
 const sel=page.locator('#selectToggle');
 await page.keyboard.press('Control+a');
 await expect(sel).toBeVisible();
 await sel.click();
 await expect(sel).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(0,0);
 const on=await ON_STATE(sel);
 expect(on.shadow).toMatch(/3px 0px 0px 0px inset/);
 expect(on.bg).toBe('rgb(225, 241, 236)');
});

const SIZES=[[390,844],[844,390],[768,1024]];
for(const [w,h] of SIZES){
 test(`the 3D hint is plain text at ${w}x${h} in Spanish`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  await page.goto('/?lang=es');
  await expect(page.locator('header.top')).toBeVisible();
  await page.screenshot({path:`test-results/tool-view-${w}x${h}-es.png`});
  const view=page.locator('[data-view=preview]');
  if(await view.isVisible()) await view.click();
  else {await page.locator('#phoneMenu').click();await page.locator('#menuView-preview').click();}
  await expect(page.locator('#preview3d')).toHaveAttribute('data-instances',/^[1-9]\d*$/,{timeout:8000});
  const hint=page.locator('#previewHint');
  await expect(hint).toBeVisible();
  expect(await hint.getAttribute('role'),'no button or image role').toBeNull();
  expect(await hint.evaluate(e=>e.tagName)).toBe('DIV');
  const s=await hint.evaluate(e=>{const c=getComputedStyle(e);return {bg:c.backgroundColor,radius:c.borderRadius,border:c.borderTopWidth,pad:c.paddingTop};});
  expect(s.bg,'no pill fill').toMatch(/^rgba\(0, 0, 0, 0\)$|^transparent$/);
  expect(parseFloat(s.border),'no pill border').toBe(0);
  expect(parseFloat(s.pad),'no pill padding').toBe(0);
  const box=await hint.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(w);
  await page.screenshot({path:`test-results/3d-hint-${w}x${h}-es.png`});
 });
}
