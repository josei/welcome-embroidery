import {test,expect} from '@playwright/test';

// Escape closes an open Layers or Properties panel at a landscape phone (844x390, where the panels are sheets) and a portrait tablet
// (768x1024, where they are the inspector drawer). Focus goes back to the control that opened a landscape sheet; on the tablet it goes
// to the collapse strip, since the tabs that opened the drawer are hidden while it is folded. With no panel open Escape changes nothing.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[
 {name:'landscape 844x390',width:844,height:390,options:{hasTouch:true}},
 {name:'tablet 768x1024',width:768,height:1024,options:{}},
];

for(const layout of SIZES){
 test.describe(layout.name,()=>{
  test.use({viewport:{width:layout.width,height:layout.height},...layout.options});

  test('Escape closes Layers with focus inside it, and focus goes to the control that reopens it',async({page})=>{
   await page.goto('/?lang=en');
   await expect(page.locator('.canvas')).toBeVisible();
   const opener=layout.height>=layout.width?'#tabLayers':'#layersBtn';
   await page.locator(opener).click();
   await expect(page.locator('#layersSheet')).toBeVisible();
   await page.locator('#layersSheet').locator('button,input,select,[tabindex]').first().focus();
   await page.keyboard.press('Escape');
   await expect(page.locator('#layersSheet')).toBeHidden();
   await expect(page.locator(layout.height>=layout.width?'.inspector-collapse':opener)).toBeFocused();
  });

  test('Escape closes Properties with focus inside it, and focus goes to the control that reopens it',async({page})=>{
   await page.goto('/?lang=en');
   await expect(page.locator('.canvas')).toBeVisible();
   const opener=layout.height>=layout.width?'#tabProperties':'#propertiesBtn';
   await page.locator(opener).click();
   await expect(page.locator('#inspector')).toBeVisible();
   await page.locator('#inspector').locator('button,input,select,[tabindex]').first().focus();
   await page.keyboard.press('Escape');
   await expect(page.locator('#inspector')).toBeHidden();
   await expect(page.locator(layout.height>=layout.width?'.inspector-collapse':opener)).toBeFocused();
  });

  test('Escape with no panel open leaves the selection alone',async({page})=>{
   await page.goto('/?lang=en');
   await expect(page.locator('.canvas')).toBeVisible();
   const before=await page.evaluate(()=>document.querySelectorAll('.canvas .selected').length);
   await page.keyboard.press('Escape');
   const after=await page.evaluate(()=>document.querySelectorAll('.canvas .selected').length);
   expect(after).toBe(before);
  });
 });
}
