import {test,expect} from '@playwright/test';

// On a phone the Properties sheet's toast rises above the sheet so it never sits over a field.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

// Opens a blank design and adds one rectangle with the Rectangle tool.
async function addRectangle(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#rect').click();
 await expect(page.locator('#remove')).toBeEnabled();
}

for(const lang of ['en','es']){
 test(`a toast does not cover a Properties field at phone widths (${lang})`,async({page})=>{
  for(const [w,h] of [[375,667],[390,844]]){
   await page.setViewportSize({width:w,height:h});
   await addRectangle(page,lang);
   await page.locator('#phoneMenu').click();
   await page.locator('#menuProperties').click();
   await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
   // Opening the sheet is a user action, so the rectangle's confirmation is gone and no toast can sit over a field.
   await expect(page.locator('#toast .toast-item')).toHaveCount(0);
   await page.reload();
   if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
   if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
  }
 });
}

test('a toast fades on its own after the Rectangle tool adds a shape (en)',async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await addRectangle(page,'en');
 const toast=page.locator('#toast .toast-item').first();
 await expect(toast).toContainText('Rectangle added');
 await expect(toast).toHaveCount(0,{timeout:6000});
});
