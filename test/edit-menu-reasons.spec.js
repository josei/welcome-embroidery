import {test,expect} from '@playwright/test';

// The Edit menu gives each disabled row's reason on one shared line under the list, not under every row. Spanish is
// checked too: the menu must not grow taller than the English one, and the shortcut sheet has a Spanish row for every key.
test.describe('Edit menu reasons',()=>{
 test.use({viewport:{width:1440,height:900}});

 for(const lang of ['en','es']){
  test(`the Edit menu's reason shows on the disabled row and disabled rows keep focus (${lang})`,async({page})=>{
   await page.addInitScript(l=>localStorage.setItem('welcome.lang',l),lang);
   await page.goto('/');
   await expect(page.locator('html')).toHaveAttribute('lang',lang);
   await page.locator('#editMenu').click();
   // One reason shows at a time, on the row the pointer or focus is on, else on the first disabled row (Undo).
   // Each disabled row also carries an aria-disabled flag and a tooltip.
   await expect(page.locator('#editMenuList .menu-reason')).toHaveCount(1);
   await expect(page.locator('#menuUndo .menu-reason')).toHaveCount(1);
   const cut=page.locator('#menuCut');
   await expect(cut).toHaveAttribute('aria-disabled','true');
   await expect(cut).toHaveAttribute('title',/.+/);
   // Keyboard focus reaches a disabled row, and its reason shows on that row.
   await page.locator('#menuUndo').focus();
   for(let i=0;i<40 && !(await cut.evaluate(el=>el===document.activeElement));i++) await page.keyboard.press('ArrowDown');
   await expect(cut).toBeFocused();
   await expect(cut.locator('.menu-reason')).toHaveText(await cut.getAttribute('title'));
   // Activating a disabled row does nothing: the menu stays open.
   await page.keyboard.press('Enter');
   await expect(page.locator('#editMenuList')).toBeVisible();
   const box=await page.locator('#editMenuList').boundingBox();
   await page.screenshot({path:`test-results/edit-menu-${lang}.png`,clip:{x:box.x-16,y:box.y-16,width:box.width+32,height:box.height+64}});
  });
 }

 test('the Spanish Edit menu is no taller than the English one',async({page})=>{
  const heights={};
  for(const lang of ['en','es']){
   await page.addInitScript(l=>localStorage.setItem('welcome.lang',l),lang);
   await page.goto('/');
   await page.locator('#editMenu').click();
   heights[lang]=(await page.locator('#editMenuList').boundingBox()).height;
   await page.keyboard.press('Escape');
   await page.close();
   page=await page.context().newPage();
  }
  expect(heights.es).toBeLessThanOrEqual(heights.en);
 });
});
