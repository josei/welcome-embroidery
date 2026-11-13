import {test,expect} from '@playwright/test';

// Selecting an object resizes the canvas: on a portrait tablet a touch tap on the drawing folds the Layers column to its
// 44 px rail, and on a phone the selection bar takes a row below the canvas. The drawing keeps its place on screen through
// that resize, so the hoop does not slide away from the finger and the next tap lands on the same object.

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

// A box read while the scene is being rebuilt can be empty or half-applied, so a box counts only once two frames agree.
const stableBox=(page,selector)=>page.evaluate(async selector=>{
 const read=()=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
 let box=null;
 for(let i=0;i<30;i++){
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const next=read();
  if(next&&next.width>0&&box&&Math.abs(next.left-box.left)<0.01&&Math.abs(next.top-box.top)<0.01&&Math.abs(next.width-box.width)<0.01)return next;
  box=next;
 }
 throw Error(`no steady box for ${selector}`);
},selector);
const hoopBox=page=>stableBox(page,'#hoopRing');
const leafBox=page=>stableBox(page,'#shapes [data-id="leaf"]');
const selectedIds=page=>page.locator('.object-row.selected').evaluateAll(rows=>rows.map(r=>r.dataset.id));
const insideLeaf=(leaf,point)=>point.x>=leaf.left&&point.x<=leaf.left+leaf.width&&point.y>=leaf.top&&point.y<=leaf.top+leaf.height;
const expectFixed=(before,after,name)=>{
 expect(Math.abs(after.left-before.left),`${name} x stays put`).toBeLessThanOrEqual(0.5);
 expect(Math.abs(after.top-before.top),`${name} y stays put`).toBeLessThanOrEqual(0.5);
};

// The leaf sits under this point on a fresh 768x1024 tablet.
const LEAF_POINT={x:228,y:520};

for(const pointer of ['touch','mouse']){
 test(`768x1024: a ${pointer} tap on the leaf leaves the hoop where it was`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:768,height:1024});
  await page.goto('/?lang=en');
  await expect(page.locator('#hoopRing')).toBeVisible();
  const hoop=await hoopBox(page),leaf=await leafBox(page);
  if(pointer==='touch')await page.touchscreen.tap(LEAF_POINT.x,LEAF_POINT.y);else await page.mouse.click(LEAF_POINT.x,LEAF_POINT.y);
  await expect.poll(()=>selectedIds(page)).toEqual(['leaf']);
  await expectFixed(hoop,await hoopBox(page),'the hoop');
  // Not just the hoop: nothing in the drawing moves.
  await expectFixed(leaf,await leafBox(page),'the leaf');
  expect(errors).toEqual([]);
 });
}

test('768x1024: a second touch tap on the same point still hits the leaf',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/?lang=en');
 await expect(page.locator('#hoopRing')).toBeVisible();
 const hoop=await hoopBox(page),leaf=await leafBox(page);
 await page.touchscreen.tap(LEAF_POINT.x,LEAF_POINT.y);
 await expect.poll(()=>selectedIds(page)).toEqual(['leaf']);
 // The Layers column has folded to its rail, and the point is still on the leaf: its selection handles cover it, or the
 // leaf itself does, but never empty canvas, where a tap would clear the selection.
 await expect(page.locator('#layersSheet')).toBeHidden();
 expect(insideLeaf(await leafBox(page),LEAF_POINT),'the point is still on the leaf after the fold').toBe(true);
 await page.touchscreen.tap(LEAF_POINT.x,LEAF_POINT.y);
 await expect.poll(()=>selectedIds(page),'the second tap keeps the leaf selected').toEqual(['leaf']);
 await expect(page.locator('.marquee')).toHaveCount(0);
 await expectFixed(hoop,await hoopBox(page),'the hoop');
 await expectFixed(leaf,await leafBox(page),'the leaf');
 expect(errors).toEqual([]);
});

test('390x844: a touch tap on the leaf leaves the hoop where it was',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?lang=en');
 await expect(page.locator('#hoopRing')).toBeVisible();
 const hoop=await hoopBox(page),leaf=await leafBox(page);
 // The selection bar takes a row below the canvas, which shortens it: the hoop must not rise with it.
 await expect(page.locator('.layout main>.floating')).toBeHidden();
 await page.touchscreen.tap(leaf.left+leaf.width/2,leaf.top+leaf.height/2);
 await expect.poll(()=>selectedIds(page)).toEqual(['leaf']);
 await expect(page.locator('.layout main>.floating')).toBeVisible();
 await expectFixed(hoop,await hoopBox(page),'the hoop');
 await expectFixed(leaf,await leafBox(page),'the leaf');
 expect(errors).toEqual([]);
 await context.close();
});

// A rotation changes the window, not just a panel: the drawing area moves and the canvas changes shape, so the scene is
// centred in the new area. Holding the old top-left corner there would leave the hoop hanging past the bottom edge.
test('390x844 rotated to 844x390 keeps the hoop inside the canvas',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?lang=en');
 await expect(page.locator('#hoopRing')).toBeVisible();
 await page.setViewportSize({width:844,height:390});
 const hoop=await hoopBox(page),canvas=await stableBox(page,'.canvas');
 expect(hoop.left,'the hoop starts inside the canvas').toBeGreaterThanOrEqual(canvas.left-0.5);
 expect(hoop.top,'the hoop starts inside the canvas').toBeGreaterThanOrEqual(canvas.top-0.5);
 expect(hoop.left+hoop.width,'the hoop ends inside the canvas').toBeLessThanOrEqual(canvas.left+canvas.width+0.5);
 expect(hoop.top+hoop.height,'the hoop ends inside the canvas').toBeLessThanOrEqual(canvas.top+canvas.height+0.5);
 expect(errors).toEqual([]);
 await context.close();
});
