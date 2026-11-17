import {test,expect} from '@playwright/test';

// Adding lettering and typing into its box is one undo step: one Undo returns the design to how it was before the
// lettering was added, with no placeholder left behind and no "Text: Text" layer name.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEmptyEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:1280,height:800});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 await page.locator('#new').click();
 if(await page.locator('#discardDialog[open]').count()) await page.locator('#discardDiscard').click();
 await expect(page.locator('.object-row'),'the design starts empty').toHaveCount(0);
 await page.setViewportSize({width,height});
 return errors;
}

const rowNames=page=>page.locator('.object-row').allTextContents();

test('one undo after typing lettering removes it entirely (1440x900)',async({page})=>{
 const errors=await openEmptyEditor(page,1440,900,'en');
 await page.locator('#rect').click();
 await expect(page.locator('.object-row'),'the rectangle is added').toHaveCount(1);
 const before=await rowNames(page);

 await page.locator('.tool-rail #letter').click();
 await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
 await page.keyboard.type('Hola');
 await page.keyboard.press('Enter');
 await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
 await expect(page.locator('.object-row'),'the lettering is added').toHaveCount(2);

 await page.keyboard.press('Control+z');
 await expect(page.locator('.object-row'),'one undo leaves the design as it was before the lettering').toHaveCount(1);
 expect(await rowNames(page),'no placeholder row remains').toEqual(before);
 expect((await rowNames(page)).join(' '),'no "Text" placeholder remains').not.toMatch(/Text/i);
 expect(errors).toEqual([]);
});

test('lettering layer is never named "Text: Text" after typing (1440x900)',async({page})=>{
 const errors=await openEmptyEditor(page,1440,900,'en');
 await page.locator('.tool-rail #letter').click();
 await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
 await page.keyboard.type('Hola');
 await page.keyboard.press('Enter');
 await expect(page.locator('.object-row'),'the lettering is added').toHaveCount(1);
 const names=await rowNames(page);
 expect(names.join(' '),'the layer shows the typed word').toContain('Hola');
 expect(names.join(' '),'no duplicated placeholder name').not.toMatch(/Text: Text/);
 expect(errors).toEqual([]);
});

// New lettering goes into free space: at 1440x900 its drawn box does not touch the rectangle added just before it,
// in English and Spanish, even though the typed word is wider or narrower than the placeholder it was placed with.
const objectBoxes=page=>page.evaluate(()=>[...document.querySelectorAll('#shapes [data-id]')].map(el=>{
 const r=el.getBoundingClientRect();
 return {id:el.getAttribute('data-id'),left:r.left,top:r.top,right:r.right,bottom:r.bottom};
}));
const touchesOrOverlaps=(a,b)=>a.left<=b.right&&b.left<=a.right&&a.top<=b.bottom&&b.top<=a.bottom;

for(const lang of ['en','es']) for(const word of ['Hola','Mariposas']){
 test(`lettering does not touch the rectangle just added (1440x900, ${lang}, ${word})`,async({page})=>{
  const errors=await openEmptyEditor(page,1440,900,lang);
  await page.locator('#rect').click();
  await expect(page.locator('.object-row'),'the rectangle is added').toHaveCount(1);
  const rectId=await page.locator('.object-row').first().getAttribute('data-id');

  await page.locator('.tool-rail #letter').click();
  await expect(page.locator('#canvasText'),'text box opens').toBeVisible();
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
  await expect(page.locator('#canvasText'),'the box closes').toHaveCount(0);
  await expect(page.locator('.object-row'),'the lettering is added').toHaveCount(2);
  const textId=await page.locator('.object-row').last().getAttribute('data-id');

  const boxes=await objectBoxes(page);
  const rect=boxes.find(b=>b.id===rectId), text=boxes.find(b=>b.id===textId);
  expect(rect,'the rectangle is drawn').toBeTruthy();
  expect(text,'the lettering is drawn').toBeTruthy();
  expect(touchesOrOverlaps(text,rect),'the lettering does not touch the rectangle').toBe(false);
  expect(errors).toEqual([]);
 });
}
