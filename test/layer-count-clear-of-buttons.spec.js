import {test,expect} from '@playwright/test';

// On a mouse desktop the Hide and Lock buttons float over the right end of each layer row. The type and stitch count line
// sits under the name, so it must also stop before those buttons: no part of its text may lie under them, in any row state.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

const LONG_NAME='Centro de la flor con un nombre de capa muy largo';

async function drawLargeAndRename(page,lang){
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
 await page.locator('#rect').click();
 const c=await page.locator('.canvas').boundingBox();
 // A large shape gives a large stitch count, the longest count line the row can show.
 await page.mouse.move(c.x+c.width*0.1,c.y+c.height*0.1);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*0.9,c.y+c.height*0.9,{steps:5});
 await page.mouse.up();
 await expect(page.locator('#remove')).toBeEnabled();
 await expect(page.locator('.object-row').first()).toBeVisible();
 await page.locator('.object-row').first().locator('.row-name').dblclick();
 await page.locator('.row-rename').fill(LONG_NAME);
 await page.locator('.row-rename').press('Enter');
 await expect(page.locator('.object-row').first().locator('.row-name')).toHaveText(LONG_NAME);
 await expect(page.locator('.object-row').first().locator('.row-count')).toBeVisible();
}

// For every visible layer row: the boxes of its count and of its Hide and Lock buttons, in pixels.
function countAndButtons(){
 return [...document.querySelectorAll('.object-line')].filter(l=>l.offsetParent).map(l=>{
  const row=l.querySelector('.object-row');
  const count=row.querySelector('.row-count');
  const eye=l.querySelector('.row-eye').getBoundingClientRect();
  const lock=l.querySelector('.row-lock').getBoundingClientRect();
  const box=count?count.getBoundingClientRect():null;
  return {
   name:row.querySelector('.row-name').textContent,
   selected:row.classList.contains('selected'),
   count:box&&{left:box.left,right:box.right,top:box.top,bottom:box.bottom},
   eye:{left:eye.left,right:eye.right,top:eye.top,bottom:eye.bottom},
   lock:{left:lock.left,right:lock.right,top:lock.top,bottom:lock.bottom},
  };
 });
}

const overlaps=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;

for(const lang of ['en','es']){
 test(`the count of a selected row with a long name stays clear of Hide and Lock in ${lang} at 1440x900`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await drawLargeAndRename(page,lang);
  const row=page.locator('.object-row').first();
  await row.click();
  const rows=await page.evaluate(countAndButtons);
  expect(rows.length).toBeGreaterThan(0);
  const selected=rows.find(r=>r.selected);
  expect(selected,'a row is selected').toBeTruthy();
  expect(selected.count,'the selected row shows its count').toBeTruthy();
  expect(overlaps(selected.count,selected.eye),`count overlaps Hide in ${lang}`).toBe(false);
  expect(overlaps(selected.count,selected.lock),`count overlaps Lock in ${lang}`).toBe(false);
 });

 test(`the count of a long-named layer stays clear of Hide and Lock in every row state in ${lang} at 1440x900`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await drawLargeAndRename(page,lang);
  const row=page.locator('.object-row').first();
  const states=[];
  // Rest, hovered, selected, then hidden and locked: the buttons show differently in each.
  await page.mouse.move(0,0);
  states.push(['rest',await page.evaluate(countAndButtons)]);
  await row.hover();
  states.push(['hover',await page.evaluate(countAndButtons)]);
  await row.click();
  await page.mouse.move(0,0);
  states.push(['selected',await page.evaluate(countAndButtons)]);
  await page.locator('.object-line').first().locator('.row-eye').click({force:true});
  await page.locator('.object-line').first().locator('.row-lock').click({force:true});
  await page.mouse.move(0,0);
  states.push(['hidden and locked',await page.evaluate(countAndButtons)]);
  for(const [state,rows] of states){
   const r=rows[0];
   expect(r.count,`count shown in ${state}`).toBeTruthy();
   expect(overlaps(r.count,r.eye),`count overlaps Hide when ${state} in ${lang}`).toBe(false);
   expect(overlaps(r.count,r.lock),`count overlaps Lock when ${state} in ${lang}`).toBe(false);
  }
 });
}
