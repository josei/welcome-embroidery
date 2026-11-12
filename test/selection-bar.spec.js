import {test,expect} from '@playwright/test';

// Issue #489 (spec #468 sections 1, 2 and 7): the selection bar holds Duplicate, Delete and Arrange at phone sizes, Arrange opens one sheet with
// four groups, and the Select toggle makes a tap add an object to the selection. Checked in English and Spanish.
const SIZES=[[390,844],[844,390]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

// The centre of a control, and whether the control itself is the element at that point.
async function hitTarget(page,selector){
 return page.locator(selector).evaluate(el=>{
  const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
  const top=document.elementFromPoint(x,y);
  return {w:r.width,h:r.height,self:top===el||el.contains(top)};
 });
}

for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test(`the selection bar holds Duplicate, Delete, Arrange and Select at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  // Nothing selected: the bar is absent.
  await expect(page.locator('#barDuplicate'),'no bar with nothing selected').toBeHidden();
  // The starting design has objects of its own, so counts are compared with the count before each step.
  const rows=page.locator('.object-row');
  const start=await rows.count();
  await page.locator('#rect').click();
  await expect(rows,'the new object is added').toHaveCount(start+1);
  await expect(page.locator('#barDuplicate'),'bar shown with a selection').toBeVisible();

  for(const id of ['#barDuplicate','#barDelete']){
   const hit=await hitTarget(page,id);
   expect(hit.w,`${id} width`).toBeGreaterThanOrEqual(44);
   expect(hit.h,`${id} height`).toBeGreaterThanOrEqual(44);
   expect(hit.self,`${id} is the element at its centre`).toBe(true);
  }
  await page.locator('#barDuplicate').click();
  await expect(rows,'duplicate adds one').toHaveCount(start+2);
  await page.locator('#barDelete').click();
  await expect(rows,'delete removes one').toHaveCount(start+1);
  // Delete clears the selection, so select a new object for Arrange and Select.
  await page.locator('#rect').click();
  await expect(rows).toHaveCount(start+2);

  // Arrange: one sheet, four groups, and every operation reachable from it.
  await expect(page.locator('#arrangeBtn')).toBeVisible();
  await page.locator('#arrangeBtn').click();
  const sheet=page.locator('#arrangeSheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('h3'),'four group headings').toHaveCount(4);
  for(const key of ['left','hcenter','right','top','vcenter','bottom','horizontal','vertical','flipH','flipV','front','back','subtract','union','intersect'])
   await expect(sheet.locator(`[data-arrange="${key}"]`),`${key} is in the sheet`).toHaveCount(1);
  // A second press on the Arrange button closes the sheet. (Escape would also clear the selection.)
  await page.locator('#arrangeBtn').click();
  await expect(sheet).toHaveCount(0);

  // Select: with it on, a tap on a second object adds it to the selection.
  const toggle=page.locator('#selectToggle');
  await expect(toggle).toBeVisible();
  await page.locator('#rect').click();
  await expect(rows,'one more object').toHaveCount(start+3);
  // Move the newest object (selected) left with Shift+Arrow so the other one can be tapped.
  await page.locator('#art').focus();
  for(let i=0;i<5;i++) await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.locator('.object-row.selected'),'one selected').toHaveCount(1);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  const boxes=await page.locator('#shapes > *').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,right:r.right};}));
  const other=boxes.reduce((a,b)=>(b.right>a.right?b:a));
  await page.mouse.click(other.x,other.y);
  await expect(page.locator('.object-row.selected'),'the tapped object joins the selection').toHaveCount(2);

  expect(errors).toEqual([]);
 });
}
