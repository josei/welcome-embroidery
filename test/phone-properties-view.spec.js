import {test,expect} from '@playwright/test';

// On a phone, opening Properties pans the view so the selection sits above the sheet, without changing the zoom. Closing the sheet
// puts back the zoom and centre the view had before. A shape added while the sheet is open lands in the part still showing.
const PHONES=[[390,844],[844,390]];
const LANGS=['en','es'];

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const viewBox=page=>page.locator('#art').getAttribute('viewBox').then(v=>v.split(' ').map(Number));
const rectOf=(page,selector)=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});

async function openPhone(page,width,height,lang){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto(`/?lang=${lang}`);
 return errors;
}

// The visible part of the canvas: above the sheet in portrait, left of it in landscape.
async function visiblePart(page){
 const canvas=await rectOf(page,'.canvas');
 const sheet=await rectOf(page,'#inspector');
 const bottomSheet=sheet.right-sheet.left>=(canvas.right-canvas.left)*0.9;
 return {
  left:canvas.left,top:canvas.top,
  right:bottomSheet?canvas.right:Math.min(canvas.right,sheet.left),
  bottom:bottomSheet?Math.min(canvas.bottom,sheet.top):canvas.bottom,
 };
}

async function openProperties(page){
 await page.locator('#phoneMenu').click();
 await page.locator('#menuProperties').click();
 await expect(page.locator('#inspector')).toHaveClass(/sheet-open/);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}

for(const lang of LANGS)for(const [width,height] of PHONES){
 test(`opening Properties pans without zooming, and closing restores the view (${lang} ${width}x${height})`,async({page})=>{
  const errors=await openPhone(page,width,height,lang);
  await page.locator('#rect').tap();
  await expect(page.locator('.sel-box')).toBeVisible();
  // Zoom in and pan so the selection is off screen before the sheet opens.
  await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();
  const canvas=await rectOf(page,'.canvas');
  await page.mouse.move((canvas.left+canvas.right)/2,(canvas.top+canvas.bottom)/2);
  await page.mouse.wheel(700,0);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const before={view:await viewBox(page),pct:await page.locator('#zoomPct').textContent()};
  await openProperties(page);
  const frame=await rectOf(page,'.sel-box');
  const part=await visiblePart(page);
  expect(frame.left,'selection left edge is in view').toBeGreaterThanOrEqual(part.left);
  expect(frame.right,'selection right edge is in view').toBeLessThanOrEqual(part.right);
  expect(frame.top,'selection top edge is in view').toBeGreaterThanOrEqual(part.top);
  expect(frame.bottom,'selection bottom edge is in view').toBeLessThanOrEqual(part.bottom);
  expect(await page.locator('#zoomPct').textContent(),'zoom is unchanged while Properties is open').toBe(before.pct);
  await page.locator('#inspector .sheet-close').click();
  await expect(page.locator('#inspector')).not.toHaveClass(/sheet-open/);
  await expect.poll(()=>viewBox(page)).toEqual(before.view);
  expect(await page.locator('#zoomPct').textContent()).toBe(before.pct);
  expect(errors).toEqual([]);
 });

 test(`a shape added while Properties is open lands in the visible part (${lang} ${width}x${height})`,async({page})=>{
  const errors=await openPhone(page,width,height,lang);
  await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();
  await openProperties(page);
  // The Add rectangle button sits under the sheet on a phone, so it is clicked as a DOM event here.
  await page.locator('#rect').evaluate(e=>e.click());
  await expect(page.locator('.sel-box')).toBeVisible();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const frame=await rectOf(page,'.sel-box');
  const part=await visiblePart(page);
  expect(frame.left).toBeGreaterThanOrEqual(part.left);
  expect(frame.right).toBeLessThanOrEqual(part.right);
  expect(frame.top).toBeGreaterThanOrEqual(part.top);
  expect(frame.bottom).toBeLessThanOrEqual(part.bottom);
  await page.screenshot({path:`test-results/properties-add-${lang}-${width}x${height}.png`});
  expect(errors).toEqual([]);
 });
}
