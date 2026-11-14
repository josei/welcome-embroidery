import {test,expect} from '@playwright/test';

// The checkboxes in the Settings dialog take the product's green accent, the colour a selected segmented control uses,
// rather than the browser's default blue.

test('a checked checkbox in Settings uses the selected segmented control\'s accent at 1440x900',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?lang=en');
 await expect(page.locator('.segmented button.active')).toBeVisible();
 await page.locator('#settingsBtn').click();
 await expect(page.locator('#settingsDialog')).toBeVisible();
 const tick=page.locator('#tipsList input[type=checkbox]').first();
 await expect(tick).toBeVisible();
 const colours=await page.evaluate(()=>{
  const box=document.querySelector('#tipsList input[type=checkbox]');
  return {
   checked:box.checked,
   accent:getComputedStyle(box).accentColor,
   segmented:getComputedStyle(document.querySelector('.segmented button.active')).color,
  };
 });
 expect(colours.checked).toBe(true);
 expect(colours.accent).toBe(colours.segmented);
});
