import {test,expect} from '@playwright/test';

// A new lettering object opens with a placeholder word selected in its on-canvas box. Pressing Enter (or leaving the
// box) without typing must place nothing: the placeholder is a hint, not content. Typing, even the placeholder's own
// word by hand, still places the lettering.
test.use({hasTouch:true});

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const PHONE={width:390,height:844};
const PLACEHOLDER={en:'Text',es:'Texto'};

// A fresh load opens a sample design. Start on an empty one at a width where New is shown, then use the size under test.
async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:1280,height:800});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await expect(page.locator('.object-row'),'the design starts empty').toHaveCount(0);
 await page.setViewportSize({width,height});
 return errors;
}

async function openTextBox(page,lang){
 await page.locator('.tool-rail #letter').tap();
 await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
 await expect(page.locator('#canvasText'),'the placeholder is in the box').toHaveValue(PLACEHOLDER[lang]);
}

// The layers heading states the object count, so it can be compared before and after.
const counts=async page=>({
 rows:await page.locator('.object-row').count(),
 heading:(await page.locator('.layers-head').textContent())??'',
});

for(const lang of ['en','es']){
 test(`pressing Enter on the untouched placeholder places nothing (390x844, ${lang})`,async({page})=>{
  const errors=await openEditor(page,PHONE.width,PHONE.height,lang);
  const before=await counts(page);
  await openTextBox(page,lang);
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
  await expect(page.locator('.object-row'),'no layer row is added').toHaveCount(0);
  expect((await counts(page)).heading,'the object count is unchanged').toBe(before.heading);
  expect(errors).toEqual([]);
 });

 test(`leaving the untouched placeholder by tapping the canvas keeps the object (390x844, ${lang})`,async({page})=>{
  await openEditor(page,PHONE.width,PHONE.height,lang);
  await openTextBox(page,lang);
  await page.locator('.canvas').tap({position:{x:20,y:20}});
  await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
  await expect(page.locator('.object-row'),'the object stays, as its placeholder word').toHaveCount(1);
  await expect(page.locator('.object-row').first()).toContainText(PLACEHOLDER[lang].toUpperCase());
 });

 test(`typing a word and pressing Enter places one selected object (390x844, ${lang})`,async({page})=>{
  await openEditor(page,PHONE.width,PHONE.height,lang);
  await openTextBox(page,lang);
  // The placeholder is selected, so the first keystroke replaces all of it.
  await page.keyboard.type('Hola');
  await expect(page.locator('#canvasText')).toHaveValue('Hola');
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
  await expect(page.locator('.object-row'),'exactly one object is added').toHaveCount(1);
  await expect(page.locator('.object-row').first(),'the layer row shows the typed word').toContainText('HOLA');
  await expect(page.locator('.object-row.selected'),'the new object is selected').toHaveCount(1);
 });

 test(`clearing the box and pressing Enter places nothing (390x844, ${lang})`,async({page})=>{
  await openEditor(page,PHONE.width,PHONE.height,lang);
  await openTextBox(page,lang);
  await page.keyboard.press('Backspace');
  await expect(page.locator('#canvasText')).toHaveValue('');
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
  await expect(page.locator('.object-row'),'no layer row is added').toHaveCount(0);
 });

 test(`typing the placeholder's own word by hand places the object (390x844, ${lang})`,async({page})=>{
  await openEditor(page,PHONE.width,PHONE.height,lang);
  await openTextBox(page,lang);
  await page.keyboard.type(PLACEHOLDER[lang]);
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
  await expect(page.locator('.object-row'),'one object is added').toHaveCount(1);
  await expect(page.locator('.object-row').first()).toContainText(PLACEHOLDER[lang].toUpperCase());
  await expect(page.locator('.object-row.selected'),'the new object is selected').toHaveCount(1);
 });
}

test('at 1440x900 the text box opens on a selected object, selects the placeholder, and commits a typed word',async({page})=>{
 const errors=await openEditor(page,1440,900,'en');
 await page.locator('.tool-rail #letter').click();
 const box=page.locator('#canvasText');
 await expect(box,'text box opens').toBeVisible();
 await expect(box).toBeFocused();
 const selection=await box.evaluate(e=>({start:e.selectionStart,end:e.selectionEnd,value:e.value}));
 expect(selection.value,'the placeholder is shown').toBe('Text');
 expect([selection.start,selection.end],'the whole placeholder is selected').toEqual([0,'Text'.length]);
 await expect(page.locator('.object-row.selected'),'the new object is selected').toHaveCount(1);
 await page.keyboard.type('Welcome');
 await expect(box,'typing replaces the placeholder in one go').toHaveValue('Welcome');
 await page.keyboard.press('Enter');
 await expect(box,'the box closes').toHaveCount(0);
 await expect(page.locator('.object-row')).toHaveCount(1);
 await expect(page.locator('.object-row').first()).toContainText('WELCOME');
 await expect(page.locator('.object-row.selected')).toHaveCount(1);
 expect(errors).toEqual([]);
});
