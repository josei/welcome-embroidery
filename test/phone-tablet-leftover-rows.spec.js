import {test,expect} from '@playwright/test';

// Layout leftovers on phone and tablet: an empty status row under the dock in the phone Stitches and 3D views, a Layers row cut
// under the count on a portrait tablet, and a phone Layers sheet that hides the lower half of the design.

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{delete window.showSaveFilePicker;});
 page.on('dialog',d=>d.accept());
});

async function openDesign(page,w,h,lang='en'){
 await page.setViewportSize({width:w,height:h});
 await page.goto(`/?lang=${lang}`);
 await expect(page.locator('header.top')).toBeVisible();
 if(await page.locator('#restoreDialog[open]').count())await page.locator('#restoreNo').click();
 if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();
}

// Draws one shape of the given tool in the middle of the canvas.
async function draw(page,tool,fx=0.3,fy=0.3){
 await page.locator(tool).click();
 const c=await page.locator('.canvas').boundingBox();
 await page.mouse.move(c.x+c.width*fx,c.y+c.height*fy);
 await page.mouse.down();
 await page.mouse.move(c.x+c.width*(fx+0.3),c.y+c.height*(fy+0.3),{steps:5});
 await page.mouse.up();
}

const phoneView=async(page,id)=>{await page.locator('#phoneMenu').click();await page.locator(`#menuView-${id}`).click();};
const box=(page,selector)=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};});

test('phone Stitches and 3D have no empty status row under the dock',async({page})=>{
 test.setTimeout(120000);
 await openDesign(page,390,844);
 await draw(page,'#rect');
 for(const view of ['stitches','preview']){
  await phoneView(page,view);
  await expect(page.locator('.phone-playback')).toBeVisible();
  await expect(page.locator('main>footer')).toHaveCSS('height','0px');
  const playback=await box(page,'.phone-playback');
  const canvas=await box(page,'.canvas');
  expect(Math.round(canvas.bottom),`${view}: canvas ends where the playback row starts`).toBeLessThanOrEqual(Math.round(playback.top)+1);
  expect(Math.round(canvas.bottom)).toBeGreaterThan(Math.round(canvas.top)+500);
  // No zero-content element keeps a 28 px box under the dock.
  const leftover=await page.evaluate(()=>[...document.querySelectorAll('.layout main>*')].filter(e=>{
    const r=e.getBoundingClientRect();return r.top>=document.querySelector('.layout main>.phone-playback').getBoundingClientRect().bottom-1&&r.height===28&&!e.textContent.trim();
  }).length);
  expect(leftover,`${view}: empty 28 px boxes under the dock`).toBe(0);
  await page.screenshot({path:`test-results/647/phone-${view}.png`});
 }
});

test('phone Stitches keeps a compile error in the status row',async({page})=>{
 test.setTimeout(120000);
 await openDesign(page,390,844);
 await draw(page,'#rect');
 await phoneView(page,'stitches');
 // With no error the row collapses; the empty-count rule must not hide a message that is shown.
 await expect(page.locator('main>footer')).toHaveCSS('height','0px');
 await page.evaluate(()=>{const c=document.querySelector('#count');c.textContent='⚠ Test message';});
 await expect(page.locator('main>footer')).toHaveCSS('height','28px');
});

test('tablet portrait Layers rows are never cut under the count',async({page})=>{
 test.setTimeout(120000);
 await openDesign(page,768,1024);
 for(const tool of ['#rect','#ellipse','#rect','#ellipse','#rect','#ellipse','#rect']){
  await draw(page,tool,0.1,0.1);
 }
 await expect(page.locator('.object-row').nth(6)).toBeVisible();
 const states=[0,60,130];
 for(const top of states){
  await page.locator('#objects').evaluate((o,t)=>{o.scrollTop=t;},top);
  await page.waitForTimeout(300);
  const result=await page.evaluate(()=>{
   const list=document.querySelector('#objects').getBoundingClientRect();
   const count=document.querySelector('.layers-count').getBoundingClientRect();
   const rows=[...document.querySelectorAll('.object-row')].map(r=>r.getBoundingClientRect()).filter(r=>r.bottom>list.top&&r.top<list.bottom);
   return {
    straddles:rows.filter(r=>r.top<count.bottom&&r.bottom>count.bottom).length,
    cutAtTop:rows.filter(r=>r.top<list.top-1.5).map(r=>Math.round(r.top)),
    listTop:list.top,countBottom:count.bottom,
   };
  });
  expect(result.straddles,`rows cut by the count's bottom edge at scroll ${top}`).toBe(0);
  expect(result.cutAtTop,`rows cut at the top of the list at scroll ${top}`).toEqual([]);
 }
 await page.locator('#objects').evaluate(o=>{o.scrollTop=0;});
 await page.waitForTimeout(300);
 await page.screenshot({path:'test-results/647/tablet-portrait-layers.png'});
});

test('phone Layers refits the design above the open sheet',async({page})=>{
 test.setTimeout(120000);
 await openDesign(page,390,844);
 await draw(page,'#rect');
 await draw(page,'#rect',0.6,0.6);
 await page.locator('#phoneMenu').click();
 await page.locator('#menuLayers').click();
 await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
 await page.waitForTimeout(700);
 const r=await page.evaluate(()=>{
  const d=document.querySelector('#shapes').getBoundingClientRect();
  const s=document.querySelector('#layersSheet').getBoundingClientRect();
  const c=document.querySelector('.canvas').getBoundingClientRect();
  return {design:{top:d.top,bottom:d.bottom,left:d.left,right:d.right},sheetTop:s.top,canvasTop:c.top,canvasLeft:c.left,canvasRight:c.right};
 });
 expect(r.design.bottom,'design bottom edge above the Layers panel top edge').toBeLessThanOrEqual(r.sheetTop);
 expect(r.design.top,'design top edge inside the canvas').toBeGreaterThanOrEqual(r.canvasTop);
 await page.screenshot({path:'test-results/647/phone-layers-open.png'});
});
