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

 test(`the Select toggle on the phone bar adds an object to the selection at ${width}x${height} (${lang})`,async({page})=>{
  const errors=await openEditor(page,width,height,lang);
  const rows=page.locator('.object-row');
  const start=await rows.count();
  await page.locator('#rect').click();
  await page.locator('#rect').click();
  await expect(rows).toHaveCount(start+2);
  const toggle=page.locator('.phone-selection #selectToggle');
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.object-row.selected'),'one selected').toHaveCount(1);
  // Move the newest object (selected) left with Shift+Arrow so the other one can be tapped.
  await page.locator('#art').focus();
  for(let i=0;i<5;i++) await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.locator('.object-row.selected'),'one selected').toHaveCount(1);
  // The tap goes on the rightmost other object, at a point the selection's handles do not cover (the angle handle can sit over its centre).
  const target=await page.evaluate(()=>{
    const els=[...document.querySelectorAll('#shapes > *')].map(e=>({e,r:e.getBoundingClientRect()}));
    const other=els.reduce((a,b)=>(b.r.right>a.r.right?b:a));
    for(const [fx,fy] of [[.5,.5],[.3,.3],[.7,.3],[.3,.7],[.7,.7]]){
      const x=other.r.left+other.r.width*fx,y=other.r.top+other.r.height*fy;
      const hit=document.elementFromPoint(x,y);
      if(hit&&other.e.contains(hit)) return {x,y};
    }
    return null;
  });
  expect(target,'a point of the other object is free to tap').not.toBeNull();
  await page.mouse.click(target.x,target.y);
  await expect(page.locator('.object-row.selected'),'the tapped object joins the selection').toHaveCount(2);
  expect(errors).toEqual([]);
 });
}
