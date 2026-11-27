import {test,expect} from '@playwright/test';

// On a phone, opening Layers pans the view so the selection sits clear of the sheet, as Properties does. Closing the sheet puts
// back the zoom and centre the view had before.
const PHONES=[[390,844],[844,390]];

test.use({hasTouch:true});
test.beforeEach(async({page})=>{await page.addInitScript(()=>{delete window.showSaveFilePicker;});});

const viewBox=page=>page.locator('#art').getAttribute('viewBox').then(v=>v.split(' ').map(Number));
const rectOf=(page,selector)=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});

// The visible part of the canvas: above the sheet in portrait, left of it in landscape.
async function visiblePart(page){
 const canvas=await rectOf(page,'.canvas');
 const sheet=await rectOf(page,'#layersSheet');
 const bottomSheet=sheet.right-sheet.left>=(canvas.right-canvas.left)*0.9;
 return {
  left:canvas.left,top:canvas.top,
  right:bottomSheet?canvas.right:Math.min(canvas.right,sheet.left),
  bottom:bottomSheet?Math.min(canvas.bottom,sheet.top):canvas.bottom,
 };
}

async function openLayers(page){
 await page.locator('#phoneMenu').click();
 await page.locator('#menuLayers').click();
 await expect(page.locator('#layersSheet')).toHaveClass(/sheet-open/);
}

// The pan runs once the sheet has settled, so wait for the selection to be inside the visible part, not for a fixed number of frames.
// The check asserts on the same sample the wait accepted, so a redraw between two reads cannot fail it.
async function expectSelectionInView(page){
 let sample;
 await expect.poll(async()=>{
  const frame=await rectOf(page,'.sel-box');
  const part=await visiblePart(page);
  sample={frame,part};
  return frame.left>=part.left&&frame.right<=part.right&&frame.top>=part.top&&frame.bottom<=part.bottom;
 }).toBe(true);
 const {frame,part}=sample;
 expect(frame.left,'selection left edge is in view').toBeGreaterThanOrEqual(part.left);
 expect(frame.right,'selection right edge is in view').toBeLessThanOrEqual(part.right);
 expect(frame.top,'selection top edge is in view').toBeGreaterThanOrEqual(part.top);
 expect(frame.bottom,'selection bottom edge is in view').toBeLessThanOrEqual(part.bottom);
}

for(const [width,height] of PHONES) test(`opening Layers keeps the selection in view, and closing restores the view (${width}x${height})`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewportSize({width,height});
 await page.goto('/?lang=en');
 await page.locator('#rect').tap();
 await expect(page.locator('.sel-box')).toBeVisible();
 // With an object selected the zoom commands are in the % tile's menu.
 for(let i=0;i<2;i++){await page.locator('#zoomPct').click();await page.locator('[role=menuitem]').filter({hasText:/^(Zoom in|Acercar)$/}).click();}
 const before=await viewBox(page);
 await openLayers(page);
 await expectSelectionInView(page);
 await page.locator('#layersSheet .close-control').click();
 await expect(page.locator('#layersSheet')).not.toHaveClass(/sheet-open/);
 await expect.poll(()=>viewBox(page)).toEqual(before);
 expect(errors).toEqual([]);
});
