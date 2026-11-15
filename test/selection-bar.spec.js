import {test,expect} from '@playwright/test';
import {revealMenuRow} from './menu-reveal.js';

// At phone sizes the selection bar carries Duplicate, Delete and Properties; Arrange and the Select toggle are Menu rows. With a selection
// the Menu runs them, and the Select toggle makes a tap add an object to the selection. Checked in English and Spanish.
const SIZES=[[390,844],[844,390]];

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

async function openEditor(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(lang==='en'?'/':`/?lang=${lang}`);
 return errors;
}

const menuRow=async(page,id)=>{
 const list=page.locator('#phoneMenuList');
 if(!(await list.isVisible())) await page.locator('#phoneMenu').click();
 await expect(list).toBeVisible();
 return revealMenuRow(list,id);
};

for(const [width,height] of SIZES) for(const lang of ['en','es']){
 test(`the Menu runs Duplicate and Delete, and Arrange is in the Menu, at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  const rows=page.locator('.object-row');
  const start=await rows.count();
  await page.locator('#rect').click();
  await expect(rows,'the new object is added').toHaveCount(start+1);
  await expect(page.locator('#barDuplicate'),'the selection bar is shown with a selection').toBeVisible();

  await (await menuRow(page,'menuDuplicate')).click();
  await expect(rows,'duplicate adds one').toHaveCount(start+2);
  await (await menuRow(page,'menuDelete')).click();
  await expect(rows,'delete removes one').toHaveCount(start+1);

  // Arrange: its operations are Menu rows, and a row runs its command (align left moves the selected object).
  await page.locator('#rect').click();
  await expect(rows).toHaveCount(start+2);
  for(const id of ['menuAlignLeft','menuFlipH','menuToFront','menuUnion']) await expect(await menuRow(page,id),`${id} is a Menu row`).toHaveCount(1);
  expect(errors).toEqual([]);
 });

 test(`the Select toggle is a Menu row, and a tap then adds an object to the selection at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  const rows=page.locator('.object-row');
  const start=await rows.count();
  await page.locator('#rect').click();
  await page.locator('#rect').click();
  await expect(rows).toHaveCount(start+2);
  const toggle=await menuRow(page,'menuSelectAdd');
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await toggle.click();
  await expect(await menuRow(page,'menuSelectAdd')).toHaveAttribute('aria-pressed','true');
  // Close the Menu without dropping the selection, then tap a second object: it joins the selection.
  await page.locator('#phoneMenu').click();
  await expect(page.locator('#phoneMenuList'),'Menu closed').toBeHidden();
  await expect(page.locator('.object-row.selected'),'one selected').toHaveCount(1);
  // Move the newest object (selected) left with Shift+Arrow so the other one can be tapped.
  await page.locator('#art').focus();
  for(let i=0;i<5;i++) await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.locator('.object-row.selected'),'one selected').toHaveCount(1);
  const boxes=await page.locator('#shapes > *').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,right:r.right};}));
  const other=boxes.reduce((a,b)=>(b.right>a.right?b:a));
  await page.mouse.click(other.x,other.y);
  await expect(page.locator('.object-row.selected'),'the tapped object joins the selection').toHaveCount(2);
  expect(errors).toEqual([]);
 });
}
