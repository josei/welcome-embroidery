import {test,expect} from '@playwright/test';

// Issue #208 (from audit #162, finding 9): at narrow widths the top bar stays on one row with its controls whole, and every
// panel header lines up with the body it heads, at 1920, 1024 and 760px.
const newDesign=async page=>{await page.locator('#new').click();if(await page.locator('#discardDialog[open]').count())await page.locator('#discardDiscard').click();};

test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

for(const width of [1920,1024,760]){
 test(`panel headers line up with their bodies at ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.setViewportSize({width,height:900});
  await page.goto('/');await newDesign(page);await page.locator('#rect').click();
  // A header and the body it heads share the same left and right edges, so their padding lines up. Edges are compared rather
  // than padding values, because a heading may take its inset from its panel instead of from itself.
  const edges=loc=>loc.evaluate(e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.right)];});
  const expectAligned=async(head,body,name)=>{
   await expect(head,`${name} is visible`).toBeVisible();
   expect(await edges(head),`${name} left and right edges`).toEqual(await edges(body));
  };
  // The object list heading and the list below it.
  await expectAligned(page.locator('.layers-head'),page.locator('#objects'),`layers head at ${width}px`);
  // The inspector: its heading and the Sewing order fold line up with the inspector's body text.
  await expectAligned(page.locator('#selected'),page.locator('#stats'),`inspector heading at ${width}px`);
  await expectAligned(page.locator('#secOrder > summary'),page.locator('#stats'),`sewing order header at ${width}px`);
  expect(errors).toEqual([]);
 });
}

test('the top bar stays on one row at 760px and the title gives way first',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width:760,height:900});
 await page.goto('/');await newDesign(page);
 // A long name and an unsaved design: the title is the element that gives way, and the unsaved marker stays visible.
 await page.locator('header.top #name').fill('A very long embroidery design name that keeps going');
 await page.locator('header.top #name').press('Enter');
 await page.locator('header.top #name').blur();
 const bar=page.locator('header.top');
 const info=await bar.evaluate(top=>{
  const kids=[...top.children].filter(e=>e.getBoundingClientRect().width>0);
  return {tops:kids.map(e=>e.getBoundingClientRect().top),height:top.getBoundingClientRect().height,overflow:top.scrollWidth-top.clientWidth};
 });
 // One row: every visible child sits on the same line (a wrapped row would sit lower).
 for(const t of info.tops) expect(Math.abs(t-info.tops[0]),'child top within the bar row').toBeLessThan(12);
 expect(info.height,'bar height is one row').toBeLessThanOrEqual(58);
 expect(info.overflow,'no horizontal overflow').toBeLessThanOrEqual(0);
 // The title is the element that gives way, and it shows an ellipsis rather than clipping the text.
 const title=await page.locator('header.top #name').evaluate(e=>getComputedStyle(e).textOverflow);
 expect(title,'title text-overflow').toBe('ellipsis');
 const titleBox=await page.locator('header.top #name').boundingBox();
 expect(titleBox.width,'title keeps a usable width').toBeGreaterThanOrEqual(60);
 expect(await page.locator('header.top #name').evaluate(e=>e.scrollWidth>e.clientWidth),'long title is truncated').toBe(true);
 expect(await page.locator('#unsavedMark').evaluate(e=>e.getBoundingClientRect().width),'unsaved marker is shown').toBeGreaterThan(0);
 // The controls stay whole: Undo and Redo are visible and inside the window.
 for(const id of ['#undo','#redo']){
  const box=await page.locator(id).boundingBox();expect(box,id).not.toBeNull();
  expect(box.x+box.width,`${id} inside the window`).toBeLessThanOrEqual(760);
 }
 expect(errors).toEqual([]);
});
