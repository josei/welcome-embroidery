import {test,expect} from '@playwright/test';

// Escape closes the Export dialog at every layout, in English and Spanish. At the portrait tablet the inspector drawer also
// answers Escape, so it must leave the dialog alone. Focus moves into the dialog on open and returns to Export on close.

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const SIZES=[
 {name:'tablet 768x1024',width:768,height:1024},
 {name:'phone 390x844',width:390,height:844},
 {name:'landscape 844x390',width:844,height:390},
 {name:'desktop 1280x800',width:1280,height:800},
];

for(const layout of SIZES) for(const lang of ['en','es']){
 test(`${layout.name} ${lang}: Escape closes Export and returns focus to it`,async({page})=>{
  await page.setViewportSize({width:layout.width,height:layout.height});
  await page.goto(`/?lang=${lang}`);
  await expect(page.locator('.canvas')).toBeVisible();
  await page.locator('#export').click();
  const dialog=page.locator('#exportDialog');
  await expect(dialog).toBeVisible();
  const focusInside=await page.evaluate(()=>!!document.activeElement?.closest('#exportDialog'));
  expect(focusInside).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#export')).toBeFocused();
 });
}

test('Cancel still closes Export at the tablet size',async({page})=>{
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=en');
 await expect(page.locator('.canvas')).toBeVisible();
 await page.locator('#export').click();
 await expect(page.locator('#exportDialog')).toBeVisible();
 await page.locator('#exportDialog').getByRole('button',{name:'Cancel'}).click();
 await expect(page.locator('#exportDialog')).toBeHidden();
 await expect(page.locator('#export')).toBeFocused();
});
