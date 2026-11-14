import {test,expect} from '@playwright/test';

// The empty-canvas hint names the input in use: a finger is told to tap, a mouse keeps its click wording. Tapping a tool
// leaves only that tool marked as active, so a tapped Shape tile does not look selected next to Select.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test.describe('touch input', ()=>{
 test.use({hasTouch:true});
 for (const width of [768, 1024]) {
  test(`${width}px: the empty-canvas hint says tap, not click or drag a box`,async({page})=>{
   await page.setViewportSize({width,height:1024});
   await page.goto('/?lang=en');
   const hint=page.locator('#selHint');
   await expect(hint).toBeVisible();
   const text=await hint.textContent();
   expect(text).toMatch(/\btap\b|\btouch\b/i);
   expect(text).not.toMatch(/click|drag a box/i);
  });
 }
 test('a tapped Rectangle keeps no grey fill and only Select is pressed',async({page})=>{
  await page.setViewportSize({width:768,height:1024});
  await page.goto('/?lang=en');
  const rect=page.locator('#rect');
  await rect.tap();
  await expect(page.locator('#select')).toHaveAttribute('aria-pressed','true');
  await expect(rect).toHaveAttribute('aria-pressed','false');
  const background=await rect.evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(background).toBe('rgba(0, 0, 0, 0)');
 });
});

test('desktop mouse: the empty-canvas hint keeps its click wording',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?lang=en');
 await expect(page.locator('#selHint')).toHaveText('Nothing selected. Click an object, drag a box around several, or pick a tool on the left.');
});

test.describe('after Enter in the lettering field', ()=>{
 test('the Text tile keeps no tooltip and no grey mark; only Select is active', async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?lang=en');
  await page.locator('#letter').click();
  const box=page.locator('#canvasText');
  await expect(box).toBeVisible();
  await box.fill('Hi');
  await box.press('Enter');
  await expect(box).toHaveCount(0);
  const letter=page.locator('#letter');
  await expect(letter).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#tooltip')).not.toHaveClass(/show/);
  const style=await letter.evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,border:s.borderTopColor,ring:s.outlineStyle,shadow:s.boxShadow};});
  expect(style.bg).toBe('rgba(0, 0, 0, 0)');
  expect(style.ring).toBe('none');
  expect(style.shadow).toBe('none');
 });
});
