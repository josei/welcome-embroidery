import {test,expect} from '@playwright/test';

// Escape closes an open Layers or Properties panel at a landscape phone (844x390, where the panels are sheets over the
// canvas). Focus goes back to the rail button that opened the sheet. With no panel open Escape changes nothing.
// A portrait tablet has no sheets: both panels stay in its right-hand column.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

test.use({viewport:{width:844,height:390},hasTouch:true});

test('Escape closes Layers with focus inside it, and focus goes back to its button',async({page})=>{
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#layersBtn').click();
 await expect(page.locator('#layersSheet')).toBeVisible();
 await page.locator('#layersSheet').locator('button,input,select,[tabindex]').first().focus();
 await page.keyboard.press('Escape');
 await expect(page.locator('#layersSheet')).toBeHidden();
 await expect(page.locator('#layersBtn')).toBeFocused();
});

test('Escape closes Properties with focus inside it, and focus goes back to its button',async({page})=>{
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#propertiesBtn').click();
 await expect(page.locator('#inspector')).toBeVisible();
 await page.locator('#inspector').locator('button,input,select,[tabindex]').first().focus();
 await page.keyboard.press('Escape');
 await expect(page.locator('#inspector')).toBeHidden();
 await expect(page.locator('#propertiesBtn')).toBeFocused();
});

test('Escape with no panel open leaves the selection alone',async({page})=>{
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 const before=await page.evaluate(()=>document.querySelectorAll('.canvas .selected').length);
 await page.keyboard.press('Escape');
 const after=await page.evaluate(()=>document.querySelectorAll('.canvas .selected').length);
 expect(after).toBe(before);
});

test('a portrait tablet keeps both panels open and has no sheets to close',async({page})=>{
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=en');
 await expect(page.locator('#layersSheet')).toBeVisible();
 await expect(page.locator('#inspector')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#layersSheet')).toBeVisible();
 await expect(page.locator('#inspector')).toBeVisible();
});
